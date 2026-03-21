import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AccessToken } from "livekit-server-sdk";

/**
 * LiveKit Token Generation Endpoint
 * GET /api/voice/token?sessionId=...
 * 
 * Generates an access token for the client to join a LiveKit room.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get sessionId from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // 3. Environment Variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      console.error("[LiveKit Token] Missing environment variables");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // 4. Create Access Token
    // The participant name is the user's name or ID
    const participantName = session.user.name || session.user.id;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: session.user.id,
      name: participantName,
      metadata: JSON.stringify({ sessionId }),
    });

    // Set permissions: client can join, speak, and publish media
    at.addGrant({
      roomJoin: true,
      room: sessionId, // Each workflow session is its own room
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // 5. Generate and return the token
    const token = await at.toJwt();

    return NextResponse.json({
      token,
      url: wsUrl,
    });
  } catch (error) {
    console.error("[LiveKit Token] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
