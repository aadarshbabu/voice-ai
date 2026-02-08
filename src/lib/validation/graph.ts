import { type Node, type Edge } from '@xyflow/react';
import { NODE_TYPES } from '@/types/nodes';

export type ValidationError = {
    nodeId?: string;
    edgeId?: string;
    type: 'CRITICAL' | 'WARNING';
    message: string;
};

export type ValidationResult = {
    isValid: boolean;
    errors: ValidationError[];
};

export function validateGraph(nodes: Node[], edges: Edge[]): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. Trigger Node Validation
    const triggerNodes = nodes.filter((n) => n.type === NODE_TYPES.TRIGGER);
    if (triggerNodes.length !== 1) {
        errors.push({
            type: 'CRITICAL',
            message: `Exactly one Start node is required. Found ${triggerNodes.length}.`,
        });
    }

    // 2. Connectivity Validation
    nodes.forEach((node) => {
        const incomingEdges = edges.filter((e) => e.target === node.id);
        const outgoingEdges = edges.filter((e) => e.source === node.id);

        // Orphaned nodes (no ingress, except trigger)
        if (node.type !== NODE_TYPES.TRIGGER && incomingEdges.length === 0) {
            errors.push({
                nodeId: node.id,
                type: 'WARNING',
                message: 'Orphaned node: This node is not reachable from any other node.',
            });
        }

        // Dead ends (no egress, except end)
        if (node.type !== NODE_TYPES.END && outgoingEdges.length === 0) {
            errors.push({
                nodeId: node.id,
                type: 'WARNING',
                message: 'Dead end: This node has no outgoing connections.',
            });
        }

        // 3. Decision Node Outcome Mapping
        if (node.type === NODE_TYPES.LLM_DECISION) {
            const outcomes = (node.data?.outcomes as { value: string }[]) || [];
            outcomes.forEach((outcome) => {
                const isConnected = outgoingEdges.some((e) => e.sourceHandle === outcome.value);
                if (!isConnected) {
                    errors.push({
                        nodeId: node.id,
                        type: 'CRITICAL',
                        message: `Outcome "${outcome.value}" is not connected to any node.`,
                    });
                }
            });
        }
    });

    return {
        isValid: !errors.some((e) => e.type === 'CRITICAL'),
        errors,
    };
}
