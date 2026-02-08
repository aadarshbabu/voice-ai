"use client";

import { useState } from "react";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpcClient";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Key, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Smartphone, Mic2, Cpu, Globe } from "lucide-react";
import { ProviderType } from "@/generated/prisma";

// Combined Providers List
const PROVIDERS = [
    { id: "openai", name: "OpenAI", description: "GPT-4o, TTS-1", icon: <Cpu className="h-5 w-5" />, vaultType: ProviderType.OPENAI },
    { id: "anthropic", name: "Anthropic", description: "Claude 3.5 Sonnet, Haiku", icon: <Cpu className="h-5 w-5" /> },
    { id: "google", name: "Google AI", description: "Gemini 1.5 Pro, Google TTS", icon: <Globe className="h-5 w-5" />, vaultType: ProviderType.GOOGLE },
    { id: "mistral", name: "Mistral AI", description: "Mistral Large, Medium", icon: <Cpu className="h-5 w-5" /> },
    { id: "elevenlabs", name: "ElevenLabs", description: "High-fidelity AI voices", icon: <Mic2 className="h-5 w-5" />, vaultType: ProviderType.ELEVENLABS },
    { id: "deepgram", name: "Deepgram", description: "Fast, accurate STT", icon: <Smartphone className="h-5 w-5" />, vaultType: ProviderType.DEEPGRAM },
] as const;

