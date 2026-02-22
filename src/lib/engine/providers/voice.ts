/**
 * Voice Provider Module for Workflow Engine
 * 
 * Provides TTS (Text-to-Speech) and STT (Speech-to-Text) capabilities
 * that can be used by SPEAK and LISTEN nodes in the workflow.
 */

import { VoiceProviderService, ProviderConfigData } from "@/server/services/voice-provider-service";
import { ProviderType } from "@/generated/prisma";

// ============================================
// Language Mapping Utilities
// ============================================

/**
 * Maps the simplified ISO 639-3 codes (eng, spa, fra, etc.)
 * to the specific formats required by each provider.
 */
const LANGUAGE_MAPPING: Record<string, { google: string; elevenlabs: string; deepgram: string }> = {
  eng: { google: 'en-US', elevenlabs: 'eng', deepgram: 'en' },
  spa: { google: 'es-ES', elevenlabs: 'spa', deepgram: 'es' },
  fra: { google: 'fr-FR', elevenlabs: 'fra', deepgram: 'fr' },
  deu: { google: 'de-DE', elevenlabs: 'deu', deepgram: 'de' },
  hin: { google: 'hi-IN', elevenlabs: 'hin', deepgram: 'hi' },
  jpn: { google: 'ja-JP', elevenlabs: 'jpn', deepgram: 'ja' },
  zho: { google: 'zh-CN', elevenlabs: 'zho', deepgram: 'zh' },
  por: { google: 'pt-BR', elevenlabs: 'por', deepgram: 'pt' },
  ara: { google: 'ar-XA', elevenlabs: 'ara', deepgram: 'ar' },
};

function getGoogleLang(code?: string) {
  if (!code) return 'en-US';
  return LANGUAGE_MAPPING[code]?.google || code;
}

function getElevenLabsLang(code?: string) {
  if (!code) return 'eng';
  return LANGUAGE_MAPPING[code]?.elevenlabs || code;
}

function getDeepgramLang(code?: string) {
  if (!code) return 'en';
  return LANGUAGE_MAPPING[code]?.deepgram || code;
}

// ============================================
// TTS (Text-to-Speech) Provider
// ============================================

export interface TTSResult {
  success: boolean;
  audioBase64?: string;      // Base64-encoded audio
  mimeType?: string;         // e.g., "audio/mpeg"
  duration?: number;         // Duration in seconds (if available)
  error?: string;
}

/**
 * Generate speech audio from text using configured TTS provider
 */
export async function textToSpeech(
  text: string,
  userId: string,
  options?: {
    voiceId?: string;
    speed?: number;       // 0.5 to 2.0
    language?: string;    // ISO 639-3
    provider?: ProviderType;
  }
): Promise<TTSResult> {
  try {
    // Get TTS provider config (prioritize ElevenLabs, fallback to Google)
    let config: ProviderConfigData | null = null;
    let providerType: ProviderType;

    if (options?.provider) {
      config = await VoiceProviderService.getConfig(userId, options.provider);
      providerType = options.provider;
    } else {
      // Try ElevenLabs first
      config = await VoiceProviderService.getConfig(userId, ProviderType.ELEVENLABS);
      if (config) {
        providerType = ProviderType.ELEVENLABS;
      } else {
        // Fallback to Google
        config = await VoiceProviderService.getConfig(userId, ProviderType.GOOGLE);
        providerType = ProviderType.GOOGLE;
      }
    }

    if (!config) {
      console.warn(`[TTS] No TTS provider configured for user ${userId}`);
      return { success: false, error: "No TTS provider configured. Add ElevenLabs or Google in the Vault." };
    }

    console.log(`[TTS] Using provider ${providerType} for user ${userId}. Voice: ${options?.voiceId || 'default'}`);

    // Generate audio based on provider
    let result: TTSResult;
    if (providerType === ProviderType.ELEVENLABS) {
      result = await elevenLabsTTS(text, config, options);
    } else if (providerType === ProviderType.GOOGLE) {
      result = await googleTTS(text, config, options);
    } else {
      result = { success: false, error: `Unsupported TTS provider: ${providerType}` };
    }

    console.log(`[TTS] Result for ${providerType}: success=${result.success}, audioLength=${result.audioBase64?.length || 0}`);
    return result;
  } catch (error) {
    console.error("[TTS] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "TTS failed" };
  }
}

/**
 * ElevenLabs TTS
 */
async function elevenLabsTTS(
  text: string,
  config: ProviderConfigData,
  options?: { voiceId?: string; speed?: number; language?: string }
): Promise<TTSResult> {
  // Determine voice ID with fallbacks
  // Sanitize: sometimes placeholders like "voice-id" or "default" can leak from UI or old sessions
  let voiceId = options?.voiceId || config.voiceId;
  
  if (!voiceId || voiceId === "voice-id" || voiceId === "default") {
    voiceId = "JBFqnCBsd6RMkjVDRZzb"; // Default: Rachel
  }

  const baseUrl = config.baseUrl || "https://api.elevenlabs.io/v1";
  const languageCode = getElevenLabsLang(options?.language);

  console.log(`[ElevenLabs] Synthesizing with voice: ${voiceId}, language: ${languageCode}`);

  const response = await fetch(`${baseUrl}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: config.model || "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed: options?.speed || 1.0,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`);
  }

  // Convert to base64
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    success: true,
    audioBase64: base64,
    mimeType: "audio/mpeg",
  };
}

