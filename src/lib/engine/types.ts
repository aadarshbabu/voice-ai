import { z } from 'zod';

// ============================================
// Execution Context - The heart of state management
// ============================================

export const ExecutionContextSchema = z.object({
  sessionId: z.string(),
  workflowId: z.string(),
  currentNodeId: z.string().nullable(),
  variables: z.record(z.string(), z.unknown()),
  transcript: z.array(z.object({
    role: z.enum(['agent', 'user']),
    text: z.string(),
    nodeId: z.string().optional(),
    timestamp: z.string(),
    // TTS audio data for agent messages
    audioBase64: z.string().optional(),
    mimeType: z.string().optional(),
  })),
  status: z.enum(['idle', 'running', 'waiting', 'completed', 'error']),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

// ============================================
// Node Configuration Schemas
// ============================================

export const SpeakNodeDataSchema = z.object({
  text: z.string().default(''),
  voiceId: z.string().optional(),
  // Voice mode: 'text' = just display text, 'tts' = generate audio
  voiceMode: z.enum(['text', 'tts']).default('tts'), // TTS enabled by default
  ttsProvider: z.enum(['elevenlabs', 'google']).optional(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  language: z.string().default('eng'), // ISO 639-3
});

export const ListenNodeDataSchema = z.object({
  variableName: z.string().default('user_input'),
  timeout: z.number().default(30000), // 30 seconds
  silenceTimeout: z.number().default(3000), // 3 seconds
  // Input mode: 'text' = text input, 'stt' = voice with transcription
  inputMode: z.enum(['text', 'stt']).default('text'),
  sttProvider: z.enum(['elevenlabs', 'deepgram', 'google']).optional(),
  language: z.string().default('eng'), // ISO 639-3 for ElevenLabs
});

export const LLMConfigSchema = z.object({
  provider: z.string().default('openai'),
  model: z.string().default('gpt-4o-mini'),
  apiKey: z.string().optional(), // Will use env var if not provided
  userId: z.string().optional(), // For DB verification
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(1000),
});

export const LLMReplyNodeDataSchema = z.object({
  systemPrompt: z.string().default('You are a helpful assistant.'),
  userPromptTemplate: z.string().default('{{user_input}}'),
  saveAs: z.string().default('ai_reply'),
  llmConfig: LLMConfigSchema.optional(),
});

export const LLMDecisionNodeDataSchema = z.object({
  systemPrompt: z.string().default('You are a decision-making assistant.'),
  userPromptTemplate: z.string().default('Based on the conversation, decide the next action.'),
  outcomes: z.array(z.object({
    value: z.string(),
    description: z.string().optional(),
  })).default([]),
  llmConfig: LLMConfigSchema.optional(),
});

export const ToolNodeDataSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  url: z.string().default(''), // Supports {{variable}} interpolation
  headers: z.array(z.object({ 
    key: z.string(), 
    value: z.string() 
  })).default([]),
  body: z.string().optional(), // JSON template with {{variables}} for POST/PUT/PATCH
  outputVar: z.string().default('http_response'),
  responsePath: z.string().optional(), // JSONPath-like extraction e.g., "data.items[0].title"
});

// Agent Tool definition - tools that AI Agent can call
export const AgentToolSchema = z.object({
  id: z.string(),
  name: z.string(), // Tool name for LLM to understand
  description: z.string(), // What this tool does
  parameters: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean']),
    description: z.string(),
    required: z.boolean().default(true),
  })).default([]),
  // HTTP configuration
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  url: z.string(), // Can use {{param_name}} for tool parameters
  headers: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  body: z.string().optional(),
  responsePath: z.string().optional(),
});

// AI Agent Node - combines LLM reasoning with tool calling
export const AIAgentNodeDataSchema = z.object({
  systemPrompt: z.string().default('You are an intelligent AI agent with access to tools.'),
  userPromptTemplate: z.string().default('{{user_input}}'),
  tools: z.array(AgentToolSchema).default([]),
  maxIterations: z.number().default(3), // Max tool calls before final response
  saveAs: z.string().default('agent_response'),
  llmConfig: LLMConfigSchema.optional(),
});

export type SpeakNodeData = z.infer<typeof SpeakNodeDataSchema>;
export type ListenNodeData = z.infer<typeof ListenNodeDataSchema>;
export type LLMReplyNodeData = z.infer<typeof LLMReplyNodeDataSchema>;
export type LLMDecisionNodeData = z.infer<typeof LLMDecisionNodeDataSchema>;
export type ToolNodeData = z.infer<typeof ToolNodeDataSchema>;
export type AgentTool = z.infer<typeof AgentToolSchema>;
export type AIAgentNodeData = z.infer<typeof AIAgentNodeDataSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// ============================================
// Workflow Events for Inngest
// ============================================

export const WorkflowExecuteEventSchema = z.object({
  name: z.literal('workflow/execute'),
  data: z.object({
    sessionId: z.string(),
    workflowId: z.string(),
  }),
});

export const WorkflowResumeEventSchema = z.object({
  name: z.literal('workflow/resume'),
  data: z.object({
    sessionId: z.string(),
    userInput: z.string(),
  }),
});

export type WorkflowExecuteEvent = z.infer<typeof WorkflowExecuteEventSchema>;
export type WorkflowResumeEvent = z.infer<typeof WorkflowResumeEventSchema>;

// ============================================
// Advance Result - What the engine returns
// ============================================

export type AdvanceResult = {
  context: ExecutionContext;
  action: 
    | { type: 'continue' }
    | { 
        type: 'wait_for_input'; 
        nodeId: string; 
        inputMode?: 'text' | 'stt';
        sttProvider?: 'elevenlabs' | 'deepgram' | 'google';
        language?: string;
      }
    | { type: 'speak'; text: string; nodeId: string; audioBase64?: string; mimeType?: string }
    | { type: 'completed' }
    | { type: 'error'; message: string };
};
