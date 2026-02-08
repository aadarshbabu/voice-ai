"use client";

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Plus,
    Trash2,
    Bot,
    Sparkles,
    Wrench,
    Variable,
    Zap,
    ChevronDown,
    Settings2,
    Globe
} from 'lucide-react';
import { LLMModelConfig } from './llm-model-config';

interface AIAgentConfigProps {
    data: any;
    onChange: (newData: any) => void;
}

interface AgentTool {
    id: string;
    name: string;
    description: string;
    parameters: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean';
        description: string;
        required: boolean;
    }>;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers: Array<{ key: string; value: string }>;
    body?: string;
    responsePath?: string;
}

const HTTP_METHODS = [
    { value: 'GET', color: 'text-green-500' },
    { value: 'POST', color: 'text-blue-500' },
    { value: 'PUT', color: 'text-amber-500' },
    { value: 'PATCH', color: 'text-purple-500' },
    { value: 'DELETE', color: 'text-red-500' },
] as const;

export function AIAgentConfig({ data, onChange }: AIAgentConfigProps) {
    const [systemPrompt, setSystemPrompt] = useState(
        data.systemPrompt || 'You are an intelligent AI agent with access to tools. Analyze the user request and decide which tool to use, or respond directly if no tool is needed.'
    );
    const [userPromptTemplate, setUserPromptTemplate] = useState(data.userPromptTemplate || '{{user_input}}');
    const [tools, setTools] = useState<AgentTool[]>(data.tools || []);
    const [maxIterations, setMaxIterations] = useState(data.maxIterations || 3);
    const [saveAs, setSaveAs] = useState(data.saveAs || 'agent_response');

    const updateParent = useCallback((updates: Record<string, any>) => {
        onChange({ ...data, ...updates });
    }, [data, onChange]);

    const handleSystemPromptChange = (value: string) => {
        setSystemPrompt(value);
        updateParent({ systemPrompt: value, userPromptTemplate, tools, maxIterations, saveAs });
    };

    const handleUserPromptChange = (value: string) => {
        setUserPromptTemplate(value);
        updateParent({ systemPrompt, userPromptTemplate: value, tools, maxIterations, saveAs });
    };

    const handleSaveAsChange = (value: string) => {
        setSaveAs(value);
        updateParent({ systemPrompt, userPromptTemplate, tools, maxIterations, saveAs: value });
    };

    const handleMaxIterationsChange = (value: number) => {
        setMaxIterations(value);
        updateParent({ systemPrompt, userPromptTemplate, tools, maxIterations: value, saveAs });
    };

    // Tool management
    const addTool = () => {
        const newTool: AgentTool = {
            id: crypto.randomUUID(),
            name: '',
            description: '',
            parameters: [],
            method: 'GET',
            url: '',
            headers: [],
            body: '',
            responsePath: ''
        };
        const newTools = [...tools, newTool];
        setTools(newTools);
        updateParent({ systemPrompt, userPromptTemplate, tools: newTools, maxIterations, saveAs });
    };

    const updateTool = (toolId: string, updates: Partial<AgentTool>) => {
        const newTools = tools.map(t => t.id === toolId ? { ...t, ...updates } : t);
        setTools(newTools);
        updateParent({ systemPrompt, userPromptTemplate, tools: newTools, maxIterations, saveAs });
    };

    const removeTool = (toolId: string) => {
        const newTools = tools.filter(t => t.id !== toolId);
        setTools(newTools);
        updateParent({ systemPrompt, userPromptTemplate, tools: newTools, maxIterations, saveAs });
    };

    const addParameter = (toolId: string) => {
        const tool = tools.find(t => t.id === toolId);
        if (!tool) return;
        const newParam = { name: '', type: 'string' as const, description: '', required: true };
        updateTool(toolId, { parameters: [...tool.parameters, newParam] });
    };

    const updateParameter = (toolId: string, paramIndex: number, updates: Partial<AgentTool['parameters'][0]>) => {
        const tool = tools.find(t => t.id === toolId);
        if (!tool) return;
        const newParams = [...tool.parameters];
        newParams[paramIndex] = { ...newParams[paramIndex], ...updates };
        updateTool(toolId, { parameters: newParams });
    };

    const removeParameter = (toolId: string, paramIndex: number) => {
        const tool = tools.find(t => t.id === toolId);
        if (!tool) return;
        const newParams = tool.parameters.filter((_, i) => i !== paramIndex);
        updateTool(toolId, { parameters: newParams });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
                    <Bot className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">AI Agent</h3>
                    <p className="text-xs text-muted-foreground">Intelligent agent with tool calling</p>
                </div>
            </div>

            <Separator />

            {/* System Prompt */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm">Agent Instructions</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Define how the AI agent should behave and when to use tools
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="You are an intelligent AI agent. Analyze the user's request and decide whether to use a tool or respond directly..."
                        value={systemPrompt}
                        onChange={(e) => handleSystemPromptChange(e.target.value)}
                        className="min-h-[100px] font-mono text-sm bg-muted/30 resize-none"
                    />
                </CardContent>
            </Card>

            {/* Context Template */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Context Template</CardTitle>
                    <CardDescription className="text-xs">
                        What context should be sent to the agent?
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        placeholder="User request: {{user_input}}"
                        value={userPromptTemplate}
                        onChange={(e) => handleUserPromptChange(e.target.value)}
                        className="min-h-[60px] font-mono text-sm bg-muted/30 resize-none"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Variables:</span>
                        {['{{user_input}}', '{{conversation_history}}'].map((v) => (
                            <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                {v}
                            </code>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Tools Section */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-orange-500" />
                            <CardTitle className="text-sm">Tools</CardTitle>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={addTool}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Tool
                        </Button>
                    </div>
                    <CardDescription className="text-xs">
                        Define HTTP-based tools that the agent can call
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tools.length === 0 ? (
                        <div className="py-8 text-center border-2 border-dashed rounded-lg">
                            <Wrench className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No tools configured</p>
                            <p className="text-xs text-muted-foreground/70">Add tools to enable agent capabilities</p>
                        </div>
                    ) : (
                        <Accordion type="single" collapsible className="space-y-2">
                            {tools.map((tool, index) => (
                                <AccordionItem
                                    key={tool.id}
                                    value={tool.id}
                                    className="border rounded-lg px-3 bg-muted/20"
                                >
                                    <AccordionTrigger className="py-3 hover:no-underline">
                                        <div className="flex items-center gap-3 flex-1 text-left">
                                            <div className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${HTTP_METHODS.find(m => m.value === tool.method)?.color || ''
                                                } bg-current/10`}>
                                                {tool.method}
                                            </div>
                                            <span className="font-medium text-sm">
                                                {tool.name || `Tool ${index + 1}`}
                                            </span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4">
                                        <div className="space-y-4 pt-2">
                                            {/* Tool Basics */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Tool Name</Label>
                                                    <Input
                                                        placeholder="get_weather"
                                                        value={tool.name}
                                                        onChange={(e) => updateTool(tool.id, { name: e.target.value })}
                                                        className="h-8 text-sm font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">HTTP Method</Label>
                                                    <Select
                                                        value={tool.method}
                                                        onValueChange={(v) => updateTool(tool.id, { method: v as any })}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {HTTP_METHODS.map((m) => (
                                                                <SelectItem key={m.value} value={m.value} className={m.color}>
                                                                    {m.value}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Description</Label>
                                                <Textarea
                                                    placeholder="Describe what this tool does so the AI knows when to use it..."
                                                    value={tool.description}
                                                    onChange={(e) => updateTool(tool.id, { description: e.target.value })}
                                                    className="min-h-[60px] text-sm resize-none"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs">API URL</Label>
                                                <Input
                                                    placeholder="https://api.example.com/{{param_name}}"
                                                    value={tool.url}
                                                    onChange={(e) => updateTool(tool.id, { url: e.target.value })}
                                                    className="h-8 text-sm font-mono"
                                                />
                                            </div>

                                            {/* Parameters */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs">Parameters</Label>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => addParameter(tool.id)}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Add
                                                    </Button>
                                                </div>
                                                {tool.parameters.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground italic py-2">
                                                        No parameters. The AI will call this tool without arguments.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {tool.parameters.map((param, pIndex) => (
                                                            <div key={pIndex} className="flex items-start gap-2 p-2 rounded bg-muted/30">
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex gap-2">
                                                                        <Input
                                                                            placeholder="param_name"
                                                                            value={param.name}
                                                                            onChange={(e) => updateParameter(tool.id, pIndex, { name: e.target.value })}
                                                                            className="h-7 text-xs font-mono"
                                                                        />
                                                                        <Select
                                                                            value={param.type}
                                                                            onValueChange={(v) => updateParameter(tool.id, pIndex, { type: v as any })}
                                                                        >
                                                                            <SelectTrigger className="h-7 w-20 text-xs">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="string">str</SelectItem>
                                                                                <SelectItem value="number">num</SelectItem>
                                                                                <SelectItem value="boolean">bool</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <div className="flex items-center gap-1.5 ml-1">
                                                                            <input
                                                                                type="checkbox"
                                                                                id={`req-${tool.id}-${pIndex}`}
                                                                                checked={param.required}
                                                                                onChange={(e) => updateParameter(tool.id, pIndex, { required: e.target.checked })}
                                                                                className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
                                                                            />
                                                                            <Label htmlFor={`req-${tool.id}-${pIndex}`} className="text-[10px] whitespace-nowrap cursor-pointer">
                                                                                Req
                                                                            </Label>
                                                                        </div>
                                                                    </div>
                                                                    <Input
                                                                        placeholder="Parameter description"
                                                                        value={param.description}
                                                                        onChange={(e) => updateParameter(tool.id, pIndex, { description: e.target.value })}
                                                                        className="h-7 text-xs"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => removeParameter(tool.id, pIndex)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Body for POST/PUT/PATCH */}
                                            {['POST', 'PUT', 'PATCH'].includes(tool.method) && (
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Request Body (JSON)</Label>
                                                    <Textarea
                                                        placeholder='{"param": "{{param_name}}"}'
                                                        value={tool.body || ''}
                                                        onChange={(e) => updateTool(tool.id, { body: e.target.value })}
                                                        className="min-h-[60px] text-sm font-mono resize-none"
                                                    />
                                                </div>
                                            )}

                                            {/* Response Path */}
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Response Path (Optional)</Label>
                                                <Input
                                                    placeholder="data.result"
                                                    value={tool.responsePath || ''}
                                                    onChange={(e) => updateTool(tool.id, { responsePath: e.target.value })}
                                                    className="h-8 text-sm font-mono"
                                                />
                                            </div>

                                            {/* Delete Tool */}
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                className="w-full mt-2"
                                                onClick={() => removeTool(tool.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                Remove Tool
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </CardContent>
            </Card>

            {/* Agent Settings */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-gray-500" />
                        <CardTitle className="text-sm">Agent Settings</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Max Iterations */}
                    <div className="space-y-2">
                        <Label className="text-xs">Max Tool Calls</Label>
                        <div className="flex items-center gap-4">
                            <Slider
                                value={[maxIterations]}
                                onValueChange={([value]) => handleMaxIterationsChange(value)}
                                min={1}
                                max={10}
                                step={1}
                                className="flex-1"
                            />
                            <div className="w-12 text-center">
                                <span className="text-lg font-semibold">{maxIterations}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Maximum number of tool calls before agent generates final response
                        </p>
                    </div>

                    {/* Save As */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Variable className="h-3.5 w-3.5 text-green-500" />
                            <Label className="text-xs">Save Response As</Label>
                        </div>
                        <Input
                            placeholder="agent_response"
                            value={saveAs}
                            onChange={(e) => handleSaveAsChange(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Use as{' '}
                            <code className="text-primary bg-primary/10 px-1 rounded">{`{{${saveAs || 'agent_response'}}}`}</code>
                        </p>
                    </div>
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
