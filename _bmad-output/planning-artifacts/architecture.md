---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['/Users/aadarsh/dev/voice-ai/.github/workflow_based_voice_ai_agent_platform_project_plan.md']
workflowType: 'architecture'
project_name: 'voice-ai'
user_name: 'Aadarsh'
lastStep: 8
status: 'complete'
completedAt: '2026-02-08T20:23:45+05:30'
date: '2026-01-29T01:06:55+05:30'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The system is a **Workflow-Based Voice AI Agent Platform** that enables users to visually design and deploy deterministic voice agents.
*   **Workflow Engine:** A runtime executor for JSON-based state machines consisting of specifically defined node types (Trigger, Speak, Listen, LLM Decision, Tool, LLM Reply, End).
*   **Visual Editor:** A React Flow-based GUI for constructing workflows, configuring nodes, and validating graph integrity (e.g., no dead ends, single start).
*   **Execution Model:** An event-driven architecture where the server processes discrete events (`/start`, `/event`) by rehydrating the execution context, advancing the state machine, and suspending.
*   **Voice Interface:** A browser-based client handling TTS playback, audio recording, and communication with the engine.
*   **Observability:** A system to record and replay full session transcripts, including internal state changes and LLM decisions.

**Non-Functional Requirements:**
*   **Determinism:** The system must behave predictably; the same state + same event = same transition.
*   **Debuggability:** Users must be able to trace exactly *why* an agent made a decision.
*   **Scalability:** The architecture decouples the connection from the execution state, allowing horizontal scaling via stateless handlers and Redis.
*   **Performance:** Minimizing latency between "User stops speaking" and "Agent responds" is critical.

**Scale & Complexity:**
*   **Primary domain:** Full-Stack (Next.js + Custom Engine).
*   **Complexity level:** High. Involves building a visual programming language environment and a robust runtime engine.
*   **Estimated architectural components:** 7 (Frontend Builder, Runtime API, Workflow Executor, State Manager, Tool Registry, AI Integration Layer, Analytics/Logs).

### Technical Constraints & Dependencies
*   **Stack:** Next.js, React Flow, TRPC, Inngest (orchestration), Redis (Active State), Postgres (Storage).
*   **External Services:** LLMs (GPT-4/Claude), STT (Deepgram/Whisper), TTS (ElevenLabs/Azure).
*   **Protocol:** HTTP-based event loop (not necessarily full streaming duplex for the logic, though audio might be).

### Cross-Cutting Concerns Identified
*   **State Management:** The "Execution Context" is the single source of truth and must be consistently persisted.
*   **Versioning:** Workflows have a lifecycle (Draft -> Published -> Version N) that affects all running sessions.
*   **Telemetry:** Every action must be logged for the "Debug Mode" to work.
*   **Error Handling:** Timeouts and interruptions must be handled gracefully as state transitions.

## Starter Template Evaluation

### Primary Technology Domain
**Full-stack Web Application** based on the requirement for a visual editor (React Flow) and a complex event-driven runtime (Inngest).

### Starter Options Considered
*   **create-t3-app**: Offers a battle-tested, type-safe foundation for Next.js applications.
*   **create-next-app**: The standard Next.js starter; requires manual wiring for tRPC and Prisma.

### Selected Starter: `create-t3-app`

**Rationale for Selection:**
The platform relies heavily on consistency between the visual editor (frontend) and the execution engine (backend). `create-t3-app` provides an integrated tRPC setup that ensures the workflow JSON schema is shared and validated across the entire stack without manual effort.

**Initialization Command:**
```bash
npx create-t3-app@latest ./ --platform="vercel" --styling="tailwind" --trpc="true" --prisma="true" --nextAuth="false" --appRouter="true" --importAlias="~/" --noGit="true" --noInstall="true"
```

