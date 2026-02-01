"use client";

import React, { useCallback } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    addEdge,
    Panel,
    ReactFlowProvider,
    useReactFlow,
    type Connection,
    type Edge,
    type Node,
} from '@xyflow/react';

import { BaseNode } from './nodes/base-node';

import { NODE_TYPES, DEFAULT_NODE_DATA, type NodeType } from '@/types/nodes';

const nodeTypes = {
    [NODE_TYPES.TRIGGER]: BaseNode,
    [NODE_TYPES.SPEAK]: BaseNode,
    [NODE_TYPES.LISTEN]: BaseNode,
    [NODE_TYPES.LLM_DECISION]: BaseNode,
    [NODE_TYPES.TOOL]: BaseNode,
    [NODE_TYPES.LLM_REPLY]: BaseNode,
    [NODE_TYPES.END]: BaseNode,
};

const defaultEdgeOptions = {
    animated: true,
    style: { strokeWidth: 2 },
};

const initialNodes: Node[] = [
    {
        id: 'start-node',
        type: NODE_TYPES.TRIGGER,
        position: { x: 250, y: 100 },
        data: { ...DEFAULT_NODE_DATA[NODE_TYPES.TRIGGER] },
    },
];
const initialEdges: Edge[] = [];

interface WorkflowCanvasProps {
    workflowId: string;
}

export function WorkflowCanvas({ workflowId }: WorkflowCanvasProps) {
    return (
        <ReactFlowProvider>
            <CanvasInner workflowId={workflowId} />
        </ReactFlowProvider>
    );
}

function CanvasInner({ workflowId }: WorkflowCanvasProps) {
    const { screenToFlowPosition } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow') as NodeType;

            // check if the dropped element is valid
            if (!type || !DEFAULT_NODE_DATA[type]) {
                return;
            }

            // reactFlowInstance.screenToFlowPosition aids in logic correctly mapping 
            // the screen coordinates to the flow diagram coordinates
            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: Node = {
                id: crypto.randomUUID(),
                type,
                position,
                data: JSON.parse(JSON.stringify(DEFAULT_NODE_DATA[type])),
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes],
    );

    return (
        <div className="flex-1 relative bg-muted/5 min-h-0">
            <div className="absolute inset-0">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={defaultEdgeOptions}
                    fitView
                >
                    <Controls />
                    <MiniMap />
                    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                </ReactFlow>
            </div>
        </div>
    );
}
