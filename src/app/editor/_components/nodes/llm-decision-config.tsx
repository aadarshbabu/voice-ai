"use client";

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, BrainCircuit, Sparkles, GitBranch } from 'lucide-react';
import { LLMModelConfig } from './llm-model-config';

interface LLMDecisionConfigProps {
    data: any;
    onChange: (newData: any) => void;
}

export function LLMDecisionConfig({ data, onChange }: LLMDecisionConfigProps) {
    // Local state for form inputs
    const [systemPrompt, setSystemPrompt] = useState(
        data.systemPrompt || 'You are a decision-making assistant. Analyze the conversation and choose the most appropriate outcome.'
    );
    const [userPromptTemplate, setUserPromptTemplate] = useState(
        data.userPromptTemplate || '{{user_input}}'
    );
    const [outcomes, setOutcomes] = useState<Array<{ value: string; description: string }>>(
        data.outcomes || [{ value: 'Yes', description: '' }, { value: 'No', description: '' }]
    );

    // Debounced update to parent
    const updateParent = useCallback((updates: Record<string, any>) => {
        onChange({ ...data, ...updates });
    }, [data, onChange]);

    const handleSystemPromptChange = (value: string) => {
        setSystemPrompt(value);
        updateParent({ systemPrompt: value, userPromptTemplate, outcomes });
    };

    const handleUserPromptChange = (value: string) => {
        setUserPromptTemplate(value);
        updateParent({ systemPrompt, userPromptTemplate: value, outcomes });
    };

    const handleOutcomeChange = (index: number, field: 'value' | 'description', value: string) => {
        const newOutcomes = [...outcomes];
        newOutcomes[index] = { ...newOutcomes[index], [field]: value };
        setOutcomes(newOutcomes);
        updateParent({ systemPrompt, userPromptTemplate, outcomes: newOutcomes });
    };

    const addOutcome = () => {
        const newOutcomes = [...outcomes, { value: '', description: '' }];
        setOutcomes(newOutcomes);
        updateParent({ systemPrompt, userPromptTemplate, outcomes: newOutcomes });
    };

    const removeOutcome = (index: number) => {
        if (outcomes.length <= 1) return;
        const newOutcomes = outcomes.filter((_, i) => i !== index);
        setOutcomes(newOutcomes);
        updateParent({ systemPrompt, userPromptTemplate, outcomes: newOutcomes });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg">
                    <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">AI Logic Router</h3>
                    <p className="text-xs text-muted-foreground italic">Intelligent classification and routing</p>
                </div>
            </div>

            <Separator />

            {/* System Prompt */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm">System Instructions</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Define how the AI should analyze and classify the input
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="You are a decision-making assistant. Analyze the user's intent and decide..."
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
                        What context should be sent to the AI? Use variables like{' '}
                        <code className="text-primary bg-primary/10 px-1 rounded">{'{{user_input}}'}</code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="Based on: {{user_input}}"
                        value={userPromptTemplate}
                        onChange={(e) => handleUserPromptChange(e.target.value)}
                        className="min-h-[80px] font-mono text-sm bg-muted/30 resize-none"
                    />
                </CardContent>
            </Card>

            {/* Outcomes */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-blue-500" />
                            <CardTitle className="text-sm">Decision Outcomes</CardTitle>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={addOutcome}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Branch
                        </Button>
                    </div>
                    <CardDescription className="text-xs">
                        Each outcome creates an output connector on the node
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {outcomes.map((outcome, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50"
                        >
                            <div className="flex-1 space-y-2">
                                <Input
                                    placeholder="Outcome name (e.g., order_status)"
                                    value={outcome.value}
                                    onChange={(e) => handleOutcomeChange(index, 'value', e.target.value)}
                                    className="h-8 text-sm font-medium"
                                />
                                <Input
                                    placeholder="Description (optional)"
                                    value={outcome.description}
                                    onChange={(e) => handleOutcomeChange(index, 'description', e.target.value)}
                                    className="h-7 text-xs text-muted-foreground"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => removeOutcome(index)}
                                disabled={outcomes.length <= 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
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