**Architectural Decisions Provided by Starter:**
*   **Language & Runtime**: TypeScript 5.x / Node.js 20+
*   **Styling Solution**: Tailwind CSS with PostCSS.
*   **Build Tooling**: Next.js (SWC) for fast compilation.
*   **API Layering**: tRPC for end-to-end typesafe procedures.
*   **Data Layer**: Prisma ORM with PostgreSQL support.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
*   **Execution State Modeling**: Hybrid Redis/Postgres approach.
*   **Authentication**: Clerk for rapid platform authorization.
*   **AI Service Integration**: Custom Adapter Pattern for multi-provider support.

**Important Decisions (Shape Architecture):**
*   **Next.js 15+ App Router** as the core framework.
*   **Inngest** for managing the event-driven lifecycle and retries of workflow execution.
*   **React Flow 12+** for the visual graph editor.

### Data Architecture
*   **Database**: PostgreSQL (via Prisma) for workflow definitions, versioning, and completed session archives.
*   **Real-time State**: Redis for active `ExecutionContext` storage to minimize latency during voice sessions.
*   **Rationale**: Voice interactions require sub-second state rehydration. PostgreSQL is the record of truth for reporting and auditing.

### Authentication & Security
*   **Provider**: Clerk.
*   **Rationale**: Offloading auth management allows the team to focus on the unique challenge of the workflow engine.
*   **API Security**: Clerk middleware integrated with tRPC context for protected procedures.

### API & Communication Patterns
*   **Primary API**: tRPC for type-safe interaction between the Editor UI and the Backend.
*   **Event Handling**: Inngest for processing background transitions and external tool calls reliably.
*   **Client Communication**: Standard HTTP event loop (Client -> POST /event -> Server responds with next action).

### AI Integration Patterns
*   **Pattern**: Adapter/Factory Pattern.
*   **Implementation**: Internal interfaces for `STTProvider`, `TTSProvider`, and `LLMProvider`.
*   **Rationale**: Allows switching from OpenAI to Claude, or Deepgram to Whisper, without changing core engine logic.

### Infrastructure & Deployment
*   **Hosting**: Vercel for the Next.js app.
*   **Redis**: Upstash (Vercel Integration) for serverless latency-optimized state.
*   **Postgres**: Neon or Supabase DB for serverless-friendly persistence.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
12 areas where AI agents could make different choices regarding labeling, organization, and state transitions.

### Naming Patterns

**Database Naming Conventions:**
*   Tables: `snake_case` plural (e.g., `execution_contexts`).
*   Columns: `snake_case` (e.g., `start_node_id`).

**API Naming Conventions:**
*   tRPC Prodedures: `camelCase` with resource prefix (e.g., `workflow.updateNode`).
*   Query Params: `camelCase`.

**Code Naming Conventions:**
*   Components: `PascalCase.tsx` (e.g., `SpeakNode.tsx`).
*   Logic Files/Hooks: `kebab-case.ts` (e.g., `use-engine-state.ts`).
*   Variables/Functions: `camelCase`.

### Structure Patterns

**Project Organization:**
*   `src/components/flow/`: All React Flow specialized logic and custom nodes.
*   `src/lib/engine/`: Core deterministic state machine implementation.
*   `src/server/inngest/`: Reliability layer for long-running workflows and integrations.

**File Structure Patterns:**
*   Tests: Co-located `*.test.ts`.

### Format Patterns

**API Response Formats:**
*   Standard tRPC Result/Error structure.
*   Next-action payload for voice events must always incluir `nodeId`, `actionType`, and `metadata`.

**Data Exchange Formats:**
*   Variable Interpolation: Double mustache `{{variable}}`.
*   JSON fields: `camelCase` (mapped from `snake_case` DB in API layer).

### Communication Patterns

**Event System Patterns:**
*   Inngest Events: `entity/action` lowercase (e.g., `session/transitioned`).

### Process Patterns

**Error Handling Patterns:**
*   Engine-level: Nodes must transition to a dedicated `error` node on unhandled failures.
*   UI-level: Status bar MUST reflect `status: 'idle' | 'listening' | 'processing' | 'speaking'`.

