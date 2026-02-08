import { type Node, type Edge } from '@xyflow/react';
import { NODE_TYPES } from '@/types/nodes';
import { 
  type ExecutionContext, 
  type AdvanceResult,
  type SpeakNodeData,
  type ListenNodeData,
  type LLMReplyNodeData,
  type LLMDecisionNodeData,
  type ToolNodeData,
  type AIAgentNodeData,
  type AgentTool,
  type LLMConfig,
} from './types';
import { callLLM, callLLMDecision } from './providers/llm';
import { textToSpeech } from './providers/voice';
import { executeToolNodeRequest, getNestedValue } from './http-client';

function interpolateTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const trimmedKey = key.trim();
    
    // Support {{key || fallback}}
    const parts = trimmedKey.split('||');
    const path = parts[0].trim();
    const fallback = parts.length > 1 ? parts[1].trim() : '';

    const value = getNestedValue(variables, path);

    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

// ============================================
// Build conversation context for LLM
// ============================================

function buildConversationContext(transcript: ExecutionContext['transcript']): string {
  if (transcript.length === 0) return 'No conversation history yet.';
  
  return transcript
    .map((msg) => `${msg.role === 'agent' ? 'Assistant' : 'User'}: ${msg.text}`)
    .join('\n');
}

// ============================================
// Core Engine - Async version for real LLM calls
// ============================================

