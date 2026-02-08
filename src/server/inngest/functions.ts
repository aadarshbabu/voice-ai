import { inngest } from './client';
import { prisma } from '@/lib/prisma';
import { runWorkflowUntilWait } from '@/lib/engine/runner';
import { type ExecutionContext, type LLMConfig } from '@/lib/engine/types';
import { sessionEmitter } from '@/lib/engine/session-emitter';
import { type Node, type Edge } from '@xyflow/react';

// Extended context that includes LLM config for persistence
interface SessionData {
  context: ExecutionContext;
  llmConfig?: Partial<LLMConfig>;
}

// ============================================
// Helper: Create initial execution context
// ============================================

function createInitialContext(sessionId: string, workflowId: string): ExecutionContext {
  const now = new Date().toISOString();
  return {
    sessionId,
    workflowId,
    currentNodeId: null,
    variables: {},
    transcript: [],
    status: 'idle',
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================
// Helper: Normalize context from DB (handle null values)
// ============================================

function normalizeContext(ctx: ExecutionContext): ExecutionContext {
  return {
    ...ctx,
    variables: ctx.variables ?? {},
    transcript: ctx.transcript ?? [],
  };
}

// ============================================
// Helper: Save execution trace
// ============================================

async function saveTrace(
  sessionId: string,
  nodeId: string,
  inputVars: Record<string, unknown>,
  outputData: Record<string, unknown>
) {
  await prisma.executionTrace.create({
    data: {
      sessionId,
      nodeId,
      inputVariables: inputVars as object,
      outputData: outputData as object,
      logs: [],
    },
  });
}

// ============================================
// Execute Workflow - Runs until waiting for input, then saves state and exits
// ============================================

export const executeWorkflow = inngest.createFunction(
  { id: 'workflow-execute', name: 'Execute Workflow' },
  { event: 'workflow/execute' },
  async ({ event, step }) => {
    const { sessionId, workflowId, userInput, llmConfig: eventLlmConfig } = event.data as {
      sessionId: string;
      workflowId: string;
      userInput?: string;
      llmConfig?: Partial<LLMConfig>;
    };

    // Step 1: Load workflow definition
    const workflow = await step.run('load-workflow', async () => {
      const wf = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });
      if (!wf) throw new Error(`Workflow ${workflowId} not found`);
      return wf;
    });

    const nodes = workflow.nodes as unknown as Node[];
    const edges = workflow.edges as unknown as Edge[];

    // Step 2: Load or initialize context and llmConfig
    const sessionData = await step.run('load-context', async () => {
      const session = await prisma.workflowSession.findUnique({
        where: { id: sessionId },
      });

      if (session?.metadata && typeof session.metadata === 'object') {
        // Resume from saved context - metadata stores both context and llmConfig
        const metadata = session.metadata as unknown as SessionData;
        
        // Check if metadata has new structure (with llmConfig) or old structure (just context)
        if ('context' in metadata) {
          return {
            context: normalizeContext(metadata.context),
            llmConfig: metadata.llmConfig ?? eventLlmConfig,
          };
        } else {
          // Old format - metadata is the context directly
          return {
            context: normalizeContext(metadata as unknown as ExecutionContext),
            llmConfig: eventLlmConfig,
          };
        }
      }

      // Create new context
      return {
        context: createInitialContext(sessionId, workflowId),
        llmConfig: eventLlmConfig,
      };
    });

    let context = sessionData.context;
    const llmConfig = sessionData.llmConfig;

    // Step 3: Run workflow until we need user input or complete
    const result = await step.run('advance-workflow', async () => {
      const enhancedLlmConfig: Partial<LLMConfig> = {
        ...llmConfig,
        userId: workflow.userId,
      };

      const onProgress = async (currentCtx: ExecutionContext) => {
        // Find session for current status
        const status = currentCtx.status === 'completed' ? 'COMPLETED' :
                      currentCtx.status === 'error' ? 'ERROR' : 'ACTIVE';
                      
        sessionEmitter.notifyUpdate(sessionId, {
          sessionId,
          status,
          context: currentCtx,
        });
      };
      
      return runWorkflowUntilWait(nodes, edges, context, userInput, enhancedLlmConfig, onProgress);
    });

    context = result.context;

    // Step 4: Save context AND llmConfig to database for resumption
    await step.run('save-context', async () => {
      const status = result.context.status === 'completed' ? 'COMPLETED' :
                    result.context.status === 'error' ? 'ERROR' : 'ACTIVE';
      
      // Store both context and llmConfig in metadata
      const sessionData: SessionData = {
        context: result.context,
        llmConfig,
      };

      await prisma.workflowSession.update({
        where: { id: sessionId },
        data: {
          metadata: sessionData as object,
          status,
          endedAt: result.context.status === 'completed' ? new Date() : undefined,
        },
      });

      // Save trace for speak actions
      if (result.action.type === 'speak') {
        await saveTrace(sessionId, result.action.nodeId, {}, { text: result.action.text });
      }

      // NO POLLING: Notify the SSE stream instantly
      sessionEmitter.notifyUpdate(sessionId, {
        sessionId,
        status,
        context: result.context,
        // Include action details so frontend can access inputMode, sttProvider, language
        action: result.action,
      });

      if (status === 'COMPLETED' || status === 'ERROR') {
        sessionEmitter.notifyComplete(sessionId, status);
      }
    });

    // Step 5: Return result - function ends here!
    // When user sends input, a new 'workflow/execute' event will be sent
    // which will load the saved context and llmConfig and continue
    return {
      status: result.context.status,
      action: result.action.type,
      sessionId,
      context: result.context,
    };
  }
);

// ============================================
// Export all functions for registration
// ============================================

export const functions = [executeWorkflow];
