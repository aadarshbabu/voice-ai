"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Play,
    RotateCcw,
    Send,
    Terminal,
    Variable,
    Settings2,
    Loader2,
    Sparkles,
    Bot,
    User,
    CheckCircle2,
    AlertCircle,
    Activity,
    Copy,
    Hash,
    Type,
    ToggleLeft,
    Box,
    Code2,
    List,
    Mic,
    MicOff,
    AudioLines,
    Volume2,
    VolumeX,
    Webhook,
    X,
} from 'lucide-react';
import { useWorkflowExecution } from '@/hooks/use-workflow-execution';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useWebRTCSession } from '@/hooks/use-webrtc-session';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Component to handle playing back the remote WebRTC audio stream
 */
function RemoteAudio({ track }: { track: MediaStreamTrack | null }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (track && audioRef.current) {
            const stream = new MediaStream([track]);
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(console.error);
        }
    }, [track]);

    return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;
}

interface LiveSimulatorProps {
    isOpen: boolean;
    onClose: () => void;
    workflowId: string;
}

const PROVIDER_MODELS: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
    google: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-pro-exp'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
};

export function LiveSimulator({
    isOpen,
    onClose,
    workflowId,
}: LiveSimulatorProps) {
    const [userInput, setUserInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'json'>('list');

    // LLM Configuration
    const [provider, setProvider] = useState<string>('openai');
    const [model, setModel] = useState('gpt-4o-mini');
    const [apiKey, setApiKey] = useState('');

    // Voice Recording
    const {
        status: voiceStatus,
        isRecording,
        audioLevel,
        startRecording,
        stopRecording,
        error: voiceError
    } = useVoiceRecorder({
        onRecordingComplete: async (audioBlob) => {
            // Send audio to gateway
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            // Skip intent resolution if we're already in an active session
            if (state?.status === 'waiting') {
                formData.append('skipIntent', 'true');
            }

            // Pass STT provider and language from the LISTEN node configuration
            if (state?.sttProvider) {
                formData.append('sttProvider', state.sttProvider);
            }
            if (state?.language) {
                formData.append('language', state.language);
            }

            try {
                const response = await fetch('/api/voice/command', {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Voice processing failed');
                }

                // Handle based on whether intent resolution was performed
                if (result.intent) {
                    // Intent resolution was performed
                    if (result.intent.resolved) {
                        toast.success(
                            `Starting "${result.intent.workflowName}" (${Math.round(result.intent.confidence || 0)}% confidence)`,
                            { duration: 3000 }
                        );
                        // The session was started by the gateway, user can continue in the simulator
                    } else {
                        // No workflow matched
                        toast.info(result.intent.message || "I didn't understand that command.", { duration: 4000 });
                        setUserInput(result.transcript);
                    }
                } else {
                    // We're in an active session - use transcript as input
                    if (result.transcript && state?.status === 'waiting') {
                        sendInput(result.transcript);
                        toast.success(`Voice: "${result.transcript}"`);
                    } else if (result.transcript) {
                        setUserInput(result.transcript);
                        toast.info('Transcript ready - press Enter to send');
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Voice processing failed';
                toast.error(message);
            }
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });

    const scrollRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { state, start, sendInput, reset, clearPendingAudio, isLoading } = useWorkflowExecution(workflowId);

    // WebRTC Voice Mode
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [remoteTrack, setRemoteTrack] = useState<MediaStreamTrack | null>(null);

    const {
        status: webrtcStatus,
        connect: connectWebRTC,
        disconnect: disconnectWebRTC,
        isMuted: isWebRTCMuted,
        mute: muteWebRTC,
        unmute: unmuteWebRTC,
        audioLevel: webrtcAudioLevel,
        error: webrtcError
    } = useWebRTCSession({
        sessionId: state?.sessionId || '',
        onRemoteTrack: (track) => {
            console.log('[WebRTC] Received remote audio track');
            setRemoteTrack(track);
        },
        onConnected: () => {
            toast.success("Voice connection established", { icon: <Mic className="h-4 w-4" /> });
        },
        onDisconnected: () => {
            setRemoteTrack(null);
        },
        onError: (err) => {
            toast.error(`Voice error: ${err.message}`);
            setIsVoiceMode(false);
        }
    });

    // Debug: Log Voice State changes in the console
    useEffect(() => {
        if (isVoiceMode && state?.fsmState) {
            console.log(`[Simulator] Voice State: ${state.fsmState} | status: ${state.status}`);
        }
    }, [state?.fsmState, state?.status, isVoiceMode]);

    // Handle Voice Mode Toggle
    useEffect(() => {
        const canConnect = webrtcStatus === 'idle' || webrtcStatus === 'disconnected' || webrtcStatus === 'failed';

        if (isVoiceMode && state?.sessionId && canConnect) {
            connectWebRTC();
        } else if (!isVoiceMode && (webrtcStatus === 'connected' || webrtcStatus === 'connecting')) {
            disconnectWebRTC();
        }
    }, [isVoiceMode, state?.sessionId, webrtcStatus, connectWebRTC, disconnectWebRTC]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const playedMessageIds = useRef<Set<string>>(new Set());
    const [audioPlaying, setAudioPlaying] = useState(false);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setAudioPlaying(false);
    }, []);

    const playAudio = useCallback((audioBase64: string, mimeType: string) => {
        try {
            stopAudio();

            const audioData = `data:${mimeType};base64,${audioBase64}`;
            const audio = new Audio(audioData);
            audioRef.current = audio;

            audio.onplay = () => setAudioPlaying(true);
            audio.onended = () => setAudioPlaying(false);
            audio.onpause = () => setAudioPlaying(false);
            audio.onerror = () => setAudioPlaying(false);

            audio.play().catch(error => {
                console.warn('[TTS] Playback failed (likely browser policy):', error);
                setAudioPlaying(false);
            });
        } catch (error) {
            console.error('[TTS] Error playing audio:', error);
            setAudioPlaying(false);
        }
    }, [stopAudio]);

    // Play TTS audio from transcript messages
    useEffect(() => {
        if (!state?.transcript) return;

        // Reset played messages if transcript is empty (session reset)
        if (state.transcript.length === 0) {
            playedMessageIds.current.clear();
            return;
        }

        // Find agent messages with audio that haven't been played yet
        const unplayedMessages = (state.transcript as any[]).filter(m => {
            if (m.role !== 'agent' || !m.audioBase64 || !m.mimeType) return false;
            const id = `${m.nodeId}-${m.timestamp}`;
            return !playedMessageIds.current.has(id);
        });

        if (unplayedMessages.length > 0) {
            // Mark all as played immediately
            unplayedMessages.forEach(m => {
                const id = `${m.nodeId}-${m.timestamp}`;
                playedMessageIds.current.add(id);
            });

            // Play the most recent one
            const messageToPlay = unplayedMessages[unplayedMessages.length - 1];
            playAudio(messageToPlay.audioBase64, messageToPlay.mimeType);
        }
    }, [state?.transcript, playAudio]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [state?.transcript, state?.status]);

    // Update model when provider changes
    useEffect(() => {
        const models = PROVIDER_MODELS[provider];
        if (models && models.length > 0) {
            setModel(models[0]);
        }
    }, [provider]);

    const handleStart = () => {
        start({
            provider: provider as any,
            model,
            apiKey: apiKey || undefined,
        });
    };

    const handleSend = () => {
        if (!userInput.trim() || state?.status !== 'waiting') return;

        // If we're waiting for a webhook, format the input as JSON if possible
        if (state.webhookSlug) {
            try {
                // Try to validate if it's already JSON
                JSON.parse(userInput);
                sendInput(userInput);
            } catch (e) {
                // If not JSON, wrap it in a simple object
                sendInput(JSON.stringify({ text: userInput }));
            }
        } else {
            sendInput(userInput);
        }

        setUserInput('');
    };

    const handleReset = () => {
        handleResetAnimation();
        setTimeout(() => {
            reset();
            setUserInput('');
        }, 100);
    };

    const [isResetting, setIsResetting] = useState(false);
    const handleResetAnimation = () => {
        setIsResetting(true);
        setTimeout(() => setIsResetting(false), 500);
    };

    const getStatusInfo = () => {
        switch (state?.status) {
            case 'running': return { label: 'Thinking', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Activity };
            case 'waiting': return { label: 'Waiting for Input', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: User };
            case 'completed': return { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 };
            case 'error': return { label: 'Error', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertCircle };
            default: return { label: 'Idle', color: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-muted/20', icon: Terminal };
        }
    };

    const status = getStatusInfo();

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-lg flex flex-col h-screen border-l shadow-2xl bg-gradient-to-b from-background via-background to-muted/10 p-0 overflow-hidden">
                {/* Visual Header Background */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                <SheetHeader className="p-6 pb-4 border-b relative shrink-0">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <SheetTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shadow-sm">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                </div>
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                                    Live Simulator
                                </span>
                            </SheetTitle>
                            <SheetDescription className="text-sm">
                                Real-time execution of your workflow engine
                            </SheetDescription>
                        </div>

                        <div className="flex items-center gap-3 pr-8">
                            {state?.sessionId && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsVoiceMode(!isVoiceMode)}
                                        className={cn(
                                            "h-8 gap-2 px-3 rounded-full border transition-all duration-300",
                                            isVoiceMode
                                                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                                        )}
                                        title={isVoiceMode ? "Disable Voice Mode" : "Enable Real-time Voice Mode"}
                                    >
                                        {isVoiceMode ? (
                                            <>
                                                <div className="flex flex-col items-start mr-1">
                                                    <span className="text-[10px] font-bold leading-none">VOICE: ON</span>
                                                    <div className="flex gap-0.5 mt-0.5 h-1 items-center">
                                                        {[...Array(5)].map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className={cn(
                                                                    "w-1 h-full rounded-full transition-all duration-75",
                                                                    webrtcAudioLevel > (i * 20) ? "bg-primary" : "bg-primary/20"
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <AudioLines className={cn("h-3.5 w-3.5", webrtcAudioLevel > 10 ? "animate-pulse" : "")} />
                                            </>
                                        ) : (
                                            <>
                                                <MicOff className="h-3.5 w-3.5 opacity-50" />
                                                <span className="text-[10px] font-bold">VOICE: OFF</span>
                                            </>
                                        )}
                                    </Button>

                                    <div className={cn(
                                        "flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-medium transition-all duration-500",
                                        state.connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                            state.connectionStatus === 'connecting' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' :
                                                'bg-red-500/10 text-red-500 border-red-500/20'
                                    )}>
                                        <div className={cn(
                                            "h-1.5 w-1.5 rounded-full",
                                            state.connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' :
                                                state.connectionStatus === 'connecting' ? 'bg-amber-500' :
                                                    'bg-red-500'
                                        )} />
                                        {state.connectionStatus === 'connected' ? 'SYNCED' :
                                            state.connectionStatus === 'connecting' ? 'SYNCING' :
                                                'OFFLINE'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 flex flex-col min-h-0 relative z-10 px-6 py-4 gap-4 overflow-hidden">
                    {/* Controls & Mini Settings */}
                    <div className="flex flex-col gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                            {state?.status === 'idle' ? (
                                <Button
                                    onClick={handleStart}
                                    className="flex-1 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all duration-300 h-10 shadow-sm"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Play className="h-4 w-4 fill-current" />
                                    )}
                                    Start Session
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={handleReset}
                                    className={cn(
                                        "flex-1 gap-2 h-10 border-muted-foreground/20 hover:bg-muted/50 transition-all",
                                        isResetting && "scale-95 opacity-50"
                                    )}
                                >
                                    <RotateCcw className={cn("h-4 w-4", isResetting && "animate-spin")} />
                                    Restart Session
                                </Button>
                            )}

                            <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className={cn(
                                            "h-10 w-10 border-muted-foreground/20 shrink-0 transition-colors",
                                            showSettings && "bg-primary/10 border-primary/30 text-primary"
                                        )}
                                        disabled={state?.status !== 'idle'}
                                    >
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                </CollapsibleTrigger>
                            </Collapsible>
                        </div>

                        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                            <CollapsibleContent className="mt-1">
                                <div className="space-y-4 p-4 rounded-2xl border bg-card/40 backdrop-blur-md shadow-inner animate-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Provider</Label>
                                            <Select value={provider} onValueChange={(v) => setProvider(v)}>
                                                <SelectTrigger className="h-9 bg-background/50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="openai">OpenAI</SelectItem>
                                                    <SelectItem value="anthropic">Anthropic</SelectItem>
                                                    <SelectItem value="google">Google</SelectItem>
                                                    <SelectItem value="mistral">Mistral</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Model</Label>
                                            <Select value={model} onValueChange={setModel}>
                                                <SelectTrigger className="h-9 bg-background/50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(PROVIDER_MODELS[provider] || []).map((m) => (
                                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex justify-between">
                                            <span>API Key</span>
                                            <span className="normal-case font-normal text-[10px] opacity-70">Optional</span>
                                        </Label>
                                        <Input
                                            type="password"
                                            placeholder="sk-..."
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            className="h-9 bg-background/50 font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col min-h-0 border rounded-3xl bg-card/20 backdrop-blur-sm shadow-xl overflow-hidden relative border-muted/30">
                        {/* Status Strip */}
                        <div className={cn(
                            "absolute top-0 left-0 right-0 h-[3px] z-20",
                            status.bg.replace('/10', '/50')
                        )} />

                        <div className="flex-1 overflow-y-auto scrollbar-none scroll-smooth">
                            <div className="p-6 space-y-6">
                                {(state?.transcript?.length ?? 0) === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                                        <div className="relative">
                                            <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-20" />
                                            <Bot className="h-16 w-16 text-muted-foreground/20 relative" />
                                        </div>
                                        <p className="mt-4 text-sm font-medium text-muted-foreground/60 text-center max-w-[200px]">
                                            {state?.status === 'idle'
                                                ? 'Start a session to begin testing your workflow'
                                                : 'Waiting for the agent to initialize...'}
                                        </p>
                                    </div>
                                )}

                                {(state?.transcript ?? []).map((msg, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex flex-col transition-all duration-300 animate-in mb-4 last:mb-0 group",
                                            msg.role === 'user' ? "items-end slide-in-from-right-2" : "items-start slide-in-from-left-2"
                                        )}
                                    >
                                        <div className="flex items-end gap-2 max-w-[90%]">
                                            {msg.role !== 'user' && (
                                                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-1 shrink-0">
                                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                                </div>
                                            )}
                                            <div className={cn(
                                                "relative px-4 py-3 text-sm shadow-sm transition-all",
                                                msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-none'
                                                    : 'bg-muted/50 border border-muted-foreground/10 rounded-2xl rounded-bl-none text-foreground',
                                                // Handle JSON formatting for webhooks
                                                msg.text.trim().startsWith('{') && "font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
                                            )}>
                                                {msg.text.trim().startsWith('{') ? (
                                                    <div className="opacity-90">
                                                        {(() => {
                                                            try {
                                                                return JSON.stringify(JSON.parse(msg.text), null, 2);
                                                            } catch (e) {
                                                                return msg.text;
                                                            }
                                                        })()}
                                                    </div>
                                                ) : (
                                                    msg.text
                                                )}
                                                {(msg as any).audioBase64 && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => playAudio((msg as any).audioBase64, (msg as any).mimeType)}
                                                    >
                                                        <Volume2 className="h-4 w-4 text-primary" />
                                                    </Button>
                                                )}
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="w-6 h-6 rounded-full bg-secondary/30 border border-secondary flex items-center justify-center mb-1 shrink-0">
                                                    <User className="h-3.5 w-3.5 text-foreground/70" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5 px-8">
                                            <span className="text-[9px] text-muted-foreground/50 font-medium tracking-tight">
                                                {msg.role === 'user' ? 'YOU' : 'AGENT'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {(msg as any).audioBase64 && (
                                                <span className="flex items-center gap-1 text-[9px] text-primary/60 font-semibold px-1.5 py-0.5 bg-primary/5 rounded-full border border-primary/10">
                                                    <Volume2 className="h-2.5 w-2.5" />
                                                    VOICE
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {state?.status === 'running' && (
                                    <div className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-1 shrink-0">
                                            <Activity className="h-3 w-3 text-primary animate-pulse" />
                                        </div>
                                        <div className="bg-muted/40 border border-muted-foreground/5 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5 h-[40px]">
                                            <div className="h-1.5 w-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                            <div className="h-1.5 w-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                            <div className="h-1.5 w-1.5 bg-primary/50 rounded-full animate-bounce" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} className="h-2 w-full" />
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-background/50 border-t backdrop-blur-md shrink-0">
                            <div className="flex gap-2 items-center">
                                {/* Voice Button */}
                                <Button
                                    size="icon"
                                    variant={isRecording ? "destructive" : "outline"}
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={voiceStatus === 'processing' || voiceStatus === 'requesting'}
                                    className={cn(
                                        "h-11 w-11 shrink-0 rounded-xl transition-all duration-300 relative overflow-hidden",
                                        isRecording && "animate-pulse",
                                        voiceStatus === 'processing' && "opacity-50"
                                    )}
                                    title={isRecording ? "Stop recording" : "Start voice input"}
                                >
                                    {/* Audio level indicator */}
                                    {(isRecording || isVoiceMode) && (
                                        <div
                                            className={cn(
                                                "absolute inset-0 transition-all duration-75",
                                                isRecording ? "bg-red-500/30" : "bg-primary/30"
                                            )}
                                            style={{
                                                transform: `scaleY(${(isVoiceMode ? webrtcAudioLevel : audioLevel) / 100})`,
                                                transformOrigin: 'bottom'
                                            }}
                                        />
                                    )}
                                    {voiceStatus === 'processing' ? (
                                        <Loader2 className="h-4 w-4 animate-spin relative z-10" />
                                    ) : (isRecording || isVoiceMode) ? (
                                        <MicOff className="h-4 w-4 relative z-10" />
                                    ) : (
                                        <Mic className="h-4 w-4 relative z-10" />
                                    )}
                                </Button>

                                {isVoiceMode && (
                                    <div className="flex flex-col gap-1 pr-2">
                                        <div className="flex gap-1 animate-in fade-in slide-in-from-right-1">
                                            <Badge variant="outline" className="text-[8px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1 py-0">LIVE AUDIO</Badge>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[8px] h-4 px-1 py-0 transition-colors uppercase font-bold",
                                                    (state as any)?.fsmState === 'LISTENING' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                                                        (state as any)?.fsmState === 'SPEAKING' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                                            (state as any)?.fsmState === 'THINKING' ? "bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold animate-pulse" :
                                                                "bg-muted text-muted-foreground border-muted-foreground/20"
                                                )}
                                            >
                                                {(state as any)?.fsmState || 'IDLE'}
                                            </Badge>
                                        </div>
                                    </div>
                                )}

                                {/* Webhook Trigger Mode Indicator */}
                                {state?.webhookSlug && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 animate-in zoom-in slide-in-from-left-2 shrink-0">
                                        <Webhook className="h-4 w-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Webhook Mode</span>
                                    </div>
                                )}

                                {/* Stop Audio Button */}
                                {audioPlaying && (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={stopAudio}
                                        className="h-11 w-11 shrink-0 rounded-xl bg-orange-500/10 border-orange-500/30 text-orange-600 hover:bg-orange-500/20 animate-in zoom-in slide-in-from-left-2"
                                        title="Stop audio playback"
                                    >
                                        <VolumeX className="h-4 w-4" />
                                    </Button>
                                )}

                                {/* Text Input */}
                                <div className="flex-1 relative">
                                    <Input
                                        placeholder={
                                            isRecording
                                                ? "Recording... click mic to stop"
                                                : voiceStatus === 'processing'
                                                    ? "Processing speech..."
                                                    : state?.status === 'waiting'
                                                        ? state.webhookSlug
                                                            ? 'Enter JSON payload (e.g. {"test": true})...'
                                                            : "Type or use voice..."
                                                        : state?.status === 'running'
                                                            ? "Agent is thinking..."
                                                            : "Start a session..."
                                        }
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        disabled={state?.status !== 'waiting' || isRecording}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                        className="h-11 bg-background border-muted-foreground/20 rounded-2xl pr-12 focus-visible:ring-primary shadow-sm"
                                    />
                                    <Button
                                        size="icon"
                                        onClick={handleSend}
                                        className={cn(
                                            "absolute right-1 top-1 h-9 w-9 bg-primary hover:bg-primary/90 rounded-xl transition-all duration-300",
                                            (!userInput.trim() || state?.status !== 'waiting') && "opacity-0 scale-50"
                                        )}
                                        disabled={state?.status !== 'waiting' || !userInput.trim()}
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Voice status indicator */}
                            {(isRecording || voiceStatus === 'processing' || (isVoiceMode && webrtcStatus === 'connected')) && (
                                <div className="flex items-center gap-2 mt-2 px-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1">
                                    <AudioLines className={cn(
                                        "h-3 w-3",
                                        isRecording ? "text-red-500 animate-pulse" :
                                            isVoiceMode ? "text-primary animate-pulse" : ""
                                    )} />
                                    <span className="font-medium tracking-tight">
                                        {isRecording
                                            ? `Recording... (${Math.round(audioLevel)}% volume)`
                                            : isVoiceMode
                                                ? `Voice Mode Active — ${webrtcAudioLevel > 5 ? 'I can hear you' : 'Silence'}`
                                                : 'Transcribing audio...'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Variables & State Inspector */}
                    <div className="h-[180px] flex flex-col gap-2 shrink-0">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2 group">
                                <Variable className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-0.5">Context</span>
                                <Badge variant="secondary" className="h-4 min-w-4 rounded-full text-[9px] px-1 bg-primary/10 text-primary border-none">
                                    {Object.keys(state?.variables ?? {}).length}
                                </Badge>

                                <div className="ml-2 flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-muted-foreground/10 h-7">
                                    <Button
                                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                        size="icon"
                                        className={cn("h-6 w-6 rounded-md", viewMode === 'list' && "bg-background shadow-sm")}
                                        onClick={() => setViewMode('list')}
                                        title="List View"
                                    >
                                        <List className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant={viewMode === 'json' ? 'secondary' : 'ghost'}
                                        size="icon"
                                        className={cn("h-6 w-6 rounded-md", viewMode === 'json' && "bg-background shadow-sm")}
                                        onClick={() => setViewMode('json')}
                                        title="JSON View"
                                    >
                                        <Code2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            {state?.currentNodeId && (
                                <div className="flex items-center gap-1.5 group">
                                    <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                                        {state.currentNodeId.slice(0, 8)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 rounded-2xl border border-muted-foreground/10 bg-muted/20 backdrop-blur-sm overflow-hidden flex flex-col relative group">
                            <div className="flex-1 h-full overflow-hidden flex flex-col">
                                {Object.keys(state?.variables ?? {}).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center flex-1 opacity-40">
                                        <p className="text-[10px] italic">No active variables</p>
                                    </div>
                                ) : (
                                    viewMode === 'list' ? (
                                        <ScrollArea className="flex-1 h-full">
                                            <div className="p-2 space-y-1">
                                                {Object.entries(state?.variables ?? {}).map(([key, value]) => (
                                                    <div
                                                        key={key}
                                                        className="flex items-center justify-between p-2 rounded-lg bg-card/40 border border-transparent hover:border-muted-foreground/20 hover:bg-card/80 transition-all group/item"
                                                    >
                                                        <div className="flex items-center gap-2 max-w-[60%]">
                                                            <div className="p-1 rounded bg-background border border-muted-foreground/10">
                                                                {typeof value === 'number' ? <Hash className="h-3 w-3 text-blue-400" /> :
                                                                    typeof value === 'boolean' ? <ToggleLeft className="h-3 w-3 text-emerald-400" /> :
                                                                        <Type className="h-3 w-3 text-amber-400" />}
                                                            </div>
                                                            <span className="text-[11px] font-mono font-medium truncate">{key}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-right">
                                                            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                                                                {typeof value === 'object' ? JSON.stringify(value).slice(0, 20) + '...' : String(value)}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
                                                                    toast.success(`Copied ${key}`);
                                                                }}
                                                            >
                                                                <Copy className="h-2.5 w-2.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    ) : (
                                        <div className="flex-1 h-full flex flex-col overflow-hidden relative">
                                            <div className="absolute top-1 right-2 z-20">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 bg-background/50 backdrop-blur"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(JSON.stringify(state?.variables, null, 2));
                                                        toast.success("Full context copied");
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <ScrollArea className="flex-1 h-full">
                                                <pre className="p-3 text-[10px] font-mono leading-relaxed text-muted-foreground overflow-x-auto">
                                                    <code className="block">
                                                        {JSON.stringify(state?.variables, null, 2)}
                                                    </code>
                                                </pre>
                                            </ScrollArea>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Status Bar */}
                <div className="mt-auto border-t bg-muted/30 backdrop-blur-xl px-6 py-2 relative z-10 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-tight shadow-sm transition-all duration-500",
                                status.bg,
                                status.color,
                                status.border
                            )}>
                                <status.icon className="h-3 w-3" />
                                {status.label.toUpperCase()}
                            </div>
                            {state?.sessionId && (
                                <span className="text-[10px] font-mono text-muted-foreground/60 transition-opacity duration-300">
                                    SID: {state.sessionId.slice(0, 8)}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-20" />
                            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">System Ready</span>
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {state?.error && (
                    <div className="p-3 bg-destructive/10 border-t border-destructive/20 text-destructive text-[11px] flex items-center gap-2 animate-in slide-in-from-bottom-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 font-medium">{state?.error}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-destructive/10 text-destructive"
                            onClick={() => reset()}
                        >
                            <RotateCcw className="h-3 w-3" />
                        </Button>
                    </div>
                )}
                {/* Remote WebRTC Audio */}
                <RemoteAudio track={remoteTrack} />
            </SheetContent>
        </Sheet>
    );
}
