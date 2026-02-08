"use client";

import React from 'react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Mic2,
    Volume2,
    BrainCircuit,
    Wrench,
    MessageSquareQuote,
    SquarePlay,
    CircleStop,
    GripVertical,
    Bot,
    Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_TYPES } from '@/types/nodes';

const COLOR_MAP: Record<string, string> = {
    [NODE_TYPES.TRIGGER]: 'bg-blue-500',
    [NODE_TYPES.SPEAK]: 'bg-emerald-500',
    [NODE_TYPES.LISTEN]: 'bg-orange-500',
    [NODE_TYPES.LLM_DECISION]: 'bg-purple-500',
    [NODE_TYPES.TOOL]: 'bg-pink-500',
    [NODE_TYPES.LLM_REPLY]: 'bg-indigo-500',
    [NODE_TYPES.AI_AGENT]: 'bg-violet-600',
    [NODE_TYPES.WEBHOOK]: 'bg-cyan-500',
    [NODE_TYPES.END]: 'bg-red-500',
};

const NODE_TYPES_LIST = [
    { type: NODE_TYPES.TRIGGER, label: 'Start Node', icon: SquarePlay, description: 'Workflow start point' },
    { type: NODE_TYPES.SPEAK, label: 'Speak', icon: Volume2, description: 'TTS voice output' },
    { type: NODE_TYPES.LISTEN, label: 'Listen', icon: Mic2, description: 'STT voice input' },
    { type: NODE_TYPES.AI_AGENT, label: 'AI Agent', icon: Bot, description: 'Agent with tools' },
    { type: NODE_TYPES.LLM_DECISION, label: 'LLM Decision', icon: BrainCircuit, description: 'Branching logic' },
    { type: NODE_TYPES.TOOL, label: 'HTTP Request', icon: Wrench, description: 'Call external API' },
    { type: NODE_TYPES.WEBHOOK, label: 'Webhook', icon: Webhook, description: 'External trigger/wait' },
    { type: NODE_TYPES.LLM_REPLY, label: 'LLM Reply', icon: MessageSquareQuote, description: 'AI response' },
    { type: NODE_TYPES.END, label: 'End', icon: CircleStop, description: 'Finish workflow' },
];

export function NodePalette() {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-56 border-r bg-muted/5 flex flex-col h-full shrink-0">
            <div className="p-3 border-b bg-background/50">
                <h3 className="font-bold text-xs tracking-tight text-foreground/80 uppercase">Components</h3>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-2 space-y-1">
                    {NODE_TYPES_LIST.map((node) => {
                        const colorClass = COLOR_MAP[node.type] || 'bg-gray-500';
                        return (
                            <div
                                key={node.type}
                                className="group relative p-2 cursor-grab bg-background border border-border/50 rounded-md hover:border-primary/40 hover:bg-accent/50 transition-all active:cursor-grabbing flex items-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                                draggable
                                onDragStart={(event) => onDragStart(event, node.type)}
                            >
                                <div className={cn(
                                    "p-1.5 rounded text-white shrink-0 shadow-sm",
                                    colorClass
                                )}>
                                    <node.icon className="h-3 w-3" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[11px] font-semibold leading-none text-foreground/90">{node.label}</h4>
                                </div>
                                <GripVertical className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </aside>
    );
}
