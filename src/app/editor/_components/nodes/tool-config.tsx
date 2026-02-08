"use client";

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Plus, Trash2, Globe, ArrowRight, Code, Variable, FileJson } from 'lucide-react';

interface ToolNodeConfigProps {
    data: any;
    onChange: (newData: any) => void;
}

const HTTP_METHODS = [
    { value: 'GET', color: 'text-green-500' },
    { value: 'POST', color: 'text-blue-500' },
    { value: 'PUT', color: 'text-amber-500' },
    { value: 'PATCH', color: 'text-purple-500' },
    { value: 'DELETE', color: 'text-red-500' },
] as const;

export function ToolNodeConfig({ data, onChange }: ToolNodeConfigProps) {
    const [method, setMethod] = useState(data.method || 'GET');
    const [url, setUrl] = useState(data.url || '');
    const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(data.headers || []);
    const [body, setBody] = useState(data.body || '');
    const [outputVar, setOutputVar] = useState(data.outputVar || 'http_response');
    const [responsePath, setResponsePath] = useState(data.responsePath || '');

    const showBody = ['POST', 'PUT', 'PATCH'].includes(method);

    const updateParent = useCallback((updates: Record<string, any>) => {
        onChange({ ...data, ...updates });
    }, [data, onChange]);

    const handleMethodChange = (value: string) => {
        setMethod(value);
        updateParent({ method: value, url, headers, body, outputVar, responsePath });
    };

    const handleUrlChange = (value: string) => {
        setUrl(value);
        updateParent({ method, url: value, headers, body, outputVar, responsePath });
    };

    const handleBodyChange = (value: string) => {
        setBody(value);
        updateParent({ method, url, headers, body: value, outputVar, responsePath });
    };

    const handleOutputVarChange = (value: string) => {
        setOutputVar(value);
        updateParent({ method, url, headers, body, outputVar: value, responsePath });
    };

    const handleResponsePathChange = (value: string) => {
        setResponsePath(value);
        updateParent({ method, url, headers, body, outputVar, responsePath: value });
    };

    const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
        const newHeaders = [...headers];
        newHeaders[index] = { ...newHeaders[index], [field]: value };
        setHeaders(newHeaders);
        updateParent({ method, url, headers: newHeaders, body, outputVar, responsePath });
    };

    const addHeader = () => {
        const newHeaders = [...headers, { key: '', value: '' }];
        setHeaders(newHeaders);
        updateParent({ method, url, headers: newHeaders, body, outputVar, responsePath });
    };

    const removeHeader = (index: number) => {
        const newHeaders = headers.filter((_, i) => i !== index);
        setHeaders(newHeaders);
        updateParent({ method, url, headers: newHeaders, body, outputVar, responsePath });
    };

    const methodColor = HTTP_METHODS.find(m => m.value === method)?.color || 'text-gray-500';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2">
                <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500">
                    <Globe className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">HTTP Request</h3>
                    <p className="text-xs text-muted-foreground">Call any external API</p>
                </div>
            </div>

            <Separator />

            {/* Method + URL */}
            <Card className="border-dashed overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-blue-500" />
                        <CardTitle className="text-sm">Request</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2">
                        <Select value={method} onValueChange={handleMethodChange}>
                            <SelectTrigger className={`w-[100px] font-mono font-semibold ${methodColor}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {HTTP_METHODS.map((m) => (
                                    <SelectItem key={m.value} value={m.value} className={`font-mono font-semibold ${m.color}`}>
                                        {m.value}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="https://api.example.com/endpoint/{{id}}"
                            value={url}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            className="flex-1 font-mono text-sm"
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        Use <code className="text-primary bg-primary/10 px-1 rounded">{'{{variable}}'}</code> for dynamic values
                    </p>
                </CardContent>
            </Card>

            {/* Headers */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Code className="h-4 w-4 text-orange-500" />
                            <CardTitle className="text-sm">Headers</CardTitle>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={addHeader}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {headers.length > 0 ? (
                        <div className="space-y-2">
                            {headers.map((header, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input
                                        placeholder="Header name"
                                        value={header.key}
                                        onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                                        className="h-8 flex-1 text-sm"
                                    />
                                    <Input
                                        placeholder="Value"
                                        value={header.value}
                                        onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                                        className="h-8 flex-1 text-sm font-mono"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => removeHeader(index)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground italic py-2">
                            No custom headers. Content-Type: application/json is sent by default.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Request Body */}
            {showBody && (
                <Card className="border-dashed">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4 text-cyan-500" />
                            <CardTitle className="text-sm">Request Body</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            JSON body with variable interpolation
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder='{"query": "{{user_input}}", "limit": 10}'
                            value={body}
                            onChange={(e) => handleBodyChange(e.target.value)}
                            className="min-h-[80px] font-mono text-sm bg-muted/30 resize-none"
                        />
                    </CardContent>
                </Card>
            )}

            {/* Output Configuration */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Variable className="h-4 w-4 text-green-500" />
                        <CardTitle className="text-sm">Response Handling</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Save Response As</Label>
                        <Input
                            placeholder="http_response"
                            value={outputVar}
                            onChange={(e) => handleOutputVarChange(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Access as{' '}
                            <code className="text-primary bg-primary/10 px-1 rounded">{`{{${outputVar || 'http_response'}}}`}</code>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Extract Value (Optional)</Label>
                        <Input
                            placeholder="data.items[0].title"
                            value={responsePath}
                            onChange={(e) => handleResponsePathChange(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            JSONPath to extract a specific value. Leave empty for full response.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
