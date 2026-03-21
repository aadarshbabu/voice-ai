"use client";

import React, { useCallback, useEffect, useState } from 'react';
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
    MarkerType,
    type Connection,
    type Edge,
    type Node,
} from '@xyflow/react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpcClient';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';
import { Loader2, CloudCheck, CloudUpload, AlertCircle } from 'lucide-react';

import { BaseNode } from './nodes/base-node';
import { NodeConfigDrawer } from './node-config-drawer';
import { cn } from "@/lib/utils";

import { NODE_TYPES, DEFAULT_NODE_DATA, type NodeType } from '@/types/nodes';
import { validateGraph, type ValidationResult } from '@/lib/validation/graph';
import { ValidationProvider } from './validation-context';

const nodeTypes = {
    [NODE_TYPES.TRIGGER]: BaseNode,
    [NODE_TYPES.SPEAK]: BaseNode,
    [NODE_TYPES.LISTEN]: BaseNode,
    [NODE_TYPES.LLM_DECISION]: BaseNode,
    [NODE_TYPES.TOOL]: BaseNode,
    [NODE_TYPES.LLM_REPLY]: BaseNode,
    [NODE_TYPES.AI_AGENT]: BaseNode,
    [NODE_TYPES.WEBHOOK]: BaseNode,
    [NODE_TYPES.END]: BaseNode,
};

const defaultEdgeOptions = {
    animated: true,
    style: { strokeWidth: 2, stroke: '#94a3b8' },
    markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#94a3b8',
    },
};

interface WorkflowCanvasProps {
    workflowId: string;
    onValidationChange?: (isValid: boolean) => void;
    activeNodeId?: string | null;
    onChange?: (nodes: Node[], edges: Edge[]) => void;
    readOnly?: boolean;
}

export function WorkflowCanvas({ workflowId, onValidationChange, activeNodeId, onChange, readOnly }: WorkflowCanvasProps) {
    return (
        <ReactFlowProvider>
            <CanvasInner workflowId={workflowId} onValidationChange={onValidationChange} activeNodeId={activeNodeId} onChange={onChange} readOnly={readOnly} />
        </ReactFlowProvider>
    );
}

