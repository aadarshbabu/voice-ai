import type { VoiceEvent } from './events';
import type {
  TurnContext,
  TurnResult,
  Effect,
} from './types';
import { createInitialTurnContext } from './types';
import { turnReducer } from './turn-machine';
import type { OrchestratorConfig, PrismaLike, EffectHandlers } from './effect-handlers';
import type { ExecutionContext, LLMConfig, AdvanceResult } from '../types';
import { runWorkflowUntilWait } from '../runner';
import { sessionEmitter } from '../session-emitter';
import type { Node, Edge } from '@xyflow/react';

// ============================================
// Engine Orchestrator — The Bridge
// ============================================
// This class wraps the pure turnReducer FSM and
// connects it to the real world:
//   - Dispatches VoiceEvents into the FSM
//   - Processes emitted Effects via injected handlers
//   - Bridges CALL_ENGINE effects to runWorkflowUntilWait()
//   - Manages TTS cancellation via AbortController
//   - Pushes state updates via sessionEmitter
//
// The orchestrator serializes dispatch() calls using
// a promise queue to prevent race conditions on TurnContext.
// ============================================

/**
 * SessionData — matches the persistence format used in functions.ts
 */
interface SessionData {
  context: ExecutionContext;
  llmConfig?: Partial<LLMConfig>;
}

export class EngineOrchestrator {
  private turnContext: TurnContext;
  private readonly sessionId: string;
  private readonly workflowId: string;
  private readonly handlers: EffectHandlers;
  private readonly prisma: PrismaLike;
  private readonly llmConfig?: Partial<LLMConfig>;

  /** The current execution context (transcript, variables, etc.) */
  private executionContext: ExecutionContext | null = null;

  /** Promise chain for serializing dispatch() calls */
  private dispatchQueue: Promise<void> = Promise.resolve();

  /** AbortController for in-flight TTS — enables barge-in cancellation */
  private ttsAbortController: AbortController | null = null;

  /** Whether this orchestrator has been destroyed */
  private destroyed = false;

  constructor(config: OrchestratorConfig) {
    this.sessionId = config.sessionId;
    this.workflowId = config.workflowId;
    this.handlers = config.handlers;
    this.prisma = config.prisma;
    this.llmConfig = config.llmConfig;
    this.turnContext = createInitialTurnContext();
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Dispatch a VoiceEvent into the FSM.
   * Calls are serialized — if another dispatch is in-flight,
   * this one queues behind it.
   */
  async dispatch(event: VoiceEvent): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.dispatchQueue = this.dispatchQueue.then(() =>
      this._processEvent(event),
    );
    return this.dispatchQueue;
  }

  /**
   * Returns a read-only copy of the current FSM context.
   */
  getContext(): TurnContext {
    return { ...this.turnContext };
  }

  /**
   * Cleanup — abort any active TTS and mark as destroyed.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.ttsAbortController) {
      this.ttsAbortController.abort();
      this.ttsAbortController = null;
    }
  }

  // ============================================
  // Internal: Event Processing
  // ============================================

  /**
   * Core dispatch loop — runs the FSM and processes effects.
   */
  private async _processEvent(event: VoiceEvent): Promise<void> {
    if (this.destroyed) return;

    // Run the pure FSM reducer
    const result: TurnResult = turnReducer(this.turnContext, event);

    // Update internal state
    this.turnContext = result.context;

    // Notify SSE listeners of state change (immediately after state transition)
    // This ensures UI sees 'THINKING' state before processEffects (which can take time)
    this.notifyStateUpdate();

    // Process all emitted effects
    await this.processEffects(result.effects);
  }

  // ============================================
  // Internal: Effect Processing
  // ============================================

