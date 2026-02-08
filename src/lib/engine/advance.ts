import { type Node, type Edge } from '@xyflow/react';
import { NODE_TYPES } from '@/types/nodes';

export type ExecutionVariables = Record<string, any>;

export type ExecutionState = {
    currentNodeId: string | null;
    variables: ExecutionVariables;
    transcript: { role: 'agent' | 'user'; text: string }[];
    status: 'idle' | 'running' | 'waiting' | 'completed' | 'error';
};

export function advanceWorkflow(
    nodes: Node[],
    edges: Edge[],
    state: ExecutionState,
    input?: string
): ExecutionState {
    const { currentNodeId, variables, transcript } = state;

    if (!currentNodeId) {
        const trigger = nodes.find((n) => n.type === NODE_TYPES.TRIGGER);
        if (!trigger) return { ...state, status: 'error' };
        return { ...state, currentNodeId: trigger.id, status: 'running' };
    }

    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return { ...state, status: 'error' };

    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);

    switch (currentNode.type) {
        case NODE_TYPES.TRIGGER: {
            const nextEdge = outgoingEdges[0];
            if (!nextEdge) return { ...state, status: 'completed' };
            return { ...state, currentNodeId: nextEdge.target };
        }

        case NODE_TYPES.SPEAK: {
            const text = (currentNode.data?.text as string) || '';
            const interpolatedText = text.replace(/\{\{(.*?)\}\}/g, (_, key) => variables[key.trim()] || '');
            const nextEdge = outgoingEdges[0];
            
            return {
                ...state,
                transcript: [...transcript, { role: 'agent', text: interpolatedText }],
                currentNodeId: nextEdge ? nextEdge.target : currentNodeId,
                status: nextEdge ? 'running' : 'completed'
            };
        }

        case NODE_TYPES.LISTEN: {
            if (!input) return { ...state, status: 'waiting' };
            
            const varName = (currentNode.data?.variableName as string) || 'last_input';
            const nextEdge = outgoingEdges[0];

            return {
                ...state,
                variables: { ...variables, [varName]: input },
                transcript: [...transcript, { role: 'user', text: input }],
                currentNodeId: nextEdge ? nextEdge.target : currentNodeId,
                status: nextEdge ? 'running' : 'completed'
            };
        }

        case NODE_TYPES.LLM_REPLY: {
            // Simplified for simulator: generate a dummy AI reply
            const aiText = "[AI Generated Response based on prompt]";
            const varName = (currentNode.data?.saveAs as string) || 'ai_reply';
            const nextEdge = outgoingEdges[0];

            return {
                ...state,
                variables: { ...variables, [varName]: aiText },
                transcript: [...transcript, { role: 'agent', text: aiText }],
                currentNodeId: nextEdge ? nextEdge.target : currentNodeId,
                status: nextEdge ? 'running' : 'completed'
            };
        }

        case NODE_TYPES.LLM_DECISION: {
            // Simplified for simulator: pick the first outcome or match input
            const outcomes = (currentNode.data?.outcomes as { value: string }[]) || [];
            const result = input || (outcomes[0]?.value);
            const nextEdge = outgoingEdges.find((e) => e.sourceHandle === result) || outgoingEdges[0];

            if (!nextEdge) return { ...state, status: 'completed' };
            return { ...state, currentNodeId: nextEdge.target };
        }

        case NODE_TYPES.TOOL: {
            const result = { success: true, data: "Tool result mock" };
            const varName = (currentNode.data?.outputVar as string) || 'tool_result';
            const nextEdge = outgoingEdges[0];

            return {
                ...state,
                variables: { ...variables, [varName]: result },
                currentNodeId: nextEdge ? nextEdge.target : currentNodeId,
                status: nextEdge ? 'running' : 'completed'
            };
        }

        case NODE_TYPES.END:
            return { ...state, status: 'completed' };

        default:
            return { ...state, status: 'error' };
    }
}
