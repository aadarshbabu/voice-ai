"use client";

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Plus, Trash2, Webhook, Link, Shield, Variable } from 'lucide-react';

interface WebhookNodeConfigProps {
    data: any;
    onChange: (newData: any) => void;
}

export function WebhookNodeConfig({ data, onChange }: WebhookNodeConfigProps) {
    const [slug, setSlug] = useState(data.slug || '');
    const [authType, setAuthType] = useState(data.authType || 'none');
    const [sharedSecret, setSharedSecret] = useState(data.sharedSecret || '');
    const [variableMapping, setVariableMapping] = useState<Array<{ path: string; variable: string }>>(data.variableMapping || []);

    const updateParent = useCallback((updates: Record<string, any>) => {
        onChange({ ...data, ...updates });
    }, [data, onChange]);

    const handleSlugChange = (value: string) => {
        // Clean slug (lowercase, dashes, no spaces)
        const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        setSlug(cleaned);
        updateParent({ slug: cleaned, authType, sharedSecret, variableMapping });
    };

    const handleAuthTypeChange = (value: string) => {
        setAuthType(value);
        updateParent({ slug, authType: value, sharedSecret, variableMapping });
    };

    const handleSecretChange = (value: string) => {
        setSharedSecret(value);
        updateParent({ slug, authType, sharedSecret: value, variableMapping });
    };

    const handleMappingChange = (index: number, field: 'path' | 'variable', value: string) => {
        const newMapping = [...variableMapping];
        newMapping[index] = { ...newMapping[index], [field]: value };
        setVariableMapping(newMapping);
        updateParent({ slug, authType, sharedSecret, variableMapping: newMapping });
    };

    const addMapping = () => {
        const newMapping = [...variableMapping, { path: '', variable: '' }];
        setVariableMapping(newMapping);
        updateParent({ slug, authType, sharedSecret, variableMapping: newMapping });
    };

    const removeMapping = (index: number) => {
        const newMapping = variableMapping.filter((_, i) => i !== index);
        setVariableMapping(newMapping);
        updateParent({ slug, authType, sharedSecret, variableMapping: newMapping });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                    <Webhook className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">Webhook Trigger</h3>
                    <p className="text-xs text-muted-foreground">Trigger workflow via external HTTP</p>
                </div>
            </div>

            <Separator />

            {/* Slug Configuration */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Link className="h-4 w-4 text-blue-500" />
                        <CardTitle className="text-sm">Endpoint Identifier</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Webhook Slug</Label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">/api/webhooks/</span>
                            <Input
                                placeholder="my-custom-trigger"
                                value={slug}
                                onChange={(e) => handleSlugChange(e.target.value)}
                                className="flex-1 font-mono text-sm"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                            Used as the URL segment to identify this webhook.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Security Configuration */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        <CardTitle className="text-sm">Security</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Authentication Type</Label>
                        <Select value={authType} onValueChange={handleAuthTypeChange}>
                            <SelectTrigger className="w-full text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None (Public)</SelectItem>
                                <SelectItem value="bearer">Bearer Token</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {authType === 'bearer' && (
                        <div className="space-y-2">
                            <Label className="text-xs font-medium">Shared Secret (Bearer Token)</Label>
                            <Input
                                type="password"
                                placeholder="Enter secret token"
                                value={sharedSecret}
                                onChange={(e) => handleSecretChange(e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Variable Mapping */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Variable className="h-4 w-4 text-green-500" />
                            <CardTitle className="text-sm">Payload Mapping</CardTitle>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={addMapping}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {variableMapping.length > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <span className="flex-1 text-[10px] font-bold uppercase text-muted-foreground">JSON Path</span>
                                <span className="flex-1 text-[10px] font-bold uppercase text-muted-foreground">Workflow Var</span>
                                <div className="h-8 w-8" />
                            </div>
                            {variableMapping.map((mapping, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input
                                        placeholder="$.body.user.id"
                                        value={mapping.path}
                                        onChange={(e) => handleMappingChange(index, 'path', e.target.value)}
                                        className="h-8 flex-1 text-sm font-mono"
                                    />
                                    <Input
                                        placeholder="user_id"
                                        value={mapping.variable}
                                        onChange={(e) => handleMappingChange(index, 'variable', e.target.value)}
                                        className="h-8 flex-1 text-sm font-mono"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => removeMapping(index)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground italic py-2">
                            No variables mapped. Request body and headers will be saved to <code className="bg-muted px-1 rounded">webhook_payload</code> by default.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
