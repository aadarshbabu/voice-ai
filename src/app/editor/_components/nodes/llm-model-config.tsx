"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";


export const PROVIDERS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'google', label: 'Google Gemini' },
    { value: 'mistral', label: 'Mistral AI' },
];

export const MODELS: Record<string, { value: string; label: string }[]> = {
    openai: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
        { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ],
    google: [
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    mistral: [
        { value: 'mistral-large-latest', label: 'Mistral Large' },
        { value: 'mistral-medium-latest', label: 'Mistral Medium' },
        { value: 'mistral-small-latest', label: 'Mistral Small' },
    ],
};

interface LLMModelConfigProps {
    config: {
        provider?: string;
        model?: string;
        temperature?: number;
        maxTokens?: number;
    };
    onChange: (newConfig: any) => void;
}

export function LLMModelConfig({ config, onChange }: LLMModelConfigProps) {
    const provider = config.provider || 'openai';
    const model = config.model || MODELS[provider]?.[0]?.value || '';
    const temperature = config.temperature ?? 0.7;
    const maxTokens = config.maxTokens ?? 1000;

    const handleProviderChange = (newProvider: string) => {
        // Reset model to first available for new provider
        const firstModel = MODELS[newProvider]?.[0]?.value || '';
        onChange({
            ...config,
            provider: newProvider,
            model: firstModel,
        });
    };

    return (
        <div className="space-y-4 border rounded-md p-4 bg-muted/20">
            <div className="text-sm font-medium mb-2">Model Configuration</div>

            <div className="grid gap-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PROVIDERS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                                {p.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <Label>Model</Label>
                <Select
                    value={model}
                    onValueChange={(m) => onChange({ ...config, model: m })}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(MODELS[provider] || []).map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <Label>Temperature (0.0 - 2.0)</Label>
                <Input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) onChange({ ...config, temperature: Math.min(Math.max(val, 0), 2) });
                    }}
                />
                <p className="text-[10px] text-muted-foreground">
                    Lower values = deterministic, higher = creative.
                </p>
            </div>

            <div className="grid gap-2">
                <Label>Max Tokens</Label>
                <Input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => onChange({ ...config, maxTokens: parseInt(e.target.value) || 1000 })}
                />
            </div>
        </div>
    );
}
