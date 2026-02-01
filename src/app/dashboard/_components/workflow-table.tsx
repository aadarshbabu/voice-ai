"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpcClient";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkflowTable() {
    const trpc = useTRPC();
    const { data } = useSuspenseQuery(trpc.workflow.list.queryOptions());
    const workflows = data as any[];

    if (workflows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
                <p className="text-muted-foreground">No workflows found. Create your first one!</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workflows.map((workflow) => (
                        <TableRow key={workflow.id}>
                            <TableCell className="font-medium">
                                <Link
                                    href={`/editor/${workflow.id}`}
                                    className="hover:underline flex flex-col"
                                >
                                    <span>{workflow.name}</span>
                                    {workflow.description && (
                                        <span className="text-xs text-muted-foreground font-normal">
                                            {workflow.description}
                                        </span>
                                    )}
                                </Link>
                            </TableCell>
                            <TableCell>
                                <Badge variant={workflow.status === "PUBLISHED" ? "default" : "secondary"}>
                                    {workflow.status}
                                </Badge>
                            </TableCell>
                            <TableCell>v{workflow.version}</TableCell>
                            <TableCell>
                                {new Date(workflow.updatedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem asChild>
                                            <Link href={`/editor/${workflow.id}`}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                View Editor
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive">
                                            Delete Workflow
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