### Voice & Workflow Integration (Architecture Update)

**Refined Execution Model:**
- **Voice as Trigger**: User speech while idle is transcribed and sent to the `IntentDispatcher`, which performs a semantic match against all published **Workflow Trigger** nodes.
- **Voice as Input**: User speech during an active session is routed to the waiting **Listen Node**, rehydrating the `ExecutionContext` and advancing the state machine.
- **Zero Static Logic**: No hardcoded "if command == 'x'" logic. All system responses are defined by the `Speak` nodes within the active visual workflow.

### Project Structure & Boundaries (Refined)

```text
voice-ai/
├── src/
│   ├── app/api/voice/
│   │   ├── command/route.ts      # Intent Dispatcher (Audio -> Workflow Event)
│   │   └── tts/route.ts          # Streaming TTS Gateway
│   ├── components/voice/
│   │   ├── mic-overlay.tsx       # Global voice control UI
│   │   └── audio-streamer.tsx    # PCM-to-WAV playback bridge
│   ├── lib/engine/
│   │   ├── gateway/
│   │   │   ├── intent-resolver.ts # LLM-based speech-to-trigger mapping
│   │   │   └── stt-buffer.ts      # Audio chunk processing
│   │   ├── orchestrator/          # NEW: Real-time turn-taking logic
│   │   │   ├── turn-machine.ts   # Pure FSM for Voice UX
│   │   │   └── bridge.ts         # Adapter for advanceWorkflow
│   │   └── providers/
│   │       ├── factory.ts         # Injects ElevenLabs/Google/OpenAI
│   │       └── adapters/          # Specific provider implementations
│   ├── hooks/
│   │   └── use-workflow-voice.ts  # Bridging UI events to Engine SSE
```

### Architectural Boundaries
- **Engine Purity**: The `IntentDispatcher` must only emit `WorkflowEvents`. It is forbidden from calling UI components or direct database writes outside of the `ExecutionContext`.
- **Provider Isolation**: Provider-specific SDK logic (like the Google GenAI snippet) must be wrapped in adapters to allow "on-demand" switching via the `ProviderConfig` table.
- **Orchestrator Isolation**: The `turn-machine.ts` is a pure FSM that manages playback/listen states. It "consults" `advanceWorkflow` but does not modify its internal logic.

### Real-Time Voice Evolution (Superimposed)

To support real-time, interruptible voice (barge-in) without breaking the existing request–response workflow engine, we adopt a **Superimposed Reactive Layer**.

#### 1. The FSM & Orchestrator Pattern
The system is evolved by wrapping the existing `advanceWorkflow` (Logic Core) in a stateful **Orchestrator**. 

