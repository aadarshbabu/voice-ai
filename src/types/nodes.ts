export const NODE_TYPES = {
    TRIGGER: 'trigger',
    SPEAK: 'speak',
    LISTEN: 'listen',
    LLM_DECISION: 'llm-decision',
    TOOL: 'tool',
    LLM_REPLY: 'llm-reply',
    END: 'end',
} as const;

export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

export const DEFAULT_NODE_DATA: Record<NodeType, any> = {
    [NODE_TYPES.TRIGGER]: { label: 'Start' },
    [NODE_TYPES.SPEAK]: { label: 'Speak', text: 'Hello, how can I help you?' },
    [NODE_TYPES.LISTEN]: { label: 'Listen', timeout: 5000 },
    [NODE_TYPES.LLM_DECISION]: { label: 'Decision', prompt: 'Decide based on...' },
    [NODE_TYPES.TOOL]: { label: 'Tool', toolId: '' },
    [NODE_TYPES.LLM_REPLY]: { label: 'AI Reply', prompt: 'Reply warmly...' },
    [NODE_TYPES.END]: { label: 'End Session' },
};
