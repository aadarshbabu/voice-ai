"use client";

import React, { useState } from "react";
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
import { Eye, Filter } from "lucide-react";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SessionsTabProps {
    workflowId: string;
}

export function SessionsTab({ workflowId }: SessionsTabProps) {
    const trpc = useTRPC();
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    const { data: sessions } = useSuspenseQuery(
        trpc.workspaceSession.list.queryOptions({
            workflowId,
            status: statusFilter === "ALL" ? undefined : (statusFilter as any)
        })
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Active</Badge>;
            case "COMPLETED":
                return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Completed</Badge>;
            case "ERROR":
                return <Badge variant="destructive">Error</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const formatDuration = (start: string | Date, end: string | Date | null) => {
        if (!end) return "Ongoing";
        const duration = new Date(end).getTime() - new Date(start).getTime();
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    return (
        <div className="flex flex-col gap-4 p-6 h-full overflow-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">Session History</h2>
                    <p className="text-sm text-muted-foreground">
                        Review past executions and debug agent behavior.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                            <SelectItem value="ERROR">Error</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Session ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No sessions found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sessions.map((session) => (
                                <TableRow key={session.id}>
                                    <TableCell className="font-mono text-xs">
                                        {session.id}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(session.status)}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {new Date(session.startedAt as string).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {formatDuration(session.startedAt as string, session.endedAt as string)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="ghost" asChild>
                                            <Link href={`/editor/${workflowId}/sessions/${session.id}`}>
                                                <Eye className="h-4 w-4 mr-2" />
                                                View Trace
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