export async function advanceWorkflowAsync(
  nodes: Node[],
  edges: Edge[],
  context: ExecutionContext,
  input?: string,
  llmConfig?: Partial<LLMConfig>,
  onProgress?: (ctx: ExecutionContext) => Promise<void>
): Promise<AdvanceResult> {
  // Ensure context properties are initialized (might be null from DB)
  const currentNodeId = context.currentNodeId;
  const variables = context.variables ?? {};
  const transcript = context.transcript ?? [];
  const now = new Date().toISOString();

  // Initial state - find trigger node
  if (!currentNodeId) {
    const trigger = nodes.find((n) => n.type === NODE_TYPES.TRIGGER);
    if (!trigger) {
      return {
        context: { ...context, status: 'error', error: 'No trigger node found', updatedAt: now },
        action: { type: 'error', message: 'No trigger node found' },
      };
    }
    return {
      context: { ...context, currentNodeId: trigger.id, status: 'running', updatedAt: now },
      action: { type: 'continue' },
    };
  }

  const currentNode = nodes.find((n) => n.id === currentNodeId);
  if (!currentNode) {
    return {
      context: { ...context, status: 'error', error: 'Current node not found', updatedAt: now },
      action: { type: 'error', message: 'Current node not found' },
    };
  }

  const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
  const getNextNodeId = (handle?: string) => {
    const edge = handle 
      ? outgoingEdges.find((e) => e.sourceHandle === handle) 
      : outgoingEdges[0];
    return edge?.target || null;
  };

  switch (currentNode.type) {
    // =====================
    // TRIGGER Node
    // =====================
    case NODE_TYPES.TRIGGER: {
      const nextNodeId = getNextNodeId();
      if (!nextNodeId) {
        return {
          context: { ...context, status: 'completed', updatedAt: now },
          action: { type: 'completed' },
        };
      }
      return {
        context: { ...context, currentNodeId: nextNodeId, status: 'running', updatedAt: now },
        action: { type: 'continue' },
      };
    }

    // =====================
    // SPEAK Node - Outputs text, optionally with TTS audio
    // =====================
    case NODE_TYPES.SPEAK: {
      const nodeData = currentNode.data as unknown as SpeakNodeData;
      const text = nodeData?.text || '';
      const voiceMode = nodeData?.voiceMode || 'text';
      const interpolatedText = interpolateTemplate(text, variables);
      const nextNodeId = getNextNodeId();

      // Generate TTS audio if voice mode is enabled
      let audioBase64: string | undefined;
      let mimeType: string | undefined;

      if (voiceMode === 'tts' && llmConfig?.userId && interpolatedText.trim()) {
        try {
          const ttsResult = await textToSpeech(interpolatedText, llmConfig.userId, {
            voiceId: nodeData.voiceId,
            speed: nodeData.speed,
            language: nodeData.language,
          });

          if (ttsResult.success) {
            audioBase64 = ttsResult.audioBase64;
            mimeType = ttsResult.mimeType;
          } else {
            console.warn('[Speak Node] TTS failed:', ttsResult.error);
          }
        } catch (error) {
          console.error('[Speak Node] TTS error:', error);
        }
      }

      console.log(`[Speak Node] Executing with interpolated text: "${interpolatedText.substring(0, 50)}...", Audio success: ${!!audioBase64}`);

      const newTranscript = [
        ...transcript,
        { 
          role: 'agent' as const, 
          text: interpolatedText, 
          nodeId: currentNodeId, 
          timestamp: now,
          audioBase64,
          mimeType,
        },
      ];

      return {
        context: {
          ...context,
          transcript: newTranscript,
          currentNodeId: nextNodeId,
          status: nextNodeId ? 'running' : 'completed',
          updatedAt: now,
        },
        action: { 
          type: 'speak', 
          text: interpolatedText, 
          nodeId: currentNodeId,
          audioBase64,
          mimeType,
        },
      };
    }

    // =====================
    // LISTEN Node - Waits for user input (text or voice)
    // =====================
    case NODE_TYPES.LISTEN: {
      const nodeData = currentNode.data as unknown as ListenNodeData;
      const inputMode = nodeData?.inputMode || 'text';
      const sttProvider = nodeData?.sttProvider;
      const language = nodeData?.language || 'eng'; // ISO 639-3 for ElevenLabs

      if (!input) {
        return {
          context: { ...context, status: 'waiting', updatedAt: now },
          action: { 
            type: 'wait_for_input', 
            nodeId: currentNodeId,
            inputMode,  // Tell frontend whether to show text input or voice capture
            sttProvider, // Tell frontend which STT provider to use
            language, // Tell frontend which language to use for STT
          },
        };
      }

      const varName = nodeData?.variableName || 'user_input';
      const nextNodeId = getNextNodeId();

      const newTranscript = [
        ...transcript,
        { role: 'user' as const, text: input, nodeId: currentNodeId, timestamp: now },
      ];

      return {
        context: {
          ...context,
          variables: { ...variables, [varName]: input },
          transcript: newTranscript,
          currentNodeId: nextNodeId,
          status: nextNodeId ? 'running' : 'completed',
          updatedAt: now,
        },
        action: { type: 'continue' },
      };
    }

    // =====================
    // LLM_REPLY Node - Generates AI response
    // =====================
    case NODE_TYPES.LLM_REPLY: {
      const nodeData = currentNode.data as unknown as LLMReplyNodeData;
      const systemPrompt = nodeData?.systemPrompt || 'You are a helpful assistant.';
      const userPromptTemplate = nodeData?.userPromptTemplate || '{{user_input}}';
      const saveAs = nodeData?.saveAs || 'ai_reply';
      
      // Build context with conversation history
      const conversationContext = buildConversationContext(transcript);
      
      let userPrompt = interpolateTemplate(userPromptTemplate, {
        ...variables,
        conversation_history: conversationContext,
      });

      // Implicitly add conversation history if not explicitly used in template
      const isHistoryUsed = userPromptTemplate.includes('conversation_history');
      if (!isHistoryUsed && transcript.length > 0) {
         // Logic to prepend history if not present.
         // We verify if the generated userPrompt (which is based on the template) already contains history.
         // If the template was just "{{user_input}}", userPrompt is now just the input.
         // We prepend the full context.
         userPrompt = `${conversationContext}\n\n(Current Input): ${userPrompt}`;
      }

      // Merge node-level config with passed config
      const mergedConfig: Partial<LLMConfig> = {
        ...nodeData?.llmConfig,
        ...llmConfig,
      };

      try {
        const aiResponse = await callLLM({
          systemPrompt,
          userPrompt,
          config: mergedConfig,
        });

        const nextNodeId = getNextNodeId();
        const nextNode = nodes.find(n => n.id === nextNodeId);
        const isFollowedBySpeak = nextNode?.type === NODE_TYPES.SPEAK;

        const newTranscript = isFollowedBySpeak ? transcript : [
          ...transcript,
          { role: 'agent' as const, text: aiResponse, nodeId: currentNodeId, timestamp: now },
        ];

        return {
          context: {
            ...context,
            variables: { ...variables, [saveAs]: aiResponse },
            transcript: newTranscript,
            currentNodeId: nextNodeId,
            status: nextNodeId ? 'running' : 'completed',
            updatedAt: now,
          },
          action: { type: 'continue' },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'LLM call failed';
        return {
          context: { ...context, status: 'error', error: errorMessage, updatedAt: now },
          action: { type: 'error', message: errorMessage },
        };
      }
    }

    // =====================
    // LLM_DECISION Node - Routes based on AI decision
    // =====================
    case NODE_TYPES.LLM_DECISION: {
      const nodeData = currentNode.data as unknown as LLMDecisionNodeData;
      const systemPrompt = nodeData?.systemPrompt || 'You are a decision-making assistant.';
      const userPromptTemplate = nodeData?.userPromptTemplate || '{{user_input}}';
      const outcomes = (nodeData?.outcomes || []).map((o) => o.value);

      if (outcomes.length === 0) {
        return {
          context: { ...context, status: 'error', error: 'No outcomes defined', updatedAt: now },
          action: { type: 'error', message: 'No outcomes defined for LLM Decision node' },
        };
      }

      const conversationContext = buildConversationContext(transcript);
      const userPrompt = interpolateTemplate(userPromptTemplate, {
        ...variables,
        conversation_history: conversationContext,
      });

      console.log(`[LLM Decision] System: "${systemPrompt.substring(0, 80)}..."`);
      console.log(`[LLM Decision] User Prompt: "${userPrompt.substring(0, 100)}..."`);
      console.log(`[LLM Decision] Outcomes: [${outcomes.join(', ')}]`);

      const mergedConfig: Partial<LLMConfig> = {
        ...nodeData?.llmConfig,
        ...llmConfig,
      };

      try {
        const decision = await callLLMDecision({
          systemPrompt,
          userPrompt,
          outcomes,
          config: mergedConfig,
        });

        console.log(`[LLM Decision] LLM decided: "${decision}"`);

        const nextNodeId = getNextNodeId(decision);
        
        if (!nextNodeId) {
          console.warn(`[LLM Decision] No edge found for decision "${decision}" - completing workflow`);
          return {
            context: { ...context, status: 'completed', updatedAt: now },
            action: { type: 'completed' },
          };
        }

        console.log(`[LLM Decision] Following edge "${decision}" to node ${nextNodeId}`);

        return {
          context: {
            ...context,
            variables: { ...variables, last_decision: decision },
            currentNodeId: nextNodeId,
            status: 'running',
            updatedAt: now,
          },
          action: { type: 'continue' },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'LLM decision failed';
        return {
          context: { ...context, status: 'error', error: errorMessage, updatedAt: now },
          action: { type: 'error', message: errorMessage },
        };
      }
    }

    // =====================
    // TOOL Node - N8N-style HTTP Request execution
    // =====================
    case NODE_TYPES.TOOL: {
      const nodeData = currentNode.data as unknown as ToolNodeData;
      const outputVar = nodeData?.outputVar || 'http_response';

      // Validate URL is configured
      if (!nodeData?.url) {
        return {
          context: { ...context, status: 'error', error: 'HTTP Request URL is required', updatedAt: now },
          action: { type: 'error', message: 'HTTP Request URL is not configured' },
        };
      }

      try {
        const result = await executeToolNodeRequest(nodeData, variables);

        if (!result.success) {
          return {
            context: { 
              ...context, 
              status: 'error', 
              error: result.error || 'HTTP request failed', 
              updatedAt: now 
            },
            action: { type: 'error', message: result.error || 'HTTP request failed' },
          };
        }

        const nextNodeId = getNextNodeId();

        return {
          context: {
            ...context,
            variables: { ...variables, [outputVar]: result.data },
            currentNodeId: nextNodeId,
            status: nextNodeId ? 'running' : 'completed',
            updatedAt: now,
          },
          action: { type: 'continue' },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'HTTP request failed';
        return {
          context: { ...context, status: 'error', error: errorMessage, updatedAt: now },
          action: { type: 'error', message: errorMessage },
        };
      }
    }

    // =====================
    // AI_AGENT Node - Intelligent agent with tool calling
    // =====================
    case NODE_TYPES.AI_AGENT: {
      const nodeData = currentNode.data as unknown as AIAgentNodeData;
      const saveAs = nodeData?.saveAs || 'agent_response';
      const tools = nodeData?.tools || [];
      const maxIterations = nodeData?.maxIterations || 3;

      // Build system prompt with tool descriptions
      let systemPromptWithTools = nodeData?.systemPrompt || 'You are an intelligent AI agent.';
      
      if (tools.length > 0) {
        systemPromptWithTools += '\n\n## Available Tools\n';
        tools.forEach((tool: AgentTool) => {
          systemPromptWithTools += `\n### ${tool.name}\n`;
          systemPromptWithTools += `Description: ${tool.description}\n`;
          if (tool.parameters && tool.parameters.length > 0) {
            systemPromptWithTools += `Parameters:\n`;
            tool.parameters.forEach((param) => {
              systemPromptWithTools += `  - ${param.name} (${param.type}${param.required ? ', required' : ''}): ${param.description}\n`;
            });
          }
        });
        systemPromptWithTools += '\n\nTo use a tool, respond ONLY with a JSON object in this exact format:\n';
        systemPromptWithTools += '{"tool": "tool_name", "parameters": {"param_name": "value"}}\n\n';
        systemPromptWithTools += 'If no tool is needed, respond normally with your answer.';
      }

      // Build user prompt with variables
      const userPromptTemplate = nodeData?.userPromptTemplate || '{{user_input}}';
      const enhancedVariables = {
        ...variables,
        conversation_history: buildConversationContext(transcript),
      };
      const userPrompt = interpolateTemplate(userPromptTemplate, enhancedVariables);

      // Merge LLM config
      const effectiveLLMConfig = {
        provider: llmConfig?.provider || nodeData?.llmConfig?.provider || 'openai',
        model: llmConfig?.model || nodeData?.llmConfig?.model || 'gpt-4o-mini',
        apiKey: llmConfig?.apiKey || nodeData?.llmConfig?.apiKey,
        userId: llmConfig?.userId || nodeData?.llmConfig?.userId,
        temperature: nodeData?.llmConfig?.temperature ?? 0.7,
        maxTokens: nodeData?.llmConfig?.maxTokens ?? 1000,
      };

      try {
        let iteration = 0;
        let finalResponse = '';
        let toolResults: Record<string, any> = {};
        let currentContext = userPrompt;

        // Agent loop - keep calling LLM until it gives a non-tool response or max iterations
        while (iteration < maxIterations) {
          iteration++;
          
          const llmResponse = await callLLM({
            systemPrompt: systemPromptWithTools,
            userPrompt: currentContext + (Object.keys(toolResults).length > 0 
              ? `\n\nTool results from previous calls:\n${JSON.stringify(toolResults, null, 2)}` 
              : ''),
            config: effectiveLLMConfig,
          });

          // Check if response is a tool call (JSON with "tool" key)
          let isToolCall = false;
          let parsedToolCall: { tool: string; parameters?: Record<string, any> } | null = null;
          
          try {
            let jsonStr = llmResponse.trim();
            
            // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
              jsonStr = codeBlockMatch[1].trim();
            }
            
            console.log(`[AI Agent] Response: "${llmResponse.substring(0, 100)}...", Extracted JSON: "${jsonStr.substring(0, 100)}..."`);
            
            if (jsonStr.startsWith('{') && jsonStr.includes('"tool"')) {
              parsedToolCall = JSON.parse(jsonStr);
              isToolCall = !!parsedToolCall?.tool;
              console.log(`[AI Agent] Tool call detected: ${parsedToolCall?.tool}`);
            }
          } catch (e) {
            // Not JSON, so it's a regular response
            console.log(`[AI Agent] Not a tool call, treating as final response`);
            isToolCall = false;
          }

          if (isToolCall && parsedToolCall) {
            // Find the tool
            const tool = tools.find((t: AgentTool) => t.name === parsedToolCall!.tool);
            
            if (!tool) {
              // Tool not found, ask LLM to try again
              console.warn(`[AI Agent] Tool "${parsedToolCall.tool}" not found. Available: ${tools.map((t: AgentTool) => t.name).join(', ')}`);
              currentContext = `The tool "${parsedToolCall.tool}" was not found. Available tools: ${tools.map((t: AgentTool) => t.name).join(', ')}. Please try again.`;
              continue;
            }

            console.log(`[AI Agent] Executing tool: ${tool.name}, URL: ${tool.url}`);

            // Execute the tool (HTTP request)
            const toolParams = parsedToolCall.parameters || {};
            const toolVariables = { ...variables, ...toolParams };
            
            const toolResult = await executeToolNodeRequest({
              method: tool.method || 'GET',
              url: tool.url,
              headers: tool.headers,
              body: tool.body,
              outputVar: 'result',
              responsePath: tool.responsePath,
            }, toolVariables);

            console.log(`[AI Agent] Tool result: success=${toolResult.success}, data=${JSON.stringify(toolResult.data || toolResult.error).substring(0, 200)}`);

            if (toolResult.success) {
              toolResults[tool.name] = toolResult.data;
              currentContext = userPrompt; // Continue with original context + tool results
            } else {
              toolResults[tool.name] = { error: toolResult.error };
              currentContext = userPrompt;
            }
          } else {
            // Regular response, we're done
            finalResponse = llmResponse;
            break;
          }
        }

        // If we exhausted iterations, ask for final response
        if (!finalResponse) {
          finalResponse = await callLLM({
            systemPrompt: 'Based on the tool results, provide a final response to the user.',
            userPrompt: `Original request: ${userPrompt}\n\nTool results:\n${JSON.stringify(toolResults, null, 2)}`,
            config: effectiveLLMConfig,
          });
        }

        const nextNodeId = getNextNodeId();
        const nextNode = nodes.find(n => n.id === nextNodeId);
        const isFollowedBySpeak = nextNode?.type === NODE_TYPES.SPEAK;

        const newTranscript = isFollowedBySpeak ? transcript : [
          ...transcript,
          { 
            role: 'agent' as const, 
            text: finalResponse, 
            nodeId: currentNode.id, 
            timestamp: now 
          }
        ];

        return {
          context: {
            ...context,
            variables: { 
              ...variables, 
              [saveAs]: finalResponse,
              [`${saveAs}_tool_results`]: toolResults 
            },
            transcript: newTranscript,
            currentNodeId: nextNodeId,
            status: nextNodeId ? 'running' : 'completed',
            updatedAt: now,
          },
          action: { type: 'continue' },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'AI Agent execution failed';
        return {
          context: { ...context, status: 'error', error: errorMessage, updatedAt: now },
          action: { type: 'error', message: errorMessage },
        };
      }
    }

    // =====================
    // END Node
    // =====================
    case NODE_TYPES.END: {
      return {
        context: { ...context, status: 'completed', updatedAt: now },
        action: { type: 'completed' },
      };
    }

    default:
      return {
        context: { ...context, status: 'error', error: `Unknown node type: ${currentNode.type}`, updatedAt: now },
        action: { type: 'error', message: `Unknown node type: ${currentNode.type}` },
      };
  }
}

// ============================================
// Run workflow until wait or completion
// ============================================

export async function runWorkflowUntilWait(
  nodes: Node[],
  edges: Edge[],
  initialContext: ExecutionContext,
  input?: string,
  llmConfig?: Partial<LLMConfig>,
  onProgress?: (ctx: ExecutionContext) => Promise<void>
): Promise<AdvanceResult> {
  let currentContext = { ...initialContext };
  let userInput = input;
  let steps = 0;
  const maxSteps = 50;

  while (steps < maxSteps) {
    const result = await advanceWorkflowAsync(
      nodes, 
      edges, 
      currentContext, 
      userInput, 
      llmConfig,
      onProgress
    );
    
    currentContext = result.context;
    userInput = undefined; // Use input only for the first 'listen' node encountered
    steps++;

    // Notify progress for every node execution
    if (onProgress) {
        await onProgress(currentContext);
    }

    // Stop conditions: only stop if we explicitly need to wait, or we are finished/errored
    if (result.action.type === 'wait_for_input' || 
        result.action.type === 'completed' || 
        result.action.type === 'error') {
      return result;
    }

    // For 'speak' or other yield-style actions, we notify and continue
    // unless there is no next node (which advanceWorkflowAsync handles by setting status to completed)
    if (result.context.status === 'completed' || result.context.status === 'error') {
        return result;
    }
    
    // Continue will loop back and use result.context.currentNodeId to advance
  }

  return {
    context: { ...currentContext, status: 'error', error: 'Max steps exceeded' },
    action: { type: 'error', message: 'Workflow exceeded maximum steps' },
  };
}