/**
 * Google Cloud TTS
 */
async function googleTTS(
  text: string,
  config: ProviderConfigData,
  options?: { voiceId?: string; speed?: number; language?: string }
): Promise<TTSResult> {
  let voiceId = options?.voiceId || config.voiceId;
  if (!voiceId || voiceId === "voice-id" || voiceId === "default") {
    voiceId = "en-US-Neural2-F";
  }

  console.log(`[Google TTS] Synthesizing with voice: ${voiceId}`);

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: getGoogleLang(options?.language),
          name: voiceId,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: options?.speed || 1.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google TTS failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  return {
    success: true,
    audioBase64: result.audioContent,
    mimeType: "audio/mpeg",
  };
}

// ============================================
// STT (Speech-to-Text) Provider
// ============================================

export interface STTResult {
  success: boolean;
  transcript?: string;
  confidence?: number;
  speakers?: Array<{ speaker: string; text: string }>; // For diarization
  audioEvents?: string[]; // For tagged audio events like laughter, applause
  error?: string;
}

/**
 * Transcribe audio to text using configured STT provider
 * Priority: ElevenLabs > Deepgram > Google
 */
export async function speechToText(
  audioBase64: string,
  mimeType: string,
  userId: string,
  options?: {
    language?: string;    // e.g., "en-US" or "eng" for ElevenLabs
    provider?: ProviderType;
    diarize?: boolean;    // Enable speaker diarization (ElevenLabs)
    tagAudioEvents?: boolean; // Tag audio events like laughter (ElevenLabs)
  }
): Promise<STTResult> {
  try {
    // Get STT provider config (prioritize ElevenLabs, then Deepgram, then Google)
    let config: ProviderConfigData | null = null;
    let providerType: ProviderType;

    if (options?.provider) {
      config = await VoiceProviderService.getConfig(userId, options.provider);
      providerType = options.provider;
    } else {
      // Try ElevenLabs first (Scribe v2 is excellent for STT)
      config = await VoiceProviderService.getConfig(userId, ProviderType.ELEVENLABS);
      if (config) {
        providerType = ProviderType.ELEVENLABS;
      } else {
        // Try Deepgram
        config = await VoiceProviderService.getConfig(userId, ProviderType.DEEPGRAM);
        if (config) {
          providerType = ProviderType.DEEPGRAM;
        } else {
          // Fallback to Google
          config = await VoiceProviderService.getConfig(userId, ProviderType.GOOGLE);
          providerType = ProviderType.GOOGLE;
        }
      }
    }

    if (!config) {
      return { success: false, error: "No STT provider configured. Add ElevenLabs, Deepgram, or Google in the Vault." };
    }

    // Transcribe based on provider
    if (providerType === ProviderType.ELEVENLABS) {
      return await elevenLabsSTT(audioBase64, mimeType, config, options);
    } else if (providerType === ProviderType.DEEPGRAM) {
      return await deepgramSTT(audioBase64, mimeType, config, options);
    } else if (providerType === ProviderType.GOOGLE) {
      return await googleSTT(audioBase64, mimeType, config, options);
    } else {
      return { success: false, error: `Unsupported STT provider: ${providerType}` };
    }
  } catch (error) {
    console.error("[STT] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "STT failed" };
  }
}

/**
 * ElevenLabs STT using Scribe v2 model
 * Features: High accuracy, speaker diarization, audio event tagging
 */
async function elevenLabsSTT(
  audioBase64: string,
  mimeType: string,
  config: ProviderConfigData,
  options?: { language?: string; diarize?: boolean; tagAudioEvents?: boolean }
): Promise<STTResult> {
  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  
  const elevenlabs = new ElevenLabsClient({
    apiKey: config.apiKey,
  });

  // Convert base64 to Blob for the SDK
  const audioBuffer = Buffer.from(audioBase64, "base64");
  const audioBlob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });

  try {
    const transcription = await elevenlabs.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v2", // Best model for speech-to-text
      tagAudioEvents: options?.tagAudioEvents ?? true, // Tag audio events like laughter, applause
      languageCode: getElevenLabsLang(options?.language), // Normalize to ISO 639-3
      diarize: options?.diarize ?? false, // Whether to annotate who is speaking
    });

    // Extract transcript from the response
    // The SDK returns text directly or in a structured format
    let transcript = "";
    let speakers: Array<{ speaker: string; text: string }> = [];
    let audioEvents: string[] = [];

    if (typeof transcription === "string") {
      transcript = transcription;
    } else if (transcription && typeof transcription === "object") {
      // Handle structured response with segments
      const result = transcription as any;
      
      if (result.text) {
        transcript = result.text;
      }
      
      // Extract speaker segments if diarization was enabled
      if (result.words && Array.isArray(result.words)) {
        const speakerSegments = new Map<string, string[]>();
        for (const word of result.words) {
          if (word.speaker_id) {
            const speaker = word.speaker_id;
            if (!speakerSegments.has(speaker)) {
              speakerSegments.set(speaker, []);
            }
            speakerSegments.get(speaker)?.push(word.text || word.word);
          }
        }
        speakers = Array.from(speakerSegments.entries()).map(([speaker, words]) => ({
          speaker,
          text: words.join(" "),
        }));
      }

      // Extract audio events if tagged
      if (result.audio_events && Array.isArray(result.audio_events)) {
        audioEvents = result.audio_events.map((e: any) => e.type || e);
      }
    }

    if (!transcript) {
      return { success: false, error: "No speech detected" };
    }

    return {
      success: true,
      transcript,
      confidence: 0.95, // ElevenLabs Scribe v2 is very accurate
      speakers: speakers.length > 0 ? speakers : undefined,
      audioEvents: audioEvents.length > 0 ? audioEvents : undefined,
    };
  } catch (error) {
    console.error("[ElevenLabs STT] Error:", error);
    throw new Error(`ElevenLabs STT failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Deepgram STT
 */
async function deepgramSTT(
  audioBase64: string,
  mimeType: string,
  config: ProviderConfigData,
  options?: { language?: string }
): Promise<STTResult> {
  const baseUrl = config.baseUrl || "https://api.deepgram.com/v1";
  const audioBuffer = Buffer.from(audioBase64, "base64");

  const query = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    language: getDeepgramLang(options?.language),
    encoding: 'linear16',
    sample_rate: '16000',
  });

  const response = await fetch(
    `${baseUrl}/listen?${query.toString()}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Token ${config.apiKey}`,
        "Content-Type": mimeType,
      },
      body: audioBuffer,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram STT failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

  if (!transcript) {
    return { success: false, error: "No speech detected" };
  }

  return { success: true, transcript, confidence };
}

/**
 * Google Cloud STT
 */
async function googleSTT(
  audioBase64: string,
  mimeType: string,
  config: ProviderConfigData,
  options?: { language?: string }
): Promise<STTResult> {
  // Map MIME type to Google encoding
  const encodingMap: Record<string, string> = {
    "audio/webm": "WEBM_OPUS",
    "audio/mp4": "MP4",
    "audio/mpeg": "MP3",
    "audio/wav": "LINEAR16",
    "audio/pcm": "LINEAR16",
  };

  const encoding = encodingMap[mimeType] || "LINEAR16";

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding,
          sampleRateHertz: 16000,
          languageCode: getGoogleLang(options?.language),
          enableAutomaticPunctuation: true,
        },
        audio: { content: audioBase64 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google STT failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const transcript = result?.results?.[0]?.alternatives?.[0]?.transcript || "";
  const confidence = result?.results?.[0]?.alternatives?.[0]?.confidence || 0;

  if (!transcript) {
    return { success: false, error: "No speech detected" };
  }

  return { success: true, transcript, confidence };
}
