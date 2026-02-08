import { describe, it, expect } from 'vitest';
import { validateGraph } from './graph';
import { NODE_TYPES } from '@/types/nodes';

describe('validateGraph', () => {
    it('should error if there is no trigger node', () => {
        const nodes: any[] = [{ id: '1', type: NODE_TYPES.SPEAK, data: {} }];
        const edges: any[] = [];
        const result = validateGraph(nodes, edges);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.objectContaining({ 
            type: 'CRITICAL', 
            message: expect.stringMatching(/Exactly one Start node/) 
        }));
    });

    it('should error if there are multiple trigger nodes', () => {
        const nodes: any[] = [
            { id: '1', type: NODE_TYPES.TRIGGER, data: {} },
            { id: '2', type: NODE_TYPES.TRIGGER, data: {} },
        ];
        const edges: any[] = [];
        const result = validateGraph(nodes, edges);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.objectContaining({ 
            type: 'CRITICAL', 
            message: expect.stringMatching(/Exactly one Start node/) 
        }));
    });

    it('should detect orphaned nodes', () => {
        const nodes: any[] = [
            { id: '1', type: NODE_TYPES.TRIGGER, data: {} },
            { id: '2', type: NODE_TYPES.SPEAK, data: {} },
        ];
        const edges: any[] = [];
        const result = validateGraph(nodes, edges);
        expect(result.errors).toContainEqual(expect.objectContaining({ 
            nodeId: '2', 
            message: expect.stringMatching(/Orphaned node/) 
        }));
    });

    it('should detect unconnected decision branches', () => {
        const nodes: any[] = [
            { id: '1', type: NODE_TYPES.TRIGGER, data: {} },
            { id: '2', type: NODE_TYPES.LLM_DECISION, data: { outcomes: [{ value: 'Yes' }, { value: 'No' }] } },
            { id: '3', type: NODE_TYPES.END, data: {} },
        ];
        const edges: any[] = [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3', sourceHandle: 'Yes' },
        ];
        const result = validateGraph(nodes, edges);
        expect(result.errors).toContainEqual(expect.objectContaining({ 
            nodeId: '2', 
            message: expect.stringMatching(/Outcome "No" is not connected/) 
        }));
    });

    it('should be valid for a simple correct graph', () => {
        const nodes: any[] = [
            { id: '1', type: NODE_TYPES.TRIGGER, data: {} },
            { id: '2', type: NODE_TYPES.SPEAK, data: {} },
            { id: '3', type: NODE_TYPES.END, data: {} },
        ];
        const edges: any[] = [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' },
        ];
        const result = validateGraph(nodes, edges);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});