  /**
   * Iterate over effects and dispatch to appropriate handler.
   */
  private async processEffects(effects: Effect[]): Promise<void> {
    for (const effect of effects) {
      if (this.destroyed) break;

      try {
        await this.handleEffect(effect);
      } catch (err) {
        // Graceful degradation — log and continue
        const message = err instanceof Error ? err.message : String(err);
        await this.handlers.onLogEvent(
          `Effect handler error [${effect.type}]: ${message}`,
          'error',
        );
      }
    }
  }

  /**
   * Route a single Effect to its handler.
   */
  private async handleEffect(effect: Effect): Promise<void> {
    switch (effect.type) {
      case 'START_ASR':
        await this.handlers.onStartASR();
        break;

      case 'STOP_ASR':
        await this.handlers.onStopASR();
        break;

      case 'STOP_TTS':
        this.abortTTS();
        await this.handlers.onStopTTS();
        break;

      case 'CALL_ENGINE':
        await this.handleCallEngine(effect.payload.transcript);
        break;

      case 'EMIT_SPEAKING_TEXT':
        // Create new AbortController for this TTS session
        this.ttsAbortController = new AbortController();
        await this.handlers.onEmitSpeakingText(
          effect.payload.text,
          effect.payload.nodeId,
          this.ttsAbortController.signal,
        );
        break;

      case 'EMIT_AUDIO':
        await this.handlers.onEmitAudio(
          effect.payload.text,
          effect.payload.nodeId,
        );
        break;

      case 'LOG_EVENT':
        await this.handlers.onLogEvent(
          effect.payload.message,
          effect.payload.level,
        );
        break;
    }
  }

  // ============================================
  // Internal: Engine Bridge (State Bridge)
  // ============================================

