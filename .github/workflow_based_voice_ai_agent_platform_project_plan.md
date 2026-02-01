# Workflow‑Based Voice AI Agent Platform — Project Plan

## 1. Purpose & Vision
Build a **workflow‑driven voice AI platform** that allows organizations to design, deploy, and run conversational voice agents in a **deterministic, debuggable, and scalable** way.

Core philosophy:
- Voice agents are **state machines**, not prompt chains
- LLMs assist with **decisions and language**, not control flow
- Conversations are driven by **events + persisted execution state**

This document focuses purely on **system design and implementation** (no market or GTM analysis).

---

## 2. Core Concepts & Definitions

### 2.1 Workflow (Static Definition)
A workflow is a **JSON‑defined directed state machine** created by users.

Characteristics:
- Immutable at runtime
- Versioned
- Deterministic transitions

### 2.2 Execution Context (Runtime State)
A per‑conversation instance of a workflow.

Responsibilities:
- Track current node
- Store variables
- Resume execution across requests

### 2.3 Event‑Driven Execution
The system advances only when an **external event** occurs:
- User speech
- Tool result
- Timeout
- Interrupt

No long‑running loops exist on the server.

---

## 3. Supported Node Types (v1)

| Node Type | Responsibility |
|---------|---------------|
| Trigger | Entry point for conversation |
| Speak | Send text (and metadata) to TTS |
| Listen | Await user speech input |
| LLM Decision | Decide next action (reply / tool / end) |
| Tool | Call external systems or APIs |
| LLM Reply | Generate natural language response |
| End | Terminate conversation |

---

## 4. Workflow Schema (User‑Designed)

```json
{
  "id": "voice-agent-v1",
  "startNode": "greet",
  "nodes": {
    "greet": {
      "type": "speak",
      "text": "Hello! How can I help you today?",
      "next": "listen"
    },
    "listen": {
      "type": "listen",
      "saveAs": "user_input",
      "next": "llm_decide"
    },
    "llm_decide": {
      "type": "llm_decision",
      "prompt": "User said: {{user_input}}. Decide: reply | tool | end",
      "output": "decision",
      "next": {
        "reply": "llm_reply",
        "tool": "tool_call",
        "end": "end"
      }
    },
    "tool_call": {
      "type": "tool",
      "toolName": "getOrderStatus",
      "input": "{{user_input}}",
      "saveAs": "tool_result",
      "next": "llm_reply"
    },
    "llm_reply": {
      "type": "llm_reply",
      "prompt": "Reply using {{user_input}} and {{tool_result}}",
      "output": "assistant_reply",
      "next": "speak"
    },
    "speak": {
      "type": "speak",
      "text": "{{assistant_reply}}",
      "next": "listen"
    },
    "end": {
      "type": "end"
    }
  }
}
```

---

## 5. Execution Context Model

```ts
type ExecutionContext = {
  sessionId: string
  workflowId: string
  currentNodeId: string
  variables: Record<string, any>
  status: 'active' | 'ended'
  lastEventAt: number
}
```

Storage:
- Redis (active sessions)
- Database (completed / archived sessions)

---

## 6. Request–Response Execution Model

### Principle
> Each request advances the workflow **until the next wait boundary** (usually a `listen` node).

### Request Types
- `POST /start` — initialize execution context
- `POST /event` — user speech, interrupt, or system event

---

## 7. Workflow Runtime Engine

### Core Executor - Sample Code it's not a production ready. 
 - Build entier workflow executer using inngest functions. Below just giving the sample fole for this. 

```ts
async function advance(ctx: ExecutionContext, event?: Event) {
  const workflow = loadWorkflow(ctx.workflowId)

  if (event?.type === 'speech' && workflow.nodes[ctx.currentNodeId].type === 'listen') {
    ctx.variables[workflow.nodes[ctx.currentNodeId].saveAs] = event.text
    ctx.currentNodeId = workflow.nodes[ctx.currentNodeId].next
  }

  while (true) {
    const node = workflow.nodes[ctx.currentNodeId]

    if (node.type === 'speak') {
      ctx.currentNodeId = node.next
      saveContext(ctx)
      return { action: 'speak', text: interpolate(node.text, ctx.variables) }
    }

    if (node.type === 'listen') {
      saveContext(ctx)
      return { action: 'listen' }
    }

    if (node.type === 'llm_decision') {
      const decision = await runLLMDecision(node.prompt, ctx.variables)
      ctx.variables[node.output] = decision
      ctx.currentNodeId = node.next[decision]
      continue
    }

    if (node.type === 'tool') {
      const result = await runTool(node.toolName, node.input, ctx.variables)
      ctx.variables[node.saveAs] = result
      ctx.currentNodeId = node.next
      continue
    }

    if (node.type === 'llm_reply') {
      const reply = await runLLMReply(node.prompt, ctx.variables)
      ctx.variables[node.output] = reply
      ctx.currentNodeId = node.next
      continue
    }

    if (node.type === 'end') {
      ctx.status = 'ended'
      saveContext(ctx)
      return { action: 'end' }
    }
  }
}
```

