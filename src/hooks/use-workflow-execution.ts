"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTRPC } from '@/lib/trpcClient';
import { useMutation } from '@tanstack/react-query';
import { type ExecutionContext } from '@/lib/engine/types';

export type WorkflowExecutionState = {
  sessionId: string | null;
  status: 'idle' | 'starting' | 'running' | 'waiting' | 'completed' | 'error';
  transcript: ExecutionContext['transcript'];
  variables: Record<string, unknown>;
  currentNodeId: string | null;
  error: string | null;
  pendingInputs: string[];
  lastSyncedUserMsgCount: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  language?: string;
  // Voice input configuration
  inputMode?: 'text' | 'voice';
  sttProvider?: string;
  // Voice FSM state (Listening, Thinking, Speaking)
  fsmState?: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'INTERRUPTED';
  // Webhook trigger configuration
  webhookSlug?: string;
  // Audio output from SPEAK node (for TTS playback)
  pendingAudio?: {
    audioBase64: string;
    mimeType: string;
    text: string;
  };
};

const INITIAL_STATE: WorkflowExecutionState = {
  sessionId: null,
  status: 'idle',
  transcript: [],
  variables: {},
  currentNodeId: null,
  error: null,
  pendingInputs: [],
  lastSyncedUserMsgCount: 0,
  connectionStatus: 'disconnected',
  fsmState: 'IDLE',
  language: undefined,
  inputMode: 'text',
  sttProvider: undefined,
  webhookSlug: undefined,
  pendingAudio: undefined,
};

type LLMConfig = {
  provider?: 'openai' | 'anthropic' | 'google' | 'mistral';
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
};

