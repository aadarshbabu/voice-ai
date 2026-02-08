"use client";

import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Card } from "@/components/ui/card";
import {
    Mic2,
    Volume2,
    BrainCircuit,
    Wrench,
    MessageSquareQuote,
    SquarePlay,
    CircleStop,
    Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useValidationContext } from '../validation-context';

const ICON_MAP: Record<string, any> = {
    trigger: SquarePlay,
    speak: Volume2,
    listen: Mic2,
    'llm-decision': BrainCircuit,
    tool: Wrench,
    'llm-reply': MessageSquareQuote,
    'ai-agent': Bot,
    end: CircleStop,
};

const COLOR_MAP: Record<string, string> = {
    trigger: 'bg-blue-500',
    speak: 'bg-emerald-500',
    listen: 'bg-orange-500',
    'llm-decision': 'bg-purple-500',
    tool: 'bg-pink-500',
    'llm-reply': 'bg-indigo-500',
    'ai-agent': 'bg-violet-600',
    end: 'bg-red-500',
};

const BORDER_MAP: Record<string, string> = {
    trigger: 'border-blue-200',
    speak: 'border-emerald-200',
    listen: 'border-orange-200',
    'llm-decision': 'border-purple-200',
    tool: 'border-pink-200',
    'llm-reply': 'border-indigo-200',
    'ai-agent': 'border-violet-200',
    end: 'border-red-200',
};

export type BaseNodeData = {
    label?: string;
    outcomes?: { value: string }[];
};

export const BaseNode = memo(({ id, data, type, selected }: NodeProps<Node<BaseNodeData>>) => {
    const { validation, activeNodeId } = useValidationContext();
    const Icon = ICON_MAP[type || 'speak'] || Volume2;
    const colorClass = COLOR_MAP[type || 'speak'] || 'bg-gray-500';
    const borderClass = BORDER_MAP[type || 'speak'] || 'border-gray-200';

    const nodeError = validation.errors.find(e => e.nodeId === id);
    const isActive = activeNodeId === id;

    return (
        <div className="relative">
            <Card className={cn(
                "w-[200px] bg-background border shadow-sm transition-all duration-200 overflow-visible",
                selected ? "ring-2 ring-primary border-primary" : "border-border/60",
                isActive && "ring-2 ring-green-500 border-green-500",
                nodeError?.type === 'CRITICAL' && "border-destructive ring-1 ring-destructive",
                nodeError?.type === 'WARNING' && "border-amber-500 ring-1 ring-amber-500"
            )}>
                {/* Connector Handles */}
                {type !== 'trigger' && (
                    <Handle
                        type="target"
                        position={Position.Top}
                        className="!w-2.5 !h-2.5 !bg-background !border-2 !border-primary !-top-1.5"
                    />
                )}

                <div className="flex flex-col">
                    <div className="p-3">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-md text-white shrink-0 shadow-sm", colorClass)}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none mb-1.5">
                                    {type?.replace('-', ' ')}
                                </span>
                                <div className="text-sm font-semibold truncate text-foreground/90">
                                    {data.label || 'Untitled Node'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {type === 'llm-decision' && data.outcomes && data.outcomes.length > 0 ? (
                    <div className="relative w-full h-6 border-t bg-muted/30">
                        <div className="flex justify-around items-center h-full px-2">
                            {data.outcomes.map((outcome, index) => (
                                <div key={index} className="relative group/outcome flex flex-col items-center">
                                    <span className="absolute -top-1 px-1 bg-background border border-border/50 rounded-sm text-[8px] font-medium leading-none whitespace-nowrap z-10 shadow-sm transform -translate-y-full">
                                        {outcome.value || `O${index + 1}`}
                                    </span>
                                    <Handle
                                        type="source"
                                        position={Position.Bottom}
                                        id={outcome.value || `outcome-${index}`}
                                        className="!static !translate-y-0.5 !w-2.5 !h-2.5 !bg-background !border-2 !border-primary"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    type !== 'end' && (
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            className="!w-2.5 !h-2.5 !bg-background !border-2 !border-primary !-bottom-1.5"
                        />
                    )
                )}

                {/* Validation Badge */}
                {nodeError && (
                    <div className={cn(
                        "absolute -top-2.5 -right-2 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md border-2 border-background",
                        nodeError.type === 'CRITICAL' ? "bg-destructive" : "bg-amber-500"
                    )}>
                        {nodeError.type === 'CRITICAL' ? '!' : '?'}
                    </div>
                )}
            </Card>
        </div>
    );
});

BaseNode.displayName = 'BaseNode';