---

## 8. Browser Voice Interaction Flow

1. Client requests `/start`
2. Server responds with `speak`
3. Client plays TTS
4. Client records speech
5. Client sends `/event`
6. Server advances workflow
7. Loop continues until `end`

Conversation continuity is achieved through **persisted execution context**, not server loops.

---

## 9. LLM Usage Strategy

### Separation of Concerns

| LLM Role | Purpose |
|--------|--------|
| Decision LLM | Intent & routing |
| Reply LLM | Natural language generation |

Benefits:
- Lower cost
- Better control
- Easier debugging

---

## 10. Tool Integration Layer

Tools are deterministic, auditable functions.

```ts
registerTool('getOrderStatus', async (input) => {
  return fetchFromInternalSystem(input)
})
```

LLMs never call tools directly.

---

## 11. Interrupts & Timeouts

### Interrupt Handling
- Global interrupt event
- Redirects to configurable node (usually `llm_decide`)

### Timeout Handling
- No speech for N seconds → prompt user
- Hard timeout → end session

---

## 12. Observability & Debugging (Required)

- Full transcript per session
- Node‑by‑node execution log
- LLM inputs & outputs
- Tool call traces

This enables:
- Replay
- Debugging
- Compliance

---

## 13. Workflow Builder UI (React Flow)

### 13.1 Purpose
Provide a **visual, no-code / low-code interface** for users to design, configure, validate, version, and publish workflows that drive voice agents.

The UI must:
- Reflect the underlying state-machine model exactly
- Prevent invalid workflows at design time
- Generate executable JSON used by the runtime engine

---

### 13.2 Core UI Concepts

#### Node Palette
Users can drag predefined node types:
- Trigger
- Speak
- Listen
- LLM Decision
- LLM Reply
- Tool
- End

Each palette item maps 1:1 to a backend node schema.

#### Canvas (React Flow)
- Nodes represent workflow states
- Edges represent allowed transitions
- One start node per workflow
- Directed graph only

---

### 13.3 Node Configuration Panels

Each node opens a **side configuration panel** (right drawer).
Make node which is extentable during the time so we can add more conversasion. 

Examples:

**Speak Node**
- Text (supports variables)
- Voice metadata (optional)
- Next node selector

**Listen Node**
- Variable name to store speech
- Silence timeout
- Next node

**LLM Decision Node**
- Prompt template
- Allowed decisions (enum)
- Output variable
- Decision → next-node mapping

**Tool Node**
- Tool name (from registry)
- Input mapping
- Output variable

**LLM Reply Node**
- Prompt template
- Output variable

**End Node**
- No configuration

---

### 13.4 Validation Rules (Critical)

UI must enforce:
- Exactly one start node
- No dangling nodes
- No cycles without a listen boundary
- Every LLM decision branch must be connected
- Tool nodes must have valid next nodes

Validation runs:
- On save
- On publish
- In real time (inline warnings)

---

### 13.5 Workflow Serialization

On save / publish, React Flow graph is converted to backend schema.

```ts
type UINode = {
  id: string
  type: string
  data: Record<string, any>
}

type UIEdge = {
  source: string
  target: string
  label?: string
}
```

Conversion output:
- Normalized node map
- startNode resolution
- next-node references

---

### 13.6 Draft, Versioning & Publishing

Workflow lifecycle:

1. Draft
2. Validate
3. Publish (immutable)
4. Create new version (copy-on-write)

Published workflows:
- Are read-only
- Can be safely used by running sessions

---

### 13.7 Running & Testing Workflows

#### Test Mode
- Text-based simulator
- Step-by-step execution
- Show current node highlight
- Show variables & state

#### Run Mode
- Assign workflow to agent
- Start real browser voice session
- Live execution trace

---

### 13.8 Observability in UI

Per workflow:
- Execution count
- Success / end rate
- Error nodes

Per session:
- Timeline view
- Node-by-node trace
- Inputs / outputs

---

## 14. Technology Stack (Suggested)

- Frontend: Next.js + React + React Flow + shadcnUI
- State: Zustand
- Forms: React Hook Form / shadcnUI Form
- Validation: Zod
- Backend: TRPC + inngest 
- State Store: Redis
- DB: Postgres
- STT: Whisper / Deepgram  - configurble
- LLM: GPT-4 / Claude - configurable
- TTS: ElevenLabs / Azure - configurable 

---

## 15. Success Criteria (Engineering)

- Deterministic execution
- Resume from persisted state
- Multiple LLM calls per turn
- Infinite conversation without loops. 
- Fully debuggable sessions. (Lifecycle of each session)
- UI for building workflows which is visualy appling.

---

## 16. Final Statement

This project builds a **production‑grade workflow engine for voice AI agents**, treating conversations as **event‑driven state machines** rather than prompt‑based chat systems.

This architecture is scalable, auditable, and extensible — suitable for serious, real‑world voice automation systems.

