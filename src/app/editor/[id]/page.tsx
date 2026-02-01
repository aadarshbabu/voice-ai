"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpcClient";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Rocket, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { NodePalette } from "../_components/node-palette";
import { WorkflowCanvas } from "../_components/workflow-canvas";

function EditorContent() {
    const params = useParams();
    const id = params.id as string;
    const trpc = useTRPC();

    const { data: workflow, refetch } = useSuspenseQuery(
        trpc.workflow.get.queryOptions({ id })
    );

    const publishMutation = useMutation(trpc.workflow.publish.mutationOptions());

    const onPublish = async () => {
        try {
            await publishMutation.mutateAsync({ id });
            toast.success("Workflow published successfully");
            refetch();
        } catch (error: any) {
            toast.error(error.message || "Failed to publish workflow");
        }
    };

    return (
        <div className="flex flex-col h-screen max-h-screen bg-background overflow-hidden">
            {/* Editor Header */}
            <header className="border-b px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold">{workflow.name}</h1>
                            <Badge variant={workflow.status === "PUBLISHED" ? "default" : "secondary"}>
                                {workflow.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">v{workflow.version}</span>
                        </div>
                        {workflow.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{workflow.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={onPublish}
                        disabled={workflow.status === "PUBLISHED" || publishMutation.isPending}
                        className="gap-2"
                    >
                        <Rocket className="h-4 w-4" />
                        {publishMutation.isPending ? "Publishing..." : "Publish"}
                    </Button>
                </div>
            </header>

            {/* Canvas Area */}
            <main className="flex-1 flex overflow-hidden w-full">
                <NodePalette />
                <WorkflowCanvas workflowId={id} />
            </main>
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
