"use client";

import React from "react";
import { useTRPC } from "@/lib/trpcClient";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    History,
    RotateCcw,
    ExternalLink,
    Clock,
    CheckCircle2,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface VersionsTabProps {
    workflowId: string;
}

export function VersionsTab({ workflowId }: VersionsTabProps) {
    const trpc = useTRPC();
    const router = useRouter();

    const { data, refetch } = useSuspenseQuery(
        trpc.workflow.listSnapshots.queryOptions({ id: workflowId })
    );

    const snapshots = data as any[];

    const restoreMutation = useMutation(trpc.workflow.restoreVersion.mutationOptions());

    const onRestore = async (version: number) => {
        try {
            await restoreMutation.mutateAsync({ workflowId, version });
            toast.success(`Restored version ${version} to draft`);
            // We might need to refresh the page or trigger a refetch of the main workflow data
            window.location.reload(); // Simple way to ensure everything reloads with restored state
        } catch (error: any) {
            toast.error(error.message || "Failed to restore version");
        }
    };

    if (!snapshots || snapshots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-4">
                <div className="p-4 rounded-full bg-muted">
                    <History className="h-8 w-8 opacity-20" />
                </div>
                <div className="text-center">
                    <p className="font-medium">No versions yet</p>
                    <p className="text-sm opacity-70">Publish your workflow to create a version snapshot.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Version History</h2>
                    <p className="text-muted-foreground">
                        View and restore previous published states of this workflow.
                    </p>
                </div>
                <Badge variant="outline" className="h-6 font-mono">
                    {snapshots.length} {snapshots.length === 1 ? 'Snapshot' : 'Snapshots'}
                </Badge>
            </div>

            <ScrollArea className="flex-1 -mx-2 px-2">
                <div className="grid gap-4">
                    {snapshots.map((snapshot: any) => (
                        <Card key={snapshot.id} className="group hover:border-primary/50 transition-colors">
                            <CardHeader className="p-4 pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                                            <span className="font-mono font-bold text-primary">v{snapshot.version}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <CardTitle className="text-base">Published Snapshot</CardTitle>
                                            <CardDescription className="flex items-center gap-1.5 mt-0.5">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(snapshot.createdAt), "PPP p")}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Simple meta info */}
                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                            {(snapshot.nodes as any[]).length} nodes
                                        </Badge>
                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                            {(snapshot.edges as any[]).length} edges
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-8 text-xs"
                                    onClick={() => onRestore(snapshot.version)}
                                    disabled={restoreMutation.isPending}
                                >
                                    {restoreMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <RotateCcw className="h-3 w-3" />
                                    )}
                                    Restore to Draft
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
