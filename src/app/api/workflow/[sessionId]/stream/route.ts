import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sessionEmitter } from '@/lib/engine/session-emitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// SSE endpoint for real-time workflow execution updates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      console.log(`[SSE] New connection for session: ${sessionId}`);
      
      // Send SSE event
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // ignore - stream probably closed
        }
      };

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);

      // --- PUB/SUB HANDLERS ---
      
      const onUpdate = (data: any) => {
        console.log(`[SSE] Pushing update for session: ${sessionId}`);
        sendEvent('update', data);
      };

      const onComplete = (data: any) => {
        console.log(`[SSE] Pushing completion for session: ${sessionId}`);
        sendEvent('complete', data);
        cleanup();
      };

      const cleanup = () => {
        console.log(`[SSE] Cleaning up connection for session: ${sessionId}`);
        clearInterval(heartbeat);
        sessionEmitter.off(`update:${sessionId}`, onUpdate);
        sessionEmitter.off(`complete:${sessionId}`, onComplete);
        try {
          controller.close();
        } catch {}
      };

      // Subscribe
      sessionEmitter.on(`update:${sessionId}`, onUpdate);
      sessionEmitter.on(`complete:${sessionId}`, onComplete);

      // --- INITIAL FETCH ---
      console.log(`[SSE] Performing initial fetch for session: ${sessionId}`);
      try {
        const session = await prisma.workflowSession.findUnique({
          where: { id: sessionId },
          select: { id: true, metadata: true, status: true },
        });

        if (session) {
          let context = null;
          if (session.metadata && typeof session.metadata === 'object') {
            const metadata = session.metadata as any;
            context = metadata.context || (metadata.sessionId ? metadata : null);
          }

          sendEvent('update', {
            sessionId,
            status: session.status,
            context: context || {
              currentNodeId: null,
              variables: {},
              transcript: [],
              status: session.status.toLowerCase(),
            },
          });

          if (session.status === 'COMPLETED' || session.status === 'ERROR') {
            onComplete({ status: session.status });
          }
        }
      } catch (error) {
        console.error('[SSE] Initial fetch error:', error);
      }

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
