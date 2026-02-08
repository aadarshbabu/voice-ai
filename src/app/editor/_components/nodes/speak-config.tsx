"use client";

import React, { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, MessageCircle, Mic2, Zap } from 'lucide-react';

interface SpeakNodeConfigProps {
    data: any;
    onChange: (newData: any) => void;
}

export function SpeakNodeConfig({ data, onChange }: SpeakNodeConfigProps) {
    const [text, setText] = useState(data.text || '');
    const [voiceMode, setVoiceMode] = useState<'text' | 'tts'>(data.voiceMode || 'tts');
    const [ttsProvider, setTtsProvider] = useState<string | undefined>(data.ttsProvider);
    const [voiceId, setVoiceId] = useState<string>(data.voiceId || '');
    const [speed, setSpeed] = useState<number>(data.speed || 1.0);
    const [language, setLanguage] = useState<string>(data.language || 'eng');

    const handleChange = useCallback((updates: Record<string, any>) => {
        onChange({ ...data, ...updates });
    }, [data, onChange]);

    const handleTextChange = (value: string) => {
        setText(value);
        handleChange({ text: value });
    };

    const handleVoiceModeChange = (enabled: boolean) => {
        const mode = enabled ? 'tts' : 'text';
        setVoiceMode(mode);
        handleChange({ voiceMode: mode });
    };

    const handleProviderChange = (value: string) => {
        const provider = value === 'auto' ? undefined : value;
        setTtsProvider(provider);
        handleChange({ ttsProvider: provider });
    };

    const handleVoiceIdChange = (value: string) => {
        setVoiceId(value);
        handleChange({ voiceId: value || undefined });
    };

    const handleSpeedChange = (value: number) => {
        setSpeed(value);
        handleChange({ speed: value });
    };

    const handleLanguageChange = (value: string) => {
        setLanguage(value);
        handleChange({ language: value });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                    <Volume2 className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">Speak Node</h3>
                    <p className="text-xs text-muted-foreground">Play text as speech to the user</p>
                </div>
            </div>

            <Separator />

            {/* Voice Mode Toggle */}
            <Card className="border-dashed border-green-500/30">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Mic2 className="h-4 w-4 text-green-500" />
                            <CardTitle className="text-sm">Voice Output (TTS)</CardTitle>
                        </div>
                        <Switch
                            checked={voiceMode === 'tts'}
                            onCheckedChange={handleVoiceModeChange}
                        />
                    </div>
                    <CardDescription className="text-xs">
                        {voiceMode === 'tts'
                            ? "Text will be converted to audio using TTS"
                            : "Text only - no audio generated"}
                    </CardDescription>
                </CardHeader>

                {voiceMode === 'tts' && (
                    <CardContent className="space-y-4 pt-0">
                        {/* TTS Provider */}
                        <div className="space-y-2">
                            <Label className="text-xs">TTS Provider</Label>
                            <Select value={ttsProvider || 'auto'} onValueChange={handleProviderChange}>
                                <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Auto (from Vault)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto (from Vault)</SelectItem>
                                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                    <SelectItem value="google">Google Cloud TTS</SelectItem>
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

                        {/* Voice ID */}
                        <div className="space-y-2">
                            <Label className="text-xs">Voice ID (optional)</Label>
                            <Input
                                placeholder="Leave empty for default voice"
                                value={voiceId}
                                onChange={(e) => handleVoiceIdChange(e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* Speed */}
                        <div className="space-y-2">
                            <Label className="text-xs">Speech Speed</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={[speed]}
                                    onValueChange={([value]) => handleSpeedChange(value)}
                                    min={0.5}
                                    max={2.0}
                                    step={0.1}
                                    className="flex-1"
                                />
                                <span className="text-sm font-mono w-12 text-right">{speed.toFixed(1)}x</span>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Speech Text */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <CardTitle className="text-sm">Speech Content</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                        What should the AI agent say?
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        placeholder="Hello! How can I help you today?"
                        value={text}
                        onChange={(e) => handleTextChange(e.target.value)}
                        className="min-h-[120px] font-mono text-sm bg-muted/30 resize-none"
                    />
                    <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground">
                            Use variables from previous nodes:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {['{{user_input}}', '{{ai_reply}}', '{{http_response}}'].map((v) => (
                                <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors">
                                    {v}
                                </code>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

