"use client";

import React, { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "@/lib/trpcClient";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Calendar,
    Clock,
    ChevronRight,
    Info,
    Code,
    MessageSquare,
    Zap,
    Bug,
    Loader2
} from "lucide-react";
import Link from "next/link";
import { WorkflowCanvas } from "../../../_components/workflow-canvas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

function SessionDetailContent() {
    const params = useParams();
    const id = params.id as string;
    const sessionId = params.sessionId as string;
    const trpc = useTRPC();

    const { data: session } = useSuspenseQuery(
        trpc.workspaceSession.getTrace.queryOptions({ id: sessionId })
    );

    const [selectedStepIndex, setSelectedStepIndex] = useState(0);
    const selectedStep = session?.traces?.[selectedStepIndex];

    const formatTime = (date: Date | string) => {
        return new Date(date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="flex flex-col h-screen max-h-screen bg-background overflow-hidden font-sans">
            {/* Header */}
            <header className="border-b px-6 py-3 flex items-center justify-between shrink-0 bg-card shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/editor/${id}`}>
                            <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                        </Link>
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold tracking-tight">Session Trace</h1>
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                {session.id}
                            </Badge>
                            <Badge variant={session.status === "COMPLETED" ? "default" : session.status === "ERROR" ? "destructive" : "secondary"}>
                                {session.status}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(session.startedAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Started at {formatTime(session.startedAt)}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Timeline Sidebar */}
                <aside className="w-80 border-r bg-muted/30 flex flex-col shrink-0">
                    <div className="p-4 border-b bg-muted/50">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Execution Path</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {!session?.traces || session.traces.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground italic px-4 text-xs">
                                    No execution steps recorded for this session.
                                </div>
                            ) : (
                                session.traces.map((trace: any, index: number) => (
                                    <button
                                        key={trace.id}
                                        onClick={() => setSelectedStepIndex(index)}
                                        className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all group relative ${selectedStepIndex === index
                                                ? "bg-primary text-primary-foreground shadow-md scale-[1.02] z-10"
                                                : "hover:bg-accent text-foreground grayscale-[0.5] hover:grayscale-0"
                                            }`}
                                    >
                                        <div className={`mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${selectedStepIndex === index
                                                ? "bg-primary-foreground text-primary"
                                                : "bg-muted text-muted-foreground"
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                <span className="font-semibold text-sm truncate uppercase tracking-tight">
                                                    {trace.nodeId}
                                                </span>
                                                <span className={`text-[10px] font-mono opacity-60 ${selectedStepIndex === index ? "text-primary-foreground" : ""}`}>
                                                    {formatTime(trace.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                        {selectedStepIndex === index && (
                                            <ChevronRight className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </aside>

                {/* Main Canvas Area */}
                <main className="flex-1 relative bg-muted/10">
                    <WorkflowCanvas
                        workflowId={id}
                        readOnly={true}
                        activeNodeId={selectedStep?.nodeId}
                    />

                    {/* Floating Step Badge */}
                    <div className="absolute top-4 left-4 z-10">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-md border shadow-sm px-3 py-1.5 flex items-center gap-2">
                            <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            Step {selectedStepIndex + 1}: {selectedStep?.nodeId || "None"}
                        </Badge>
                    </div>
                </main>

                {/* Inspector Panel */}
                <aside className="w-96 border-l bg-card flex flex-col shrink-0">
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Step Inspector</h3>
                        </div>
                        {selectedStep && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                                {formatTime(selectedStep.createdAt)}
                            </Badge>
                        )}
                    </div>

                    <ScrollArea className="flex-1">
                        {!selectedStep ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center opacity-60 h-full">
                                <Bug className="h-10 w-10 mb-4 stroke-1 hover:animate-bounce cursor-help" />
                                <p className="text-sm font-medium">Select a step to inspect technical details</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-6">
                                {/* Inputs */}
                                <section>
                                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-3 px-1">
                                        <Code className="h-3 w-3" />
                                        Input Data
                                    </div>
                                    <pre className="rounded-lg bg-muted/50 p-3 border font-mono text-[11px] overflow-auto max-h-[200px] whitespace-pre-wrap">
                                        {JSON.stringify(selectedStep.inputVariables || {}, null, 2)}
                                    </pre>
                                </section>

                                <Separator className="opacity-50" />

                                {/* Outputs */}
                                <section>
                                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-3 px-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Output Data
                                    </div>
                                    <pre className="rounded-lg bg-muted/50 p-3 border font-mono text-[11px] overflow-auto max-h-[200px] whitespace-pre-wrap">
                                        {JSON.stringify(selectedStep.outputData || {}, null, 2)}
                                    </pre>
                                </section>

                                <Separator className="opacity-50" />

                                {/* Logs */}
                                <section>
                                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-3 px-1">
                                        <Info className="h-3 w-3" />
                                        Execution Logs
                                    </div>
                                    <div className="rounded-lg bg-muted/50 p-3 border font-mono text-[11px] overflow-auto max-h-[300px] whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">
                                        {Array.isArray(selectedStep.logs) && selectedStep.logs.length > 0
                                            ? selectedStep.logs.map((log: any, i: number) => (
                                                <div key={i} className="mb-1">
                                                    <span className="opacity-40 select-none">[{i}]</span> {typeof log === 'string' ? log : JSON.stringify(log)}
                                                </div>
                                            ))
                                            : <span className="opacity-40 italic">No logs for this step</span>
                                        }
                                    </div>
                                </section>
                            </div>
                        )}
                    </ScrollArea>
                </aside>
            </div>
        </div>
    );
}

export default function SessionDetailPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <SessionDetailContent />
        </Suspense>
    );
}
