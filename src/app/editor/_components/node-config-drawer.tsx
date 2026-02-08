"use client";

import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type Node } from '@xyflow/react';
import { NODE_TYPES } from '@/types/nodes';
import { SpeakNodeConfig } from './nodes/speak-config';
import { ListenNodeConfig } from './nodes/listen-config';
import { LLMDecisionConfig } from './nodes/llm-decision-config';
import { LLMReplyConfig } from './nodes/llm-reply-config';
import { ToolNodeConfig } from './nodes/tool-config';
import { AIAgentConfig } from './nodes/ai-agent-config';
import { WebhookNodeConfig } from './nodes/webhook-config';
import { Settings2 } from 'lucide-react';

interface NodeConfigDrawerProps {
    selectedNode: Node | null;
    isOpen: boolean;
    onClose: () => void;
    onDataChange: (nodeId: string, newData: any) => void;
}

export function NodeConfigDrawer({
    selectedNode,
    isOpen,
    onClose,
    onDataChange,
}: NodeConfigDrawerProps) {
    if (!selectedNode) return null;

    const renderConfig = () => {
        switch (selectedNode.type) {
            case NODE_TYPES.SPEAK:
                return (
                    <SpeakNodeConfig
                        data={selectedNode.data}
                        onChange={(newData) => onDataChange(selectedNode.id, newData)}
                    />
                );
            case NODE_TYPES.LISTEN:
                return (
                    <ListenNodeConfig
                        data={selectedNode.data}
                        onChange={(newData) => onDataChange(selectedNode.id, newData)}
                    />
                );
            case NODE_TYPES.LLM_DECISION:
                return (
                    <LLMDecisionConfig
                        data={selectedNode.data}
                        onChange={(newData) => onDataChange(selectedNode.id, newData)}
                    />
                );
            case NODE_TYPES.LLM_REPLY:
                return (
                    <LLMReplyConfig
                        data={selectedNode.data}
                        onChange={(newData) => onDataChange(selectedNode.id, newData)}
                    />
                );
            case NODE_TYPES.TOOL:
                return (
                    <ToolNodeConfig
                        data={selectedNode.data}
                        onChange={(newData) => onDataChange(selectedNode.id, newData)}
                    />
                );
            case NODE_TYPES.AI_AGENT:
                return (
                    <AIAgentConfig
                        data={selectedNode.data}
                        onChange={(newData) => onDataChange(selectedNode.id, newData)}
                    />
                );
            case NODE_TYPES.WEBHOOK:
                return (
                    <WebhookNodeConfig
                        data={selectedNode.data}
                        onChange={(newData) => onDataChange(selectedNode.id, newData)}
                    />
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Settings2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-sm text-muted-foreground">
                            No configuration available for{' '}
                            <span className="font-semibold">{selectedNode.type}</span> nodes
                        </p>
                    </div>
                );
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-lg p-0 gap-0">
                <SheetHeader className="px-6 py-4 border-b bg-muted/30">
                    <SheetTitle className="text-base">Node Configuration</SheetTitle>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-80px)]">
                    <div className="p-6">
                        {renderConfig()}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-muted/20">
                        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                            <span>Node ID: {selectedNode.id.slice(0, 8)}...</span>
                            <span className="uppercase tracking-wider">{selectedNode.type}</span>
                        </div>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
