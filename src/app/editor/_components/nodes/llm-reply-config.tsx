"use client";

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MessageSquareQuote, Sparkles, Variable } from 'lucide-react';
import { LLMModelConfig } from './llm-model-config';

interface LLMReplyConfigProps {
    data: any;
    onChange: (newData: any) => void;
}

export function LLMReplyConfig({ data, onChange }: LLMReplyConfigProps) {
    const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '');
    const [userPromptTemplate, setUserPromptTemplate] = useState(data.userPromptTemplate || '');
    const [saveAs, setSaveAs] = useState(data.saveAs || 'ai_reply');

    const updateParent = useCallback((updates: Record<string, any>) => {
        onChange({ ...data, ...updates });
    }, [data, onChange]);

    const handleSystemPromptChange = (value: string) => {
        setSystemPrompt(value);
        updateParent({ systemPrompt: value, userPromptTemplate, saveAs });
    };

    const handleUserPromptChange = (value: string) => {
        setUserPromptTemplate(value);
        updateParent({ systemPrompt, userPromptTemplate: value, saveAs });
    };

    const handleSaveAsChange = (value: string) => {
        setSaveAs(value);
        updateParent({ systemPrompt, userPromptTemplate, saveAs: value });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
                    <MessageSquareQuote className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">AI Text Generator</h3>
                    <p className="text-xs text-muted-foreground italic">Powered by Large Language Models</p>
                </div>
            </div>

            <Separator />

            {/* System Prompt */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm">AI Personality</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Define how the AI should respond - its tone, style, and behavior
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="You are a helpful customer service agent. Be friendly, concise, and professional..."
                        value={systemPrompt}
                        onChange={(e) => handleSystemPromptChange(e.target.value)}
                        className="min-h-[100px] font-mono text-sm bg-muted/30 resize-none"
                    />
                </CardContent>
            </Card>

            {/* User Prompt Template */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Context Template</CardTitle>
                    <CardDescription className="text-xs">
                        What information should be provided to the AI?
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        placeholder="Based on the data: {{api_response}}. The user asked: {{user_input}}"
                        value={userPromptTemplate}
                        onChange={(e) => handleUserPromptChange(e.target.value)}
                        className="min-h-[80px] font-mono text-sm bg-muted/30 resize-none"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Available:</span>
                        {['{{user_input}}', '{{conversation_history}}', '{{http_response}}'].map((v) => (
                            <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                {v}
                            </code>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Save As Variable */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Variable className="h-4 w-4 text-green-500" />
                        <CardTitle className="text-sm">Output Variable</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Store the AI's response for use in later nodes
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Input
                        placeholder="ai_reply"
                        value={saveAs}
                        onChange={(e) => handleSaveAsChange(e.target.value)}
                        className="font-mono text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Use as{' '}
                        <code className="text-primary bg-primary/10 px-1 rounded">{`{{${saveAs || 'ai_reply'}}}`}</code>{' '}
                        in Speak nodes
                    </p>
                </CardContent>
            </Card>

            {/* LLM Model Config */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Model Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <LLMModelConfig
                        config={data.llmConfig || {}}
                        onChange={(newConfig) => onChange({ ...data, llmConfig: newConfig })}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
