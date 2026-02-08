"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sparkles,
    Cpu,
    Zap,
    Wind,
    Settings2,
    Thermometer,
    Hash,
    Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const PROVIDERS = [
    { value: 'openai', label: 'OpenAI', icon: Sparkles, color: 'text-emerald-500' },
    { value: 'anthropic', label: 'Anthropic', icon: Cpu, color: 'text-orange-500' },
    { value: 'google', label: 'Google Gemini', icon: Zap, color: 'text-blue-500' },
    { value: 'mistral', label: 'Mistral AI', icon: Wind, color: 'text-orange-400' },
];

export const MODELS: Record<string, { value: string; label: string; description?: string }[]> = {
    openai: [
        { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable model' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast, lightweight and cost-effective' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Previous generation speed' },
    ],
    anthropic: [
        { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', description: 'Perfect balance of speed and intelligence' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', description: 'Most powerful model for complex tasks' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Fastest model for simple tasks' },
    ],
    google: [
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Large context window (1M+ tokens)' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Optimized for speed and efficiency' },
    ],
    mistral: [
        { value: 'mistral-large-latest', label: 'Mistral Large', description: 'Top-tier reasoning capabilities' },
        { value: 'mistral-medium-latest', label: 'Mistral Medium', description: 'Ideal for balanced tasks' },
        { value: 'mistral-small-latest', label: 'Mistral Small', description: 'Fast and cost-effective' },
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

    const activeProvider = PROVIDERS.find(p => p.value === provider) || PROVIDERS[0];
    const ProviderIcon = activeProvider.icon;

    const handleProviderChange = (newProvider: string) => {
        const firstModel = MODELS[newProvider]?.[0]?.value || '';
        onChange({
            ...config,
            provider: newProvider,
            model: firstModel,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Settings2 className="h-3 w-3" />
                    Model Parameters
                </div>
            </div>

            <div className="grid gap-4">
                {/* Provider Selection */}
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">AI Provider</Label>
                        <ProviderIcon className={cn("h-3 w-3", activeProvider.color)} />
                    </div>
                    <Select value={provider} onValueChange={handleProviderChange}>
                        <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/10 hover:border-primary/50 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PROVIDERS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                    <div className="flex items-center gap-2">
                                        <p.icon className={cn("h-4 w-4", p.color)} />
                                        <span>{p.label}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Model Selection */}
                <div className="grid gap-2">
                    <Label className="text-xs font-semibold">Intelligence Model</Label>
                    <Select
                        value={model}
                        onValueChange={(m) => onChange({ ...config, model: m })}
                    >
                        <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/10 hover:border-primary/50 transition-colors">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(MODELS[provider] || []).map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                    <div className="flex flex-col py-0.5">
                                        <span className="text-sm font-medium">{m.label}</span>
                                        {m.description && (
                                            <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                {m.description}
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="pt-4 space-y-6">
                    {/* Temperature Slider */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Thermometer className="h-3 w-3 text-red-400" />
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Creativity</Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="h-3 w-3 text-muted-foreground/40" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[200px] text-[10px]">
                                            Higher values make output more random/creative, lower values make it more focused and deterministic.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                {temperature.toFixed(1)}
                            </span>
                        </div>
                        <Slider
                            value={[temperature]}
                            min={0}
                            max={2}
                            step={0.1}
                            onValueChange={([val]) => onChange({ ...config, temperature: val })}
                            className="py-2"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground px-0.5 font-medium italic">
                            <span>Deterministic</span>
                            <span>Balanced</span>
                            <span>Creative</span>
                        </div>
                    </div>

                    {/* Max Tokens Input */}
                    <div className="grid gap-2">
                        <div className="flex items-center gap-2">
                            <Hash className="h-3 w-3 text-blue-400" />
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Response Limit</Label>
                        </div>
                        <div className="relative">
                            <Input
                                type="number"
                                value={maxTokens}
                                onChange={(e) => onChange({ ...config, maxTokens: parseInt(e.target.value) || 1000 })}
                                className="h-10 bg-background/50 border-muted-foreground/10 pr-16 font-mono text-sm"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest pointer-events-none">
                                Tokens
                            </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground px-1 italic">
                            Total length of the response generated by the AI agent.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