- **Stateful Host**: Maintains the persistent connection (WebSocket/WebRTC) and current `ExecutionState`.
- **Reactive FSM**: A pure reducer that manages high-speed UX states: `IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `INTERRUPTED`.
- **The Wrapper (Consultant)**: When the FSM reaches a "Need Logic" point, it calls the synchronous `advanceWorkflow`.

#### 2. Barge-in (Interruption) Logic
Interrupts are handled at the **Media/Orchestrator** level, not the Workflow level.
- `USER_SPEECH_START` event triggers an immediate `MUTE_AGENT` command to the client/gateway.
- The FSM transitions to `LISTENING`, and the previous `SPEAK` command's text buffer is truncated or discarded.
- The Workflow engine is notified of the interruption ONLY after a `USER_SPEECH_FINAL` transcript is received.

#### 3. Low Latency Streaming
- **Synthesized Streaming**: Text tokens from `LLMDecision` or `LLMReply` are piped to the TTS adapter as they arrive.
- **Pre-emptive Execution**: The Orchestrator can pre-fetch the next node's data while TTS is still playing the current node's audio.

### Enforcement Guidelines

**All AI Agents MUST:**
*   Use internal engine `ExecutionContext` for all state logic; never store conversation state in the browser only.
*   Validate workflow JSON schemas against Zod definitions before saving.
*   Ensure every `listen` node has a defined timeout behavior.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
voice-ai/
├── prisma/
│   └── schema.prisma             # Workflow definitions, logs, audits
├── public/                       # Static assets (audio prompts, icons)
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Clerk Login/Register
│   │   ├── dashboard/            # Workflow listing
│   │   ├── editor/[id]/          # The Visual Builder (React Flow)
│   │   └── api/
│   │       ├── trpc/[trpc]/      # API Gateway
│   │       └── inngest/          # Background worker entry
│   ├── components/
│   │   ├── flow/                 # React Flow: Nodes, Edges, Panels
│   │   ├── ui/                   # shadcn/ui components
│   │   └── voice/                # Audio visualizers, push-to-talk
│   ├── env/                      # Type-safe environment variables
│   ├── hooks/                    # use-voice-session, use-flow-editor
│   ├── lib/
│   │   ├── engine/               # THE HEART: Deterministic state machine
│   │   │   ├── advance.ts        # Transition logic
│   │   │   ├── providers/        # OpenAI, Deepgram, ElevenLabs adapters
│   │   │   └── types.ts          # ExecutionContext & Node schemas
│   │   ├── prisma.ts             # Postgres Client
│   │   └── redis.ts              # Upstash/Redis Client for active state
│   ├── server/
│   │   ├── api/
│   │   │   ├── root.ts
│   │   │   └── routers/          # workflow.ts, session.ts, user.ts
│   │   ├── inngest/              # Reliability layer: retries & tool calls
│   │   └── auth.ts               # Clerk server utilities
│   ├── styles/                   # globals.css
│   └── types/                    # Shared Zod schemas & TS types
├── .env                          # Local secrets
├── inngest.config.ts             # Workflow function definitions
└── next.config.ts
```

### Architectural Boundaries

**The "logic" Boundary:**
The engine logic in `src/lib/engine` **must not** import from `src/app` or `src/components`. It is a pure TypeScript library that receives a state and returns a new state. This makes it testable and portable.

**The "state" Boundary:**
Active conversation state starts in Redis (`src/lib/redis.ts`) for speed and is archived to Postgres (`prisma/schema.prisma`) only when the session reaches an `End` node or times out.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
*   **Epic: Visual Workflow Editor**: `src/components/flow/` & `src/server/api/routers/workflow.ts`
*   **Epic: Execution Engine**: `src/lib/engine/` & `src/server/inngest/`
*   **Epic: Voice Interaction**: `src/hooks/use-voice-session.ts` & `src/components/voice/`

**Cross-Cutting Concerns:**
*   **State & Tracking**: `src/lib/redis.ts` & `prisma/schema.prisma`
*   **Authentication System**: `src/app/(auth)/` & `src/server/auth.ts`

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
The stack (Next.js/tRPC/Inngest) is perfectly aligned for an event-driven platform. Using Redis for active session state solves the "Voice Latency Gap" that traditional SQL-only architectures face.

**Pattern Consistency:**
The bridge between `snake_case` database schemas and `camelCase` API/Code ensures that data remains portable while maintaining idiomatic TypeScript standards.

**Structure Alignment:**
The project structure respects the "Core Engine" as a pure TypeScript library, allowing for easy unit testing and debugging of the state machine logic without UI interference.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
*   **Workflow Engine**: Isolated in `src/lib/engine`, supported by Inngest for background tasks.
*   **Visual Editor**: Powered by React Flow in `src/components/flow` with tRPC schema validation.
*   **Voice Interaction**: Handled via browser client hooks and stateful event updates.
*   **Observability**: Integrated into the PostgreSQL schema for full execution tracing.

**Non-Functional Requirements Coverage:**
*   **Determinism**: Guaranteed by the pure logic in `src/lib/engine/advance.ts`.
*   **Scalability**: Stateless API design with Redis state rehydration.
*   **Performance**: Sub-second transitions via Redis + Vercel Edge/Serverless.

