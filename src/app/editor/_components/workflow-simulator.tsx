"use client";

import React, { useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, Send, Terminal, Variable } from 'lucide-react';
import { type ExecutionState } from '@/lib/engine/advance';

interface WorkflowSimulatorProps {
    isOpen: boolean;
    onClose: () => void;
    state: ExecutionState;
    onStart: () => void;
    onNext: (input?: string) => void;
    onReset: () => void;
}

export function WorkflowSimulator({
    isOpen,
    onClose,
    state,
    onStart,
    onNext,
    onReset,
}: WorkflowSimulatorProps) {
    const [userInput, setUserInput] = useState('');

    const handleSend = () => {
        if (!userInput.trim()) return;
        onNext(userInput);
        setUserInput('');
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-md flex flex-col h-full border-l shadow-2xl">
                <SheetHeader className="pb-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-primary" />
                        Workflow Simulator
                    </SheetTitle>
                    <SheetDescription>
                        Test your agent's logic with step-by-step text interaction.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 flex flex-col min-h-0 py-4 gap-4">
                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {state.status === 'idle' ? (
                            <Button onClick={onStart} className="w-full gap-2" size="sm">
                                <Play className="h-4 w-4" /> Start Simulation
                            </Button>
                        ) : (
                            <Button variant="outline" onClick={onReset} className="w-full gap-2" size="sm">
                                <RotateCcw className="h-4 w-4" /> Reset
                            </Button>
                        )}
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col border rounded-lg bg-muted/30 overflow-hidden">
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4">
                                {state.transcript.length === 0 && (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-muted-foreground italic">
                                            No messages yet. Start the simulation to see the flow.
                                        </p>
                                    </div>
                                )}
                                {state.transcript.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                                    >
                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-card border'
                                            }`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                            {msg.role === 'user' ? 'You' : 'Agent'}
                                        </span>
                                    </div>
                                ))}
                                {state.status === 'running' && (
                                    <div className="flex justify-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onNext()}
                                            className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/5"
                                        >
                                            Next Step...
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-3 border-t bg-background mt-auto">
                            <div className="flex gap-2">
                                <Input
                                    placeholder={state.status === 'waiting' ? "Type your response..." : "Simulation active..."}
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    disabled={state.status !== 'waiting'}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    className="h-9"
                                />
                                <Button
                                    size="icon"
                                    onClick={handleSend}
                                    className="h-9 w-9 shrink-0"
                                    disabled={state.status !== 'waiting' || !userInput.trim()}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Variables Inspector */}
                    <div className="border rounded-lg p-3 bg-muted/10">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                            <Variable className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Session Variables</span>
                        </div>
                        <ScrollArea className="h-[120px]">
                            {Object.keys(state.variables).length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic px-1">No variables set yet.</p>
                            ) : (
                                <pre className="text-[10px] font-mono leading-relaxed px-1">
                                    {JSON.stringify(state.variables, null, 2)}
                                </pre>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                <div className="pt-2 border-t mt-auto flex justify-between items-center">
                    <Badge variant={state.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px]">
                        Status: {state.status.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                        Active Node: <span className="font-mono">{state.currentNodeId || 'none'}</span>
                    </span>
                </div>
            </SheetContent>
        </Sheet>
    );
}
