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
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
    trigger: SquarePlay,
    speak: Volume2,
    listen: Mic2,
    'llm-decision': BrainCircuit,
    tool: Wrench,
    'llm-reply': MessageSquareQuote,
    end: CircleStop,
};

const COLOR_MAP: Record<string, string> = {
    trigger: 'bg-blue-500',
    speak: 'bg-green-500',
    listen: 'bg-orange-500',
    'llm-decision': 'bg-purple-500',
    tool: 'bg-pink-500',
    'llm-reply': 'bg-indigo-500',
    end: 'bg-red-500',
};

export type BaseNodeData = {
    label?: string;
};

export const BaseNode = memo(({ data, type, selected }: NodeProps<Node<BaseNodeData>>) => {
    const Icon = ICON_MAP[type || 'speak'] || Volume2;
    const colorClass = COLOR_MAP[type || 'speak'] || 'bg-gray-500';

    return (
        <Card className={`min-w-[180px] shadow-lg border-2 bg-card ${selected
                ? 'border-primary ring-2 ring-primary/20 scale-[1.02] shadow-primary/10'
                : 'border-border'
            } transition-all duration-200`}>
            {type !== 'trigger' && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!w-4 !h-4 !bg-background border-2 border-primary ring-2 ring-background transition-colors hover:!bg-primary"
                />
            )}

            <div className="p-3">
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-1.5 rounded-md ${colorClass} text-white shadow-sm`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {type?.replace('-', ' ')}
                    </span>
                </div>
                <div className="text-sm font-medium px-1 truncate">
                    {data.label || 'Untitled Node'}
                </div>
            </div>

            {type !== 'end' && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!w-4 !h-4 !bg-background border-2 border-primary ring-2 ring-background transition-colors hover:!bg-primary"
                />
            )}
        </Card>
    );
});

BaseNode.displayName = 'BaseNode';