export default function SettingsPage() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Fetch from BOTH sources to ensure nothing is lost (AC: Restore existing)
    const { data: credentials } = useSuspenseQuery(trpc.credentials.list.queryOptions());
    const { data: vaultProviders } = useSuspenseQuery(trpc.voiceProvider.list.queryOptions());

    // Mutations
    const saveCredential = useMutation(trpc.credentials.save.mutationOptions({
        onSuccess: () => {
            toast.success("Credential saved successfully");
            queryClient.invalidateQueries({ queryKey: trpc.credentials.list.queryKey() });
        },
    }));

    const saveVaultProvider = useMutation(trpc.voiceProvider.save.mutationOptions({
        onSuccess: () => {
            toast.success("Provider configuration saved securely");
            queryClient.invalidateQueries({ queryKey: trpc.voiceProvider.list.queryKey() });
        },
    }));

    const deleteCredential = useMutation(trpc.credentials.delete.mutationOptions({
        onSuccess: () => {
            toast.success("Credential removed");
            queryClient.invalidateQueries({ queryKey: trpc.credentials.list.queryKey() });
        },
    }));

    const deleteVaultProvider = useMutation(trpc.voiceProvider.delete.mutationOptions({
        onSuccess: () => {
            toast.success("Provider removed");
            queryClient.invalidateQueries({ queryKey: trpc.voiceProvider.list.queryKey() });
        },
    }));

    const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
    const [customProviderId, setCustomProviderId] = useState("");
    const [customBaseUrl, setCustomBaseUrl] = useState("");
    const [customApiKey, setCustomApiKey] = useState("");

    const handleAddCustom = async () => {
        if (!customProviderId || !customApiKey) return;
        await saveCredential.mutateAsync({
            provider: customProviderId.toLowerCase(),
            apiKey: customApiKey,
            baseUrl: customBaseUrl || undefined,
        });
        setIsAddCustomOpen(false);
        setCustomProviderId("");
        setCustomBaseUrl("");
        setCustomApiKey("");
    };

    // Derived custom providers
    const standardIds = PROVIDERS.map(p => p.id) as string[];
    const customCredentials = (credentials as any)?.filter((c: any) => !standardIds.includes(c.provider)) || [];

    return (
        <div className="container mx-auto py-10 space-y-8 px-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI Vault</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your AI providers. Voice and core credentials are encrypted with AES-256-GCM.
                    </p>
                </div>
                <Dialog open={isAddCustomOpen} onOpenChange={setIsAddCustomOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <Plus className="mr-2 h-4 w-4" /> Add Custom
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Custom Provider</DialogTitle>
                            <DialogDescription>Add an OpenAI-compatible provider (e.g. Groq, Together AI).</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Provider ID</Label>
                                <Input placeholder="e.g. groq" value={customProviderId} onChange={e => setCustomProviderId(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Base URL</Label>
                                <Input placeholder="https://api.groq.com/openai/v1" value={customBaseUrl} onChange={e => setCustomBaseUrl(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>API Key</Label>
                                <Input type="password" value={customApiKey} onChange={e => setCustomApiKey(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddCustom} disabled={!customProviderId || !customApiKey || saveCredential.isPending}>
                                {saveCredential.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Provider
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {PROVIDERS.map((provider) => {
                    const cred = (credentials as any)?.find((c: any) => c.provider === provider.id);
                    const vault = (vaultProviders as any)?.find((v: any) => v.providerType === provider.vaultType);
                    const isConfigured = !!cred || !!vault;

                    return (
                        <ProviderCard
                            key={provider.id}
                            provider={provider}
                            isConfigured={isConfigured}
                            updatedAt={vault?.updatedAt || (cred as any)?.updatedAt}
                            onSave={async (config) => {
                                if (provider.vaultType) {
                                    await saveVaultProvider.mutateAsync({
                                        providerType: provider.vaultType,
                                        config,
                                        isDefault: provider.id === 'openai'
                                    });
                                } else {
                                    await saveCredential.mutateAsync({
                                        provider: provider.id,
                                        apiKey: config.apiKey,
                                        model: config.model,
                                        baseUrl: config.baseUrl
                                    });
                                }
                            }}
                            onDelete={async () => {
                                if (provider.vaultType) {
                                    await deleteVaultProvider.mutateAsync({ providerType: provider.vaultType });
                                }
                                if (cred) {
                                    await deleteCredential.mutateAsync({ provider: provider.id });
                                }
                            }}
                            isSaving={saveVaultProvider.isPending || saveCredential.isPending}
                        />
                    );
                })}

                {/* Custom Providers */}
                {customCredentials.map((cred: any) => (
                    <ProviderCard
                        key={cred.provider}
                        provider={{
                            id: cred.provider,
                            name: cred.provider.charAt(0).toUpperCase() + cred.provider.slice(1),
                            description: cred.baseUrl || "Custom Provider",
                            icon: <Plus className="h-5 w-5" />
                        }}
                        isConfigured={true}
                        updatedAt={(cred as any).updatedAt}
                        onSave={async (config) => {
                            await saveCredential.mutateAsync({
                                provider: cred.provider,
                                apiKey: config.apiKey,
                                model: config.model,
                                baseUrl: config.baseUrl
                            });
                        }}
                        onDelete={async () => {
                            await deleteCredential.mutateAsync({ provider: cred.provider });
                        }}
                        isSaving={saveCredential.isPending}
                    />
                ))}
            </div>
        </div>
    );
}

function ProviderCard({
    provider,
    isConfigured,
    updatedAt,
    onSave,
    onDelete,
    isSaving,
}: {
    provider: { id: string; name: string; description: string; icon: React.ReactNode; vaultType?: ProviderType };
    isConfigured: boolean;
    updatedAt?: Date | string;
    onSave: (config: any) => Promise<void>;
    onDelete: () => Promise<void>;
    isSaving: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [model, setModel] = useState("");
    const [voiceId, setVoiceId] = useState("");
    const [region, setRegion] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSave = async () => {
        if (!apiKey) {
            toast.error("API Key is required");
            return;
        }

        const config: any = { apiKey };
        if (baseUrl) config.baseUrl = baseUrl;
        if (model) config.model = model;
        if (voiceId) config.voiceId = voiceId;
        if (region) config.region = region;

        await onSave(config);
        setIsOpen(false);
        setApiKey("");
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        await onDelete();
        setIsDeleting(false);
        setIsOpen(false);
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        {provider.icon}
                    </div>
                    <div>
                        <CardTitle className="text-xl">{provider.name}</CardTitle>
                        <CardDescription className="max-w-[200px] truncate">{provider.description}</CardDescription>
                    </div>
                </div>
                {isConfigured ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Active
                    </Badge>
                ) : (
                    <Badge variant="secondary">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Setup Required
                    </Badge>
                )}
            </CardHeader>
            <CardContent>
                <div className="text-sm text-muted-foreground">
                    {isConfigured ? (
                        <div className="space-y-1">
                            <p>Status: {provider.vaultType ? "Encrypted & Active" : "Active"}</p>
                            {updatedAt && (
                                <p className="text-xs">
                                    Last synced: {new Date(updatedAt).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p>Configure {provider.name} to enable its capabilities.</p>
                    )}
                </div>
            </CardContent>
            <CardFooter>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant={isConfigured ? "outline" : "default"} className="w-full">
                            <Key className="mr-2 h-4 w-4" />
                            {isConfigured ? "Manage Keys" : "Connect Provider"}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Configure {provider.name}</DialogTitle>
                            <DialogDescription>
                                {provider.vaultType
                                    ? "Credentials are encrypted with AES-256-GCM. We never store or show your plain API keys."
                                    : "Credentials are saved securely in your profile."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="apiKey">API Key</Label>
                                <Input
                                    id="apiKey"
                                    type="password"
                                    placeholder="Enter your secret key"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>

                            {provider.id === 'elevenlabs' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="voiceId">Default Voice ID</Label>
                                    <Input id="voiceId" placeholder="e.g. pMsdb92n..." value={voiceId} onChange={(e) => setVoiceId(e.target.value)} />
                                </div>
                            )}

                            {(provider.id === 'google' || provider.id === 'deepgram') && (
                                <div className="grid gap-2">
                                    <Label htmlFor="region">Region / Endpoint</Label>
                                    <Input id="region" placeholder="e.g. us-central1" value={region} onChange={(e) => setRegion(e.target.value)} />
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="model">Default Model (Optional)</Label>
                                <Input id="model" placeholder="e.g. gpt-4o" value={model} onChange={(e) => setModel(e.target.value)} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="baseUrl">Custom Base URL (Optional)</Label>
                                <Input id="baseUrl" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            {isConfigured && (
                                <Button
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={isDeleting || isSaving}
                                    className="mr-auto"
                                >
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={!apiKey || isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Config
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardFooter>
        </Card>
    );
}
