"use client";

import React, { Suspense, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "@/lib/trpcClient";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Rocket, Loader2, Play, Sparkles, FlaskConical, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { NodePalette } from "../_components/node-palette";
import { WorkflowCanvas } from "../_components/workflow-canvas";
import { WorkflowSimulator } from "../_components/workflow-simulator";
import { LiveSimulator } from "../_components/live-simulator";
import { useSimulator } from "@/hooks/use-simulator";
import { type Node, type Edge } from "@xyflow/react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionsTab } from "./_components/sessions-tab";

function EditorContent() {
    const params = useParams();
    const id = params.id as string;
    const trpc = useTRPC();

    const { data: workflow, refetch } = useSuspenseQuery(
        trpc.workflow.get.queryOptions({ id })
    );

    const publishMutation = useMutation(trpc.workflow.publish.mutationOptions());
    const restoreMutation = useMutation(trpc.workflow.restoreVersion.mutationOptions());

    const { data: snapshots } = useSuspenseQuery(
        trpc.workflow.listSnapshots.queryOptions({ id })
    );

    const [isValid, setIsValid] = useState(true);
    const [isSimOpen, setIsSimOpen] = useState(false);
    const [isLiveSimOpen, setIsLiveSimOpen] = useState(false);

    // Initial nodes/edges tracking for simulator
    const [currentNodes, setCurrentNodes] = useState<Node[]>([]);
    const [currentEdges, setCurrentEdges] = useState<Edge[]>([]);

    const handleValidationChange = useCallback((valid: boolean) => {
        setIsValid(valid);
    }, []);

    const handleChange = useCallback((nodes: Node[], edges: Edge[]) => {
        setCurrentNodes(nodes);
        setCurrentEdges(edges);
    }, []);

    const { state: simState, start, next, reset } = useSimulator(currentNodes, currentEdges);

    const onPublish = async () => {
        try {
            await publishMutation.mutateAsync({ id });
            toast.success("Workflow published successfully");
            refetch();
        } catch (error: any) {
            toast.error(error.message || "Failed to publish workflow");
        }
    };

    const onRestore = async (version: number) => {
        const promise = restoreMutation.mutateAsync({ workflowId: id, version });
        toast.promise(promise, {
            loading: `Loading version v${version}...`,
            success: () => {
                window.location.reload();
                return `Loaded v${version} successfully`;
            },
            error: (err) => err.message || `Failed to load v${version}`,
        });
    };

    return (
        <div className="flex flex-col h-screen max-h-screen bg-background overflow-hidden">
            {/* Editor Header */}
            <header className="border-b px-6 py-2 flex items-center justify-between shrink-0 bg-card/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold tracking-tight">{workflow.name}</h1>
                            <Badge variant={workflow.status === "PUBLISHED" ? "default" : "secondary"} className="font-mono text-[10px] px-1.5 h-4 uppercase">
                                {workflow.status}
                            </Badge>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="text-[10px] font-mono text-muted-foreground bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors border border-transparent hover:border-muted-foreground/20">
                                        v{workflow.version}
                                        <History className="h-2.5 w-2.5 opacity-50" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56 p-1">
                                    <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Version History
                                    </div>
                                    <DropdownMenuItem className="flex items-center justify-between text-xs bg-primary/5 font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            v{workflow.version} (Active)
                                        </div>
                                        <Badge variant="outline" className="text-[9px] h-4">Draft</Badge>
                                    </DropdownMenuItem>

                                    {snapshots?.map((snapshot) => (
                                        <DropdownMenuItem
                                            key={snapshot.id}
                                            className="flex flex-col items-start gap-0.5 text-xs py-2"
                                            onClick={() => onRestore(snapshot.version)}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-bold">v{snapshot.version}</span>
                                                <RotateCcw className="h-3 w-3 opacity-30" />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(snapshot.createdAt).toLocaleDateString()} at {new Date(snapshot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </DropdownMenuItem>
                                    ))}

                                    {!snapshots?.length && (
                                        <div className="px-2 py-4 text-center text-[10px] text-muted-foreground italic">
                                            No other versions available
                                        </div>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="editor" className="w-auto">
                    <TabsList className="grid w-[240px] grid-cols-2 h-9">
                        <TabsTrigger value="editor" className="text-xs">Editor</TabsTrigger>
                        <TabsTrigger value="sessions" className="text-xs">Sessions</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                    {!isValid && (
                        <span className="text-[10px] text-destructive font-semibold mr-2 uppercase tracking-wider">
                            Fix errors to publish
                        </span>
                    )}

                    {/* Test Button with Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 h-9"
                            >
                                <Play className="h-4 w-4 fill-current" />
                                Test
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setIsSimOpen(true)} className="gap-2">
                                <FlaskConical className="h-4 w-4" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Mock Test</span>
                                    <span className="text-xs text-muted-foreground">Step-by-step simulation</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsLiveSimOpen(true)} className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Live Test</span>
                                    <span className="text-xs text-muted-foreground">Real AI responses</span>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        onClick={onPublish}
                        disabled={workflow.status === "PUBLISHED" || publishMutation.isPending || !isValid}
                        className="gap-2 h-9"
                        size="sm"
                    >
                        {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        {publishMutation.isPending ? "Publishing..." : "Publish"}
                    </Button>
                </div>
            </header>

            <Tabs defaultValue="editor" className="flex-1 flex flex-col overflow-hidden">
                <TabsContent value="editor" className="flex-1 m-0 p-0 border-none outline-none relative overflow-hidden flex">
                    <NodePalette />
                    <WorkflowCanvas
                        workflowId={id}
                        onValidationChange={handleValidationChange}
                        activeNodeId={simState.currentNodeId}
                        onChange={handleChange}
                    />
                </TabsContent>
                <TabsContent value="sessions" className="flex-1 m-0 p-0 border-none outline-none overflow-hidden bg-muted/5">
                    <SessionsTab workflowId={id} />
                </TabsContent>
            </Tabs>

            {/* Mock Simulator */}
            <WorkflowSimulator
                isOpen={isSimOpen}
                onClose={() => setIsSimOpen(false)}
                state={simState}
                onStart={start}
                onNext={next}
                onReset={reset}
            />

            {/* Live Simulator with Real AI */}
            <LiveSimulator
                isOpen={isLiveSimOpen}
                onClose={() => setIsLiveSimOpen(false)}
                workflowId={id}
            />
        </div>
    );
}

export default function EditorPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <EditorContent />
        </Suspense>
    );
}

