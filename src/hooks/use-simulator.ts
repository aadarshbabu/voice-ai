import { useState, useCallback } from 'react';
import { type Node, type Edge } from '@xyflow/react';
import { advanceWorkflow, type ExecutionState } from '@/lib/engine/advance';

const INITIAL_STATE: ExecutionState = {
    currentNodeId: null,
    variables: {},
    transcript: [],
    status: 'idle',
};

export function useSimulator(nodes: Node[], edges: Edge[]) {
    const [state, setState] = useState<ExecutionState>(INITIAL_STATE);

    const start = useCallback(() => {
        const nextState = advanceWorkflow(nodes, edges, INITIAL_STATE);
        setState(nextState);
    }, [nodes, edges]);

    const next = useCallback((input?: string) => {
        setState((current) => {
            const nextState = advanceWorkflow(nodes, edges, current, input);
            return nextState;
        });
    }, [nodes, edges]);

    const reset = useCallback(() => {
        setState(INITIAL_STATE);
    }, []);

    return {
        state,
        start,
        next,
        reset,
    };
}
