"use client";

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic2, Variable, Clock, AudioWaveform } from 'lucide-react';

interface ListenNodeConfigProps {
    data: any;
    onChange: (newData: any) => void;
}

export function ListenNodeConfig({ data, onChange }: ListenNodeConfigProps) {
    const [variableName, setVariableName] = useState(data.variableName || 'user_input');
    const [timeout, setTimeout] = useState(data.timeout || 30000);
    const [inputMode, setInputMode] = useState<'text' | 'stt'>(data.inputMode || 'text');
    const [sttProvider, setSttProvider] = useState<string | undefined>(data.sttProvider);
    const [language, setLanguage] = useState<string>(data.language || 'en-US');

    // Display in seconds
    const timeoutSeconds = Math.round(timeout / 1000);

    const handleChange = useCallback((updates: Record<string, any>) => {
        onChange({ ...data, ...updates });
    }, [data, onChange]);

    const handleVariableNameChange = (value: string) => {
        setVariableName(value);
        handleChange({ variableName: value });
    };

    const handleTimeoutChange = (seconds: number) => {
        const ms = seconds * 1000;
        setTimeout(ms);
        handleChange({ timeout: ms });
    };

    const handleInputModeChange = (enabled: boolean) => {
        const mode = enabled ? 'stt' : 'text';
        setInputMode(mode);
        handleChange({ inputMode: mode });
    };

    const handleProviderChange = (value: string) => {
        const provider = value === 'auto' ? undefined : value;
        setSttProvider(provider);
        handleChange({ sttProvider: provider });
    };

    const handleLanguageChange = (value: string) => {
        setLanguage(value);
        handleChange({ language: value });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                    <Mic2 className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">Listen Node</h3>
                    <p className="text-xs text-muted-foreground">Capture user input (text or voice)</p>
                </div>
            </div>

            <Separator />

            {/* Voice Input Toggle */}
            <Card className="border-dashed border-orange-500/30">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AudioWaveform className="h-4 w-4 text-orange-500" />
                            <CardTitle className="text-sm">Voice Input (STT)</CardTitle>
                        </div>
                        <Switch
                            checked={inputMode === 'stt'}
                            onCheckedChange={handleInputModeChange}
                        />
                    </div>
                    <CardDescription className="text-xs">
                        {inputMode === 'stt'
                            ? "User speaks, audio is transcribed to text"
                            : "User types text input"}
                    </CardDescription>
                </CardHeader>

                {inputMode === 'stt' && (
                    <CardContent className="space-y-4 pt-0">
                        {/* STT Provider */}
                        <div className="space-y-2">
                            <Label className="text-xs">STT Provider</Label>
                            <Select value={sttProvider || 'auto'} onValueChange={handleProviderChange}>
                                <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Auto (from Vault)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto (from Vault)</SelectItem>
                                    <SelectItem value="elevenlabs">ElevenLabs Scribe</SelectItem>
                                    <SelectItem value="deepgram">Deepgram</SelectItem>
                                    <SelectItem value="google">Google Cloud STT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Language */}
                        <div className="space-y-2">
                            <Label className="text-xs">Language</Label>
                            <Select value={language} onValueChange={handleLanguageChange}>
                                <SelectTrigger className="text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="eng">English</SelectItem>
                                    <SelectItem value="spa">Spanish</SelectItem>
                                    <SelectItem value="fra">French</SelectItem>
                                    <SelectItem value="deu">German</SelectItem>
                                    <SelectItem value="hin">Hindi</SelectItem>
                                    <SelectItem value="jpn">Japanese</SelectItem>
                                    <SelectItem value="zho">Chinese</SelectItem>
                                    <SelectItem value="por">Portuguese</SelectItem>
                                    <SelectItem value="ara">Arabic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Variable Name */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Variable className="h-4 w-4 text-green-500" />
                        <CardTitle className="text-sm">Save Input As</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        Variable name to store the {inputMode === 'stt' ? 'transcribed speech' : 'text input'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Input
                        placeholder="user_input"
                        value={variableName}
                        onChange={(e) => handleVariableNameChange(e.target.value)}
                        className="font-mono text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Access in other nodes as{' '}
                        <code className="text-primary bg-primary/10 px-1 rounded">{`{{${variableName || 'user_input'}}}`}</code>
                    </p>
                </CardContent>
            </Card>

            {/* Timeout */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <CardTitle className="text-sm">
                            {inputMode === 'stt' ? 'Silence Timeout' : 'Input Timeout'}
                        </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        {inputMode === 'stt'
                            ? 'How long to wait for speech before timing out'
                            : 'How long to wait for text input before timing out'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Slider
                            value={[timeoutSeconds]}
                            onValueChange={([value]) => handleTimeoutChange(value)}
                            min={5}
                            max={60}
                            step={5}
                            className="flex-1"
                        />
                        <div className="w-16 text-center">
                            <span className="text-lg font-semibold">{timeoutSeconds}</span>
                            <span className="text-xs text-muted-foreground ml-1">sec</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        If no input is received within this time, the workflow will proceed to the next node.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

