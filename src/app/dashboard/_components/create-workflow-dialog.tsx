"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpcClient";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreateWorkflowSchema, type CreateWorkflowInput } from "@/types/workflow";

export function CreateWorkflowDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const router = useRouter();
    const trpc = useTRPC();
    const createWorkflow = useMutation(trpc.workflow.create.mutationOptions());

    const form = useForm<CreateWorkflowInput>({
        resolver: zodResolver(CreateWorkflowSchema),
        defaultValues: {
            name: "",
            description: "",
        },
    });

    const onSubmit = async (values: CreateWorkflowInput) => {
        try {
            const result = await createWorkflow.mutateAsync(values);
            toast.success("Workflow created successfully");
            onOpenChange(false);
            router.push(`/editor/${result.id}`);
        } catch (error) {
            toast.error("Failed to create workflow");
            console.error(error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Workflow</DialogTitle>
                    <DialogDescription>
                        Give your voice agent a name to get started.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Customer Support Agent"
                            {...form.register("name")}
                        />
                        {form.formState.errors.name && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.name.message}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Input
                            id="description"
                            placeholder="What does this agent do?"
                            {...form.register("description")}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createWorkflow.isPending}>
                            {createWorkflow.isPending ? "Creating..." : "Create Workflow"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
