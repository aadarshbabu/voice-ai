import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/engine/providers/llm";
import { inngest } from "@/server/inngest/client";

/**
 * Intent Resolution Response
 */
export interface IntentResolutionResult {
  resolved: boolean;
  workflowId?: string;
  workflowName?: string;
  triggerNodeId?: string;
  sessionId?: string;
  confidence?: number;
  fallbackMessage?: string;
}

/**
 * Workflow metadata for intent matching
 */
interface WorkflowMetadata {
  id: string;
  name: string;
  description: string | null;
  triggerNodeId: string | null;
  triggerDescription: string | null;
}

/**
 * Intent Resolver Service
 * 
 * Maps user voice transcripts to published workflows by analyzing
 * workflow descriptions and trigger node labels.
 */
export class IntentResolver {
  /**
   * Resolve user intent from transcript
   * 
   * @param transcript - The STT text from the user's voice command
   * @param userId - The authenticated user's ID
   * @param llmConfig - Optional LLM configuration override
   * @returns Resolution result with matched workflow or fallback message
   */
  static async resolve(
    transcript: string,
    userId: string,
    llmConfig?: {
      provider?: string;
      model?: string;
      apiKey?: string;
    }
  ): Promise<IntentResolutionResult> {
    try {
      // 1. Fetch published workflows with trigger nodes
      const workflows = await this.getPublishedWorkflowsWithTriggers(userId);

      if (workflows.length === 0) {
        return {
          resolved: false,
          fallbackMessage: "You don't have any published workflows yet. Please create and publish a workflow first.",
        };
      }

      // 2. Build context for LLM
      const workflowDescriptions = workflows.map((w, index) => 
        `${index + 1}. Workflow: "${w.name}"${w.description ? ` - ${w.description}` : ""}${w.triggerDescription ? `. Trigger: ${w.triggerDescription}` : ""}`
      ).join("\n");

      // 3. Use LLM to match intent
      const systemPrompt = `You are an intent classifier for a voice-to-workflow system.

The user will speak a command, and you must match it to one of the available workflows.

Available Workflows:
${workflowDescriptions}

Your task:
1. Analyze the user's intent from their spoken command
2. Match it to the most relevant workflow based on name, description, and trigger
3. If confident (>70%), respond with the workflow number
4. If uncertain, respond with "NONE"

Response format (JSON only):
{"match": <workflow_number_or_null>, "confidence": <0-100>, "reasoning": "<brief explanation>"}`;

      const userPrompt = `User said: "${transcript}"

Which workflow should handle this command?`;

      const response = await callLLM({
        systemPrompt,
        userPrompt,
        config: {
          provider: llmConfig?.provider || "openai",
          model: llmConfig?.model || "gpt-4o-mini",
          temperature: 0.2, // Low for consistent classification
          maxTokens: 200,
          apiKey: llmConfig?.apiKey,
          userId,
        },
      });

      // 4. Parse LLM response
      const parsed = this.parseLLMResponse(response, workflows.length);

      if (parsed.match !== null && parsed.confidence >= 70) {
        const matchedWorkflow = workflows[parsed.match - 1];

        if (matchedWorkflow) {
          // 5. Create session and start execution
          const sessionId = await this.initializeSession(
            matchedWorkflow.id,
            matchedWorkflow.triggerNodeId,
            transcript,
            llmConfig
          );

          return {
            resolved: true,
            workflowId: matchedWorkflow.id,
            workflowName: matchedWorkflow.name,
            triggerNodeId: matchedWorkflow.triggerNodeId || undefined,
            sessionId,
            confidence: parsed.confidence,
          };
        }
      }

      // No confident match
      return {
        resolved: false,
        confidence: parsed.confidence,
        fallbackMessage: `I didn't understand that command. You can say things like: ${workflows.slice(0, 3).map(w => `"${w.name}"`).join(", ")}`,
      };

    } catch (error) {
      console.error("[IntentResolver] Error:", error);
      return {
        resolved: false,
        fallbackMessage: "Sorry, I had trouble processing your request. Please try again.",
      };
    }
  }

  /**
   * Get published workflows with their trigger nodes
   */
  private static async getPublishedWorkflowsWithTriggers(
    userId: string
  ): Promise<WorkflowMetadata[]> {
    const workflows = await prisma.workflow.findMany({
      where: {
        userId,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        name: true,
        description: true,
        nodes: true,
      },
    });

    return workflows.map((workflow) => {
      // Find the trigger node in the workflow
      const nodes = workflow.nodes as any[];
      const triggerNode = nodes?.find((n: any) => n.type === "trigger");

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        triggerNodeId: triggerNode?.id || null,
        triggerDescription: triggerNode?.data?.label || triggerNode?.data?.description || null,
      };
    });
  }

  /**
   * Parse LLM response with error handling
   */
  private static parseLLMResponse(
    response: string,
    maxWorkflows: number
  ): { match: number | null; confidence: number } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[IntentResolver] No JSON found in response:", response);
        return { match: null, confidence: 0 };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const match = parsed.match;
      const confidence = Number(parsed.confidence) || 0;

      // Validate match is within range
      if (match === null || match === "NONE" || match === 0) {
        return { match: null, confidence };
      }

      if (typeof match === "number" && match >= 1 && match <= maxWorkflows) {
        return { match, confidence };
      }

      return { match: null, confidence };
    } catch (e) {
      console.error("[IntentResolver] Failed to parse LLM response:", e, response);
      return { match: null, confidence: 0 };
    }
  }

  /**
   * Initialize a workflow session from voice command
   */
  private static async initializeSession(
    workflowId: string,
    triggerNodeId: string | null,
    transcript: string,
    llmConfig?: {
      provider?: string;
      model?: string;
      apiKey?: string;
    }
  ): Promise<string> {
    // Create session with initial transcript
    const session = await prisma.workflowSession.create({
      data: {
        workflowId,
        status: "ACTIVE",
        metadata: {
          voiceCommand: transcript,
          source: "voice-gateway",
        },
      },
    });

    // Trigger Inngest workflow execution
    try {
      await inngest.send({
        name: "workflow/execute",
        data: {
          sessionId: session.id,
          workflowId,
          userInput: transcript, // Pass transcript as initial input
          llmConfig,
        },
      });
    } catch (error) {
      console.error("[IntentResolver] Failed to send Inngest event:", error);
      // Session is created, execution may need manual trigger
    }

    return session.id;
  }
}
