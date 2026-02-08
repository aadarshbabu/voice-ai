import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/server/inngest/client";
import { decrypt } from "@/lib/crypto";
import { runWorkflowUntilWait } from "@/lib/engine/runner";
import { type ExecutionContext } from "@/lib/engine/types";
import { type Node, type Edge } from "@xyflow/react";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleWebhook(req, slug);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleWebhook(req, slug);
}

async function handleWebhook(req: NextRequest, slug: string) {
  try {
    const { searchParams } = new URL(req.url);
    const isSync = searchParams.get("sync") === "true";

    // 1. Parse payload (body for POST, query for GET)
    let payload: any = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch (e) {
        const text = await req.text();
        payload = { text };
      }
    } else {
      const { searchParams } = new URL(req.url);
      payload = Object.fromEntries(searchParams.entries());
    }

    const headers = Object.fromEntries(req.headers.entries());

    // 2. Find workflow with this webhook slug
    const workflows = await prisma.workflow.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        userId: true,
        nodes: true,
        edges: true,
      }
    });

    let matchedWorkflow = null;
    let matchedNode = null;

    for (const workflow of workflows) {
      const nodes = workflow.nodes as any[];
      const webhookNode = nodes.find(n => n.type === 'webhook' && n.data?.slug === slug);
      if (webhookNode) {
        matchedWorkflow = workflow;
        matchedNode = webhookNode;
        break;
      }
    }

    if (!matchedWorkflow || !matchedNode) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // 3. Auth Validation
    const { authType, sharedSecret } = matchedNode.data;
    if (authType === 'bearer') {
      const authHeader = req.headers.get("authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const token = authHeader.substring(7);
      let decryptedSecret = sharedSecret;
      try {
        if (sharedSecret && sharedSecret.includes(':')) {
          decryptedSecret = decrypt(sharedSecret);
        }
      } catch (e) {
        return NextResponse.json({ error: "Security configuration error" }, { status: 500 });
      }
      if (token !== decryptedSecret) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    // 4. Session Identification
    const sessionId = headers['x-session-id'] || payload.sessionId;
    let session;
    let isNewSession = false;

    if (sessionId) {
      session = await prisma.workflowSession.findUnique({ where: { id: sessionId } });
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      if (session.status !== "ACTIVE") {
        return NextResponse.json({ error: `Session is not active (${session.status})` }, { status: 400 });
      }
    } else {
      session = await prisma.workflowSession.create({
        data: {
          workflowId: matchedWorkflow.id,
          status: "ACTIVE",
          metadata: { source: "webhook", webhookSlug: slug, webhookNodeId: matchedNode.id },
        },
      });
      isNewSession = true;
    }

    // 5. Execution Logic (Sync vs Async)
    if (isSync) {
      const metadata = (session.metadata as any) || {};
      
      // Load current context or create fresh one
      const currentContext: ExecutionContext = metadata.context || {
        sessionId: session.id,
        workflowId: matchedWorkflow.id,
        currentNodeId: matchedNode.id,
        variables: {},
        transcript: [],
        status: 'running',
        updatedAt: new Date().toISOString(),
      };

      // Ensure we use the LLM config from the session if resuming
      const llmConfig = metadata.llmConfig || { userId: matchedWorkflow.userId };

      const result = await runWorkflowUntilWait(
        matchedWorkflow.nodes as Node[],
        matchedWorkflow.edges as Edge[],
        currentContext,
        JSON.stringify(payload),
        llmConfig
      );

      const status = result.context.status === 'completed' ? 'COMPLETED' :
                    result.context.status === 'error' ? 'ERROR' : 'ACTIVE';

      // Save final state to DB
      await prisma.workflowSession.update({
        where: { id: session.id },
        data: { 
          metadata: { ...metadata, context: result.context }, 
          status,
          endedAt: status === 'COMPLETED' ? new Date() : undefined
        }
      });

      return NextResponse.json({ 
        success: status !== 'ERROR', 
        sessionId: session.id,
        response: result.action.type === 'speak' ? result.action.text : null,
        error: result.context.error, // Return the exact error to the user
        transcript: result.context.transcript,
        variables: result.context.variables,
        status: result.context.status
      });
    } else {
      // Async: Send to Inngest
      await inngest.send({
        name: isNewSession ? "workflow/execute" : "workflow/resume",
        data: {
          sessionId: session.id,
          workflowId: matchedWorkflow.id,
          triggerNodeId: isNewSession ? matchedNode.id : undefined,
          userInput: isNewSession ? undefined : JSON.stringify(payload),
          webhookPayload: isNewSession ? payload : undefined,
          webhookHeaders: isNewSession ? headers : undefined,
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: isNewSession ? "Workflow started" : "Workflow resume signal sent", 
        sessionId: session.id 
      });
    }

  } catch (error: any) {
    console.error("[Webhook Gateway] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