export function useWorkflowExecution(workflowId: string) {
  const [state, setState] = useState<WorkflowExecutionState>(INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trpc = useTRPC();

  // Safely get mutation options
  const startMutationOptions = trpc.workspaceSession?.start?.mutationOptions?.();
  const resumeMutationOptions = trpc.workspaceSession?.resume?.mutationOptions?.();

  // Mutations using TanStack Query
  const startMutation = useMutation(startMutationOptions ?? {
    mutationFn: async () => { throw new Error('Start mutation not available'); }
  });
  const resumeMutation = useMutation(resumeMutationOptions ?? {
    mutationFn: async () => { throw new Error('Resume mutation not available'); }
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Connect to SSE stream
  const connectSSE = useCallback((sessionId: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      if (eventSourceRef.current.readyState !== EventSource.CLOSED) {
        eventSourceRef.current.close();
      }
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }));

    const eventSource = new EventSource(`/api/workflow/${sessionId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      console.log('[SSE] Connected to session stream');
      setState(prev => ({ ...prev, connectionStatus: 'connected' }));
    });

    eventSource.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data);
        const ctx = data.context;
        const action = data.action;

        // Defensive check: if no context is provided (e.g. from reactive orchestrator),
        // we fallback to current state for context-dependent fields.
        if (!ctx) {
          setState(prev => ({
            ...prev,
            status: data.status?.toLowerCase() || prev.status,
            // If the message has an action, we might want to capture it
            ...(action?.type === 'speak' ? {
              pendingAudio: {
                audioBase64: action.audioBase64,
                mimeType: action.mimeType,
                text: action.text,
              }
            } : {})
          }));
          return;
        }

        setState((prev) => {
          console.log('[SSE] Processing update:', { status: data.status, fsm: data.fsmState, msgs: ctx.transcript?.length });
          
          let syncedTranscript = [...(ctx.transcript || [])];
          
          // If we have a turnContext with a transcript that isn't in ctx yet, 
          // add it optimistically. (e.g. while engine is THINKING)
          const latestVoiceTranscript = data.turnContext?.lastTranscript;
          if (latestVoiceTranscript && !syncedTranscript.some((m: any) => m.text === latestVoiceTranscript)) {
            syncedTranscript.push({
              role: 'user' as const,
              text: latestVoiceTranscript,
              timestamp: new Date().toISOString(),
              isOptimistic: true
            });
          }

          const serverUserMsgs = syncedTranscript.filter((m: any) => m.role === 'user');
          
          const newServerUserMsgs = serverUserMsgs.slice(prev.lastSyncedUserMsgCount);
          const pendingInputs = prev.pendingInputs;
          let matchedCount = 0;
          
          let searchIdx = 0;
          for (const input of pendingInputs) {
            let foundIndex = -1;
            for (let i = searchIdx; i < newServerUserMsgs.length; i++) {
              if (newServerUserMsgs[i].text === input) {
                foundIndex = i;
                break;
              }
            }
            if (foundIndex !== -1) {
              matchedCount++;
              searchIdx = foundIndex + 1;
            } else {
              break;
            }
          }
          
          const remainingPending = pendingInputs.slice(matchedCount);
          const newTranscript = [
            ...syncedTranscript,
            ...remainingPending.map((text: string) => ({
              role: 'user' as const,
              text,
              timestamp: new Date().toISOString()
            }))
          ];

          // Extract voice input config from action (for LISTEN nodes)
          let inputMode = prev.inputMode;
          let sttProvider = prev.sttProvider;
          let language = prev.language;
          let pendingAudio = prev.pendingAudio;
          
          if (action?.type === 'wait_for_input') {
            inputMode = action.inputMode || 'text';
            sttProvider = action.sttProvider;
            language = action.language || 'eng';
          }

          let webhookSlug = prev.webhookSlug;
          if (action?.type === 'wait_for_webhook') {
            webhookSlug = action.slug;
          }

          // Capture audio from SPEAK nodes for TTS playback
          // ONLY update pendingAudio if we actually get a speak action
          // Don't clear it on other updates (like progress updates)
          if (action?.type === 'speak' && action.audioBase64 && action.mimeType) {
            pendingAudio = {
              audioBase64: action.audioBase64,
              mimeType: action.mimeType,
              text: action.text,
            };
          }

          return {
            ...prev,
            transcript: newTranscript,
            variables: ctx.variables || prev.variables,
            currentNodeId: ctx.currentNodeId,
            status: ctx.status as WorkflowExecutionState['status'],
            error: ctx.error || null,
            pendingInputs: remainingPending,
            lastSyncedUserMsgCount: serverUserMsgs.length,
            // Voice input configuration
            inputMode,
            sttProvider,
            language,
            webhookSlug,
            // TTS audio output
            pendingAudio,
            fsmState: data.fsmState || prev.fsmState,
          };
        });
      } catch (error) {
        console.error('[SSE] Failed to parse update:', error);
      }
    });

    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Workflow completed:', data.status);
        setState(prev => ({ 
          ...prev, 
          status: data.status === 'COMPLETED' ? 'completed' : 'error',
          connectionStatus: 'disconnected' 
        }));
        eventSource.close();
        eventSourceRef.current = null;
      } catch (error) {
        console.error('[SSE] Failed to parse complete event:', error);
      }
    });

    eventSource.addEventListener('error', (event) => {
      // Stream error handle
      console.warn('[SSE] Periodic connection blip or server reset');
      setState(prev => ({ ...prev, connectionStatus: 'error' }));
    });

    eventSource.onerror = () => {
      const currentStatus = stateRef.current.status;
      // Auto-reconnect after 2 seconds if session is still active
      if (currentStatus === 'running' || currentStatus === 'waiting') {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            console.log('[SSE] Attempting to reconnect...');
            connectSSE(sessionId);
          }
        }, 3000);
      }
    };

    return eventSource;
  }, []); // No dependencies - very stable

  // Disconnect SSE
  const disconnectSSE = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSSE();
    };
  }, [disconnectSSE]);

  // Start workflow execution
  const start = useCallback(async (llmConfig?: LLMConfig) => {
    setState((prev) => ({ ...prev, status: 'starting', error: null }));
    
    try {
      const result = await startMutation.mutateAsync({
        workflowId,
        llmConfig,
      });
      
      setState((prev) => ({
        ...prev,
        sessionId: result.sessionId,
        status: 'running',
        lastSyncedUserMsgCount: 0,
        pendingInputs: []
      }));

      // Connect to SSE stream for real-time updates
      setTimeout(() => connectSSE(result.sessionId), 300);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to start workflow',
      }));
    }
  }, [workflowId, startMutation, connectSSE]);

  // Send user input
  const sendInput = useCallback(async (userInput: string) => {
    if (!state.sessionId) {
      console.error('No active session');
      return;
    }
    
    // Optimistically add user message to transcript and pending queue
    setState((prev) => ({
      ...prev,
      status: 'running',
      pendingInputs: [...prev.pendingInputs, userInput],
      transcript: [
        ...prev.transcript,
        {
          role: 'user' as const,
          text: userInput,
          timestamp: new Date().toISOString(),
        },
      ],
    }));

    try {
      await resumeMutation.mutateAsync({
        sessionId: state.sessionId,
        userInput,
      });
      
      // Reconnect SSE if disconnected
      if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
        connectSSE(state.sessionId);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to send input',
      }));
    }
  }, [state.sessionId, resumeMutation, connectSSE]);

  // Reset the execution state
  const reset = useCallback(() => {
    disconnectSSE();
    setState(INITIAL_STATE);
  }, [disconnectSSE]);

  // Clear pending audio after playback
  const clearPendingAudio = useCallback(() => {
    setState((prev) => ({ ...prev, pendingAudio: undefined }));
  }, []);

  return {
    state,
    start,
    sendInput,
    reset,
    clearPendingAudio,
    isLoading: startMutation.isPending || resumeMutation.isPending,
  };
}
