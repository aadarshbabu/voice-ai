import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  SignalingMessageSchema,
  type SignalResponse,
} from "@/lib/engine/orchestrator/webrtc/signaling-types";
import {
  getOrCreateEntry,
  getEntry,
  removeEntry,
} from "@/lib/engine/orchestrator/webrtc/signaling-store";

/**
 * WebRTC Signaling Endpoint
 * POST /api/voice/signal
 *
 * Exchanges SDP offers/answers and ICE candidates between
 * the browser client and the server-side WebRTC peer.
 *
 * Body: SignalingMessage JSON (offer | answer | ice-candidate | bye)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, type: "error", sessionId: "", error: "Unauthorized" } satisfies Partial<SignalResponse>,
        { status: 401 }
      );
    }

    // 2. Parse and validate body
    const body = await request.json();
    const parsed = SignalingMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          type: "error",
          sessionId: body?.sessionId ?? "",
          error: `Invalid signaling message: ${parsed.error.issues.map(i => i.message).join(", ")}`,
        } satisfies SignalResponse,
        { status: 400 }
      );
    }

    const message = parsed.data;
    const { webrtcManager } = await import("@/lib/engine/orchestrator/webrtc/manager");

    // 3. Route by message type
    switch (message.type) {
      case "offer": {
        // Create signaling entry strictly for ICE candidates/SDP tracking
        const entry = getOrCreateEntry(message.sessionId);

        // Create the actual server session
        // Note: For now, we expect sessionId to exist as a WorkflowSession in DB
        // or we use a fallback if not found.
        let workflowId = "unknown";
        try {
          const { prisma } = await import("@/lib/prisma");
          const dbSession = await prisma.workflowSession.findUnique({
            where: { id: message.sessionId },
          });
          if (dbSession) workflowId = dbSession.workflowId;
        } catch (e) {
          console.warn("[WebRTC Signal] Could not find workflowId for session", message.sessionId);
        }

        const { answerSdp } = await webrtcManager.createSession(
          message.sessionId,
          workflowId,
          message.sdp
        );

        entry.serverSdp = answerSdp;

        // Apply any candidates that were buffered while session was being created
        if (entry.clientCandidates.length > 0) {
          console.log(`[WebRTC Signal] Applying ${entry.clientCandidates.length} buffered candidates for ${message.sessionId}`);
          for (const candidate of entry.clientCandidates) {
            await webrtcManager.addIceCandidate(message.sessionId, candidate).catch(err => {
              console.warn("[WebRTC Signal] Failed to apply buffered candidate", err);
            });
          }
          entry.clientCandidates = [];
        }

        return NextResponse.json({
          ok: true,
          type: "answer",
          sessionId: message.sessionId,
          sdp: answerSdp,
        } satisfies SignalResponse);
      }

      case "ice-candidate": {
        // Use getOrCreateEntry to handle candidates arriving even before the offer
        const entry = getOrCreateEntry(message.sessionId);

        // Check if the actual server peer session exists
        const session = webrtcManager.getSession(message.sessionId);
        
        if (!session) {
          // If session doesn't exist yet, buffer the candidate in the signaling store
          // It will be applied once createSession finishes
          entry.clientCandidates.push(message.candidate);
          console.log(`[WebRTC Signal] Buffered client candidate for ${message.sessionId}`);
          
          return NextResponse.json({
            ok: true,
            type: "ice-candidate",
            sessionId: message.sessionId,
          } satisfies SignalResponse);
        }

        // If session exists, add directly to server peer
        await webrtcManager.addIceCandidate(message.sessionId, message.candidate);

        return NextResponse.json({
          ok: true,
          type: "ice-candidate",
          sessionId: message.sessionId,
        } satisfies SignalResponse);
      }

      case "bye": {
        await webrtcManager.destroySession(message.sessionId, "user_hangup");
        removeEntry(message.sessionId);

        return NextResponse.json({
          ok: true,
          type: "bye",
          sessionId: message.sessionId,
        } satisfies SignalResponse);
      }

      case "answer": {
        // Server should not receive answers from client in this architecture
        return NextResponse.json(
          {
            ok: false,
            type: "error",
            sessionId: message.sessionId,
            error: "Server does not accept SDP answers. Send an offer instead.",
          } satisfies SignalResponse,
          { status: 400 }
        );
      }

      default: {
        return NextResponse.json(
          {
            ok: false,
            type: "error",
            sessionId: "",
            error: "Unknown message type",
          } satisfies SignalResponse,
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error("[WebRTC Signal] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        type: "error",
        sessionId: "",
        error: message,
      } satisfies SignalResponse,
      { status: 500 }
    );
  }
}