### Implementation Readiness Validation ✅

**Decision Completeness:**
All critical decisions—Database modeling, Auth (Clerk), and AI Adapters—are documented.

**Structure Completeness:**
A full directory tree is defined, mapping specific features to their physical locations.

**Pattern Completeness:**
Naming conventions, event formats, and error-handling processes are established.

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
*   Strong isolation of core business logic (The Engine).
*   End-to-end type safety from DB to UI.
*   High-performance event-driven model.
## Architecture Validation Results (Voice Refinement)

### Coherence Validation ✅

**Decision Compatibility:**
The use of **Next.js streaming responses** with the **Google GenAI TTS** (and equivalent) is highly compatible. The `ReadableStream` approach ensures that audio data is sent to the client in chunks, maintaining a low memory footprint on the server.

**Pattern Consistency:**
The **Workflow-Driven Voice Event** pattern aligns perfectly with our existing deterministic engine. By treating voice as a standard `data` input for `Listen` nodes, we maintain complete consistency in session history and tracing.

### Requirements Coverage Validation ✅

**Functional Requirements:**
- **Voice Commands**: Supported via the `IntentResolver` service.
- **Dynamic Config**: Supported via the `provider_configs` table and `ProviderFactory`.
- **Low Latency**: Addressed through SSE and streaming adapter implementations.

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
- **Dynamic Provider Switching**: Ability to switch from ElevenLabs to Google AI at runtime without code changes.
- **Pure Engine Logic**: The engine remains agnostic of the audio transport layer, facilitating easier unit testing.
- **Scalable Intent Mapping**: Using LLMs for intent mapping allows the system to scale to hundreds of workflows without complex regex/conditional trees.

### Implementation Handoff

**First Implementation Priority:**
Initialize the encrypted provider configuration vault and the base TTS/STT adapter interfaces.

### Implementation Handoff

**First Implementation Priority:**
Initialize the project using the following command:
```bash
npx create-t3-app@latest ./ --platform="vercel" --styling="tailwind" --trpc="true" --prisma="true" --nextAuth="false" --appRouter="true" --importAlias="~/" --noGit="true" --noInstall="true"
```
## Voice & Dynamic Configuration (Architecture Update)

### Refined Critical Decisions

**Decided during refinement:**
- **Provider Orchestration**: Transition from environment-variable-only to **Encrypted Database Storage** for AI provider credentials. This enables runtime configuration for ElevenLabs, OpenAI, and Google AI "on demand."
- **Voice Command Parsing**: Centralized "Voice Gateway" model. The frontend captures audio via `MediaRecorder` and POSTs to `/api/voice/command`. The backend performs STT -> LLM intent mapping.
- **Streaming TTS**: Utilize **ReadableStreams** with inline PCM-to-WAV conversion (as per the Google GenAI snippet) to provide sub-second voice responses.

### Data Architecture (Updated)
- **New Table**: `provider_configs`.
- **Fields**: `id`, `provider_type` (e.g., 'ELEVENLABS', 'GOOGLE_TTS'), `config_data` (encrypted JSON), `is_default` (boolean).
- **Rationale**: Decouples logic from specific account keys, making the system multi-tenant ready.

### AI Integration Patterns (Refined)
- **TTS Adapter Interface**:
  - `generateStream(text: string, voiceId: string): Promise<ReadableStream>`
  - Must handle base64 to Buffer conversion and WAV header injection for non-WAV streams.
- **STT Adapter Interface**:
  - `transcribe(audio: Blob): Promise<string>`
- **Intent Dispatcher**: New service that uses an LLM to map a `string` transcript to a `workflow_id` and `node_id` entry point.

### Communication Patterns (Refined)
- **Audio Delivery**: Server emits `audio_chunk` events over SSE.
- **Latency Optimization**: The engine begins streaming audio for a `Speak` node as soon as the first sentence is generated by the LLM, rather than waiting for the full response.