  /**
   * The State Bridge — translates CALL_ENGINE effect
   * into a real engine call and maps the result back
   * to FSM VoiceEvents.
   */
  private async handleCallEngine(transcript: string): Promise<void> {
    console.log(`[Orchestrator:${this.sessionId}] Calling engine with transcript: "${transcript}"`);
    try {
      // 1. Load workflow definition from DB
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: this.workflowId },
      });

      if (!workflow) {
        await this._processEvent({
          type: 'ERROR',
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          payload: { message: `Workflow ${this.workflowId} not found`, fatal: true },
        });
        return;
      }

      const nodes = workflow.nodes as unknown as Node[];
      const edges = workflow.edges as unknown as Edge[];

      // 2. Rehydrate ExecutionContext from session metadata or cache
      const context = this.executionContext || await this.loadExecutionContext();
      if (!context) {
        await this._processEvent({
          type: 'ERROR',
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          payload: { message: `Session ${this.sessionId} context not found`, fatal: true },
        });
        return;
      }

      // 3. Call the existing engine — the "consultant"
      const result: AdvanceResult = await runWorkflowUntilWait(
        nodes,
        edges,
        context,
        transcript,
        this.llmConfig,
      );

      // 4. Persist updated context
      await this.saveExecutionContext(result.context);

      // 5. Map AdvanceResult → VoiceEvent and re-dispatch
      const mappedEvent = this.mapAdvanceResultToEvent(result);
      // IMPORTANT: use _processEvent directly since we are already
      // inside the serialized dispatch queue — calling dispatch()
      // here would chain onto the same promise and deadlock.
      if (mappedEvent) {
        await this._processEvent(mappedEvent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this._processEvent({
        type: 'ERROR',
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        payload: { message: `Engine call failed: ${message}` },
      });
    }
  }

  /**
   * Map an AdvanceResult action to a FSM VoiceEvent.
   */
  private mapAdvanceResultToEvent(result: AdvanceResult): VoiceEvent | null {
    const now = new Date().toISOString();

    switch (result.action.type) {
      case 'speak':
        return {
          type: 'ENGINE_RESULT',
          sessionId: this.sessionId,
          timestamp: now,
          payload: {
            text: result.action.text,
            nodeId: result.action.nodeId,
            actionType: 'speak',
          },
        };

      case 'wait_for_input':
        return {
          type: 'ENGINE_RESULT',
          sessionId: this.sessionId,
          timestamp: now,
          payload: {
            actionType: 'wait_for_input',
            nodeId: result.action.nodeId,
          },
        };

      case 'wait_for_webhook':
        return {
          type: 'ENGINE_RESULT',
          sessionId: this.sessionId,
          timestamp: now,
          payload: {
            actionType: 'wait_for_webhook',
            nodeId: result.action.nodeId,
          },
        };

      case 'completed':
        return {
          type: 'SESSION_END',
          sessionId: this.sessionId,
          timestamp: now,
          payload: { reason: 'completed' },
        };

      case 'error':
        return {
          type: 'ERROR',
          sessionId: this.sessionId,
          timestamp: now,
          payload: { message: result.action.message },
        };

      case 'continue':
        // Should not occur — runWorkflowUntilWait handles this loop
        return null;

      default:
        return null;
    }
  }

  // ============================================
  // Internal: Session Persistence
  // ============================================

  /**
   * Load ExecutionContext from DB session metadata.
   * Follows the same pattern as functions.ts.
   */
  private async loadExecutionContext(): Promise<ExecutionContext | null> {
    const session = await this.prisma.workflowSession.findUnique({
      where: { id: this.sessionId },
    });

    if (!session?.metadata) {
      // No existing context — create initial one
      const now = new Date().toISOString();
      return {
        sessionId: this.sessionId,
        workflowId: this.workflowId,
        currentNodeId: null,
        variables: {},
        transcript: [],
        status: 'idle',
        createdAt: now,
        updatedAt: now,
      };
    }

    const metadata = session.metadata as unknown as SessionData;

    // Handle both new format (with context key) and old format
    if ('context' in metadata) {
      const ctx = metadata.context;
      return {
        ...ctx,
        variables: ctx.variables ?? {},
        transcript: ctx.transcript ?? [],
      };
    }

    // Old format — metadata is the context directly
    const ctx = metadata as unknown as ExecutionContext;
    const finalCtx = {
      ...ctx,
      variables: ctx.variables ?? {},
      transcript: ctx.transcript ?? [],
    };
    
    this.executionContext = finalCtx;
    return finalCtx;
  }

  /**
   * Persist updated ExecutionContext to DB.
   * Follows the same pattern as functions.ts.
   */
  private async saveExecutionContext(context: ExecutionContext): Promise<void> {
    const status =
      context.status === 'completed'
        ? 'COMPLETED'
        : context.status === 'error'
          ? 'ERROR'
          : 'ACTIVE';

    const sessionData: SessionData = {
      context,
      llmConfig: this.llmConfig,
    };

    this.executionContext = context;

    await this.prisma.workflowSession.update({
      where: { id: this.sessionId },
      data: {
        metadata: sessionData as object,
        status,
        endedAt:
          context.status === 'completed' ? new Date() : undefined,
      },
    });
  }

  // ============================================
  // Internal: TTS Abort Management
  // ============================================

  /**
   * Abort in-flight TTS. Idempotent — safe even if no TTS active.
   */
  private abortTTS(): void {
    if (this.ttsAbortController) {
      this.ttsAbortController.abort();
      this.ttsAbortController = null;
    }
  }

  // ============================================
  // Internal: SSE Notification
  // ============================================

  /**
   * Push current state to SSE listeners via sessionEmitter.
   */
  private notifyStateUpdate(): void {
    const fsmState = this.turnContext.state;
    const status =
      fsmState === 'IDLE' ? 'COMPLETED' : 'ACTIVE';

    sessionEmitter.notifyUpdate(this.sessionId, {
      sessionId: this.sessionId,
      status,
      fsmState,
      turnContext: { ...this.turnContext },
      context: this.executionContext,
    });

    // If FSM returned to IDLE, also notify completion
    if (fsmState === 'IDLE' && this.turnContext.sessionId === null) {
      sessionEmitter.notifyComplete(this.sessionId, status);
    }
  }
}
