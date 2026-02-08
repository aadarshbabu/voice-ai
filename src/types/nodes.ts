export const NODE_TYPES = {
    TRIGGER: 'trigger',
    SPEAK: 'speak',
    LISTEN: 'listen',
    LLM_DECISION: 'llm-decision',
    TOOL: 'tool',
    LLM_REPLY: 'llm-reply',
    AI_AGENT: 'ai-agent',  // New: AI Agent with tool calling
    WEBHOOK: 'webhook',    // New: External Webhook Trigger/Resume
    END: 'end',
} as const;

export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

// Tool definition for AI Agent
export interface AgentTool {
    id: string;
    name: string;
    description: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers: Array<{ key: string; value: string }>;
    body?: string;
    responsePath?: string;
}

export const DEFAULT_NODE_DATA: Record<NodeType, any> = {
    [NODE_TYPES.TRIGGER]: { label: 'Start' },
    [NODE_TYPES.SPEAK]: { 
        label: 'Speak', 
        text: 'Hello, how can I help you?',
        voiceMode: 'tts',  // 'text' or 'tts' - TTS enabled by default for actual voice output
        ttsProvider: undefined, // Will use default from Vault (ElevenLabs > Google)
        voiceId: undefined,
        speed: 1.0,
        language: 'eng',
    },
    [NODE_TYPES.LISTEN]: { 
        label: 'Listen', 
        variableName: 'user_input',
        timeout: 30000,
        inputMode: 'text',  // 'text' or 'stt'
        sttProvider: undefined, // Will use default from Vault
        language: 'eng',  // ISO 639-3 for ElevenLabs
    },
    [NODE_TYPES.LLM_DECISION]: { 
        label: 'Decision', 
        systemPrompt: 'You are a decision-making assistant. Analyze the conversation and choose the most appropriate outcome.',
        userPromptTemplate: '{{user_input}}',
        outcomes: [{ value: 'Yes', description: '' }, { value: 'No', description: '' }] 
    },
    [NODE_TYPES.TOOL]: { 
        label: 'HTTP Request', 
        method: 'GET',
        url: '',
        headers: [],
        body: '',
        outputVar: 'http_response',
        responsePath: ''
    },
    [NODE_TYPES.LLM_REPLY]: { 
        label: 'AI Reply', 
        systemPrompt: 'You are a helpful assistant.',
        userPromptTemplate: '{{user_input}}',
        saveAs: 'ai_reply'
    },
    [NODE_TYPES.AI_AGENT]: {
        label: 'AI Agent',
        systemPrompt: 'You are an intelligent AI agent. You have access to tools that you can use to help the user. Analyze the request and decide which tool to use, or respond directly if no tool is needed.',
        userPromptTemplate: '{{user_input}}',
        tools: [],  // Array of AgentTool
        maxIterations: 3,  // Max tool calls before responding
        saveAs: 'agent_response',
        decisionMode: 'auto',  // 'auto' | 'manual' - auto means AI decides
    },
    [NODE_TYPES.WEBHOOK]: {
        label: 'Webhook',
        slug: '',
        authType: 'none', // 'none' | 'bearer'
        sharedSecret: '',
        variableMapping: [], // Array of { path: '$.body.id', variable: 'user_id' }
    },
    [NODE_TYPES.END]: { label: 'End Session' },
};
