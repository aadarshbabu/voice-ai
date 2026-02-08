import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ProviderType } from "@/generated/prisma";
import { IntentResolver } from "@/lib/engine/gateway/intent-resolver";
import { speechToText } from "@/lib/engine/providers/voice";

/**
 * Voice Gateway Entry Point
 * POST /api/voice/command
 * 
 * Receives audio blob, transcribes it using the configured STT provider,
 * then resolves intent to start the appropriate workflow.
 * 
 * Form Data:
 *   - audio: Blob - The audio file to transcribe
 *   - skipIntent: "true" | "false" - Skip intent resolution (for active sessions)
 *   - sttProvider: "elevenlabs" | "deepgram" | "google" - Override STT provider (optional)
 *   - language: string - Language code (optional, e.g., "en-US" or "eng")
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Parse audio and options from request
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;
    const skipIntentResolution = formData.get("skipIntent") === "true";
    const sttProviderOverride = formData.get("sttProvider") as string | null;
    const language = formData.get("language") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // 3. Convert audio to base64
    const audioArrayBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioArrayBuffer).toString("base64");
    const mimeType = audioFile.type || "audio/webm";

    // 4. Map string provider to ProviderType enum
    let providerTypeOverride: ProviderType | undefined;
    if (sttProviderOverride) {
      switch (sttProviderOverride.toLowerCase()) {
        case "elevenlabs":
          providerTypeOverride = ProviderType.ELEVENLABS;
          break;
        case "deepgram":
          providerTypeOverride = ProviderType.DEEPGRAM;
          break;
        case "google":
          providerTypeOverride = ProviderType.GOOGLE;
          break;
      }
    }

    // 5. Perform STT using the unified voice provider
    // This will use the priority: ElevenLabs > Deepgram > Google
    // Unless a specific provider is requested
    const sttResult = await speechToText(audioBase64, mimeType, userId, {
      provider: providerTypeOverride,
      language: language || undefined,
    });

    if (!sttResult.success || !sttResult.transcript) {
      return NextResponse.json(
        { error: sttResult.error || "Failed to transcribe audio" },
        { status: 400 }
      );
    }

    const transcript = sttResult.transcript;

    // 6. Skip intent resolution if requested (return just transcript)
    if (skipIntentResolution) {
      return NextResponse.json({
        success: true,
        transcript,
        confidence: sttResult.confidence,
        speakers: sttResult.speakers,
        audioEvents: sttResult.audioEvents,
      });
    }

    // 7. Resolve intent and start workflow session
    const intentResult = await IntentResolver.resolve(transcript, userId);

    if (intentResult.resolved) {
      return NextResponse.json({
        success: true,
        transcript,
        confidence: sttResult.confidence,
        intent: {
          resolved: true,
          workflowId: intentResult.workflowId,
          workflowName: intentResult.workflowName,
          sessionId: intentResult.sessionId,
          confidence: intentResult.confidence,
        },
      });
    } else {
      // No match found - return fallback message
      return NextResponse.json({
        success: true,
        transcript,
        confidence: sttResult.confidence,
        intent: {
          resolved: false,
          message: intentResult.fallbackMessage,
          confidence: intentResult.confidence,
        },
      });
    }

  } catch (error) {
    console.error("[Voice Gateway] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