function CanvasInner({ workflowId, onValidationChange, activeNodeId, onChange, readOnly }: WorkflowCanvasProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { screenToFlowPosition } = useReactFlow();

    // Fetch initial data
    const { data, isLoading } = useQuery(
        trpc.workflow.get.queryOptions({ id: workflowId }) as any
    );
    const workflow = data as any;

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [] });

    const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

    // Refs for stability and to prevent save loops
    const lastSavedDataRef = React.useRef<string>("");
    const isInitializedRef = React.useRef(false);
    const latestNodesRef = React.useRef<Node[]>([]);
    const latestEdgesRef = React.useRef<Edge[]>([]);
    const prevWorkflowIdRef = React.useRef<string>("");
    // Tracks whether the debounced values have updated at least once AFTER initialization.
    // Prevents saving stale pre-init empty arrays when isLoading changes.
    const hasDebouncedSinceInitRef = React.useRef(false);
    // Snapshot of the node count at initialization time, used to detect empty saves
    const initialNodeCountRef = React.useRef(0);

    // Reset initialization when workflowId changes
    useEffect(() => {
        if (workflowId !== prevWorkflowIdRef.current) {
            prevWorkflowIdRef.current = workflowId;
            isInitializedRef.current = false;
            hasDebouncedSinceInitRef.current = false;
            lastSavedDataRef.current = "";
            initialNodeCountRef.current = 0;
        }
    }, [workflowId]);

    // Initialize state when data loads
    useEffect(() => {
        if (workflow && !isInitializedRef.current && !isLoading) {
            console.log('[WorkflowCanvas] Initializing with workflow:', {
                id: workflowId,
                nodesCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
                edgesCount: Array.isArray(workflow.edges) ? workflow.edges.length : 0,
            });

            const initialNodes = Array.isArray(workflow.nodes) && workflow.nodes.length > 0
                ? (workflow.nodes as unknown as Node[])
                : [{
                    id: 'start-node',
                    type: NODE_TYPES.TRIGGER,
                    position: { x: 250, y: 100 },
                    data: { ...DEFAULT_NODE_DATA[NODE_TYPES.TRIGGER] },
                } as Node];

            const initialEdges = Array.isArray(workflow.edges)
                ? (workflow.edges as unknown as Edge[])
                : [];

            setNodes(initialNodes);
            setEdges(initialEdges);

            // Set the initial reference so we don't save immediately
            lastSavedDataRef.current = JSON.stringify({ nodes: initialNodes, edges: initialEdges });
            isInitializedRef.current = true;
            hasDebouncedSinceInitRef.current = false;
            initialNodeCountRef.current = initialNodes.length;
        }
    }, [workflow, isLoading, workflowId, setNodes, setEdges]);

    const updateMutation = useMutation(trpc.workflow.update.mutationOptions());

    const debouncedNodes = useDebounce(nodes, 2000);
    const debouncedEdges = useDebounce(edges, 2000);

    // Track when debounced values update post-initialization
    useEffect(() => {
        if (isInitializedRef.current && debouncedNodes.length > 0) {
            hasDebouncedSinceInitRef.current = true;
        }
    }, [debouncedNodes, debouncedEdges]);

    // Keep refs in sync for flush-on-unmount
    useEffect(() => {
        latestNodesRef.current = nodes;
        latestEdgesRef.current = edges;
    }, [nodes, edges]);

    // Validation effect - run more frequently than save
    useEffect(() => {
        if (!isInitializedRef.current || readOnly) return;
        const result = validateGraph(nodes, edges);
        setValidation(result);
        onValidationChange?.(result.isValid);
        onChange?.(nodes, edges);
    }, [nodes, edges, onValidationChange, onChange]);

    // Auto-save effect
    // IMPORTANT: isLoading is intentionally NOT in the dependency array.
    // Including it caused a race condition: when isLoading changed to false,
    // it would trigger a save with stale debounced values (empty []) before
    // the 2s debounce had time to update with the real initialized data.
    useEffect(() => {
        const performSave = async () => {
            if (!isInitializedRef.current || readOnly) return;
            // Don't save until debounced values have updated at least once post-init
            if (!hasDebouncedSinceInitRef.current) return;

            const currentData = JSON.stringify({ nodes: debouncedNodes, edges: debouncedEdges });

            // Skip if no changes from last successful save
            if (currentData === lastSavedDataRef.current) return;

            // Safety: never overwrite a multi-node workflow with empty/default-only data
            if (debouncedNodes.length === 0 && initialNodeCountRef.current > 0) {
                console.warn('[WorkflowCanvas] Blocked save of empty nodes — likely a race condition');
                return;
            }

            setIsSaving(true);
            setSaveError(null);
            try {
                await updateMutation.mutateAsync({
                    id: workflowId,
                    nodes: debouncedNodes as any,
                    edges: debouncedEdges,
                });
                lastSavedDataRef.current = currentData;
                setLastSaved(new Date());
                // Invalidate the query cache so re-mounts get the latest saved data
                queryClient.invalidateQueries({ queryKey: trpc.workflow.get.queryKey({ id: workflowId }) });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to save';
                setSaveError(message);
                toast.error('Failed to auto-save workflow');
            } finally {
                setIsSaving(false);
            }
        };

        performSave();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedNodes, debouncedEdges, workflowId]);

    // Flush unsaved changes on unmount (e.g. navigating to session detail page)
    useEffect(() => {
        return () => {
            if (!isInitializedRef.current || readOnly) return;
            const nodesToSave = latestNodesRef.current;
            const edgesToSave = latestEdgesRef.current;

            // Safety: don't overwrite real data with empty/default-only state
            if (nodesToSave.length === 0) return;
            if (nodesToSave.length <= 1 && initialNodeCountRef.current > 1) {
                console.warn('[WorkflowCanvas] Blocked unmount save — would overwrite multi-node workflow with default');
                return;
            }

            const currentData = JSON.stringify({ nodes: nodesToSave, edges: edgesToSave });
            if (currentData !== lastSavedDataRef.current) {
                // Fire-and-forget save of the latest state
                updateMutation.mutateAsync({
                    id: workflowId,
                    nodes: nodesToSave as any,
                    edges: edgesToSave,
                }).then(() => {
                    queryClient.invalidateQueries({ queryKey: trpc.workflow.get.queryKey({ id: workflowId }) });
                }).catch(() => {
                    // Silently fail on unmount save — data is best-effort
                });
            }
        };
    }, [workflowId, readOnly]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onConfigChange = useCallback((nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            })
        );
    }, [setNodes]);

    const isValidConnection = useCallback(
        (connection: Edge | Connection) => {
            if (connection.source === connection.target) {
                return false;
            }

            const sourceNode = nodes.find((n) => n.id === connection.source);
            const targetNode = nodes.find((n) => n.id === connection.target);

            if (targetNode?.type === NODE_TYPES.TRIGGER) {
                return false;
            }

            if (sourceNode?.type === NODE_TYPES.END) {
                return false;
            }

            return true;
        },
        [nodes],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow') as NodeType;

            if (!type || !DEFAULT_NODE_DATA[type]) {
                return;
            }

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

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-muted/5">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex-1 relative bg-muted/5 min-h-0 overflow-hidden">
            <div className="absolute inset-0">
                <ValidationProvider validation={validation} activeNodeId={activeNodeId ?? null}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        isValidConnection={isValidConnection}
                        nodeTypes={nodeTypes}
                        defaultEdgeOptions={defaultEdgeOptions}
                        nodesDraggable={!readOnly}
                        nodesConnectable={!readOnly}
                        fitView
                    >
                        <Controls />
                        <MiniMap />
                        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

                        <Panel position="top-right" className="flex flex-col gap-2 items-end">
                            <div className="bg-background border rounded-md px-3 py-1.5 flex items-center gap-2 shadow-sm">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                        <span className="text-xs font-medium">Saving...</span>
                                    </>
                                ) : saveError ? (
                                    <>
                                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                        <span className="text-xs font-medium text-destructive">Error</span>
                                    </>
                                ) : lastSaved ? (
                                    <>
                                        <CloudCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <CloudUpload className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs font-medium text-muted-foreground">Draft</span>
                                    </>
                                )}
                            </div>

                            {validation.errors.length > 0 && (
                                <div className="bg-background border rounded-md p-2 flex flex-col gap-1 shadow-sm max-w-[240px]">
                                    <div className="flex items-center gap-1.5 px-1 mb-1">
                                        <AlertCircle className={`h-3.5 w-3.5 ${validation.isValid ? 'text-amber-500' : 'text-destructive'}`} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {validation.isValid ? 'Warnings' : 'Errors'}
                                        </span>
                                    </div>
                                    <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                                        {validation.errors.map((error, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "text-[10px] p-2 rounded leading-tight border",
                                                    error.type === 'CRITICAL'
                                                        ? 'bg-destructive/5 text-destructive border-destructive/20'
                                                        : 'bg-amber-500/5 text-amber-600 border-amber-500/20'
                                                )}
                                            >
                                                {error.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Panel>
                    </ReactFlow>
                </ValidationProvider>
            </div>

            <NodeConfigDrawer
                selectedNode={selectedNode}
                isOpen={!!selectedNodeId}
                onClose={() => setSelectedNodeId(null)}
                onDataChange={onConfigChange}
            />
        </div>
    );
}

