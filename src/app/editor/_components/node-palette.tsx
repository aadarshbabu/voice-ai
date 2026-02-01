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
    GripVertical
} from "lucide-react";

import { NODE_TYPES } from '@/types/nodes';

const NODE_TYPES_LIST = [
    { type: NODE_TYPES.TRIGGER, label: 'Trigger', icon: SquarePlay, description: 'Workflow start point', color: 'bg-blue-500' },
    { type: NODE_TYPES.SPEAK, label: 'Speak', icon: Volume2, description: 'TTS voice output', color: 'bg-green-500' },
    { type: NODE_TYPES.LISTEN, label: 'Listen', icon: Mic2, description: 'STT voice input', color: 'bg-orange-500' },
    { type: NODE_TYPES.LLM_DECISION, label: 'LLM Decision', icon: BrainCircuit, description: 'Branching logic', color: 'bg-purple-500' },
    { type: NODE_TYPES.TOOL, label: 'Tool', icon: Wrench, description: 'External action', color: 'bg-pink-500' },
    { type: NODE_TYPES.LLM_REPLY, label: 'LLM Reply', icon: MessageSquareQuote, description: 'AI response', color: 'bg-indigo-500' },
    { type: NODE_TYPES.END, label: 'End', icon: CircleStop, description: 'Finish workflow', color: 'bg-red-500' },
];

export function NodePalette() {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-64 border-r bg-muted/30 flex flex-col">
            <div className="p-4 border-b bg-background/50">
                <h3 className="font-semibold text-sm">Node Palette</h3>
                <p className="text-xs text-muted-foreground">Drag nodes to the canvas</p>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                    {NODE_TYPES_LIST.map((node) => (
                        <Card
                            key={node.type}
                            className="p-3 cursor-grab hover:ring-2 hover:ring-primary/50 transition-all active:cursor-grabbing group"
                            draggable
                            onDragStart={(event) => onDragStart(event, node.type)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${node.color} text-white`}>
                                    <node.icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium leading-none mb-1">{node.label}</h4>
                                    <p className="text-[10px] text-muted-foreground truncate">{node.description}</p>
                                </div>
                                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Card>
                    ))}
                </div>
            </ScrollArea>
        </aside>
    );
}
