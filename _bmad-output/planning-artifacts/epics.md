stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['/Users/aadarsh/dev/voice-ai/.github/workflow_based_voice_ai_agent_platform_project_plan.md', '/Users/aadarsh/dev/voice-ai/_bmad-output/planning-artifacts/architecture.md']
status: 'complete'
completedAt: '2026-02-08T20:41:45+05:30'
---

# voice-ai - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for voice-ai, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Dashboard to display a list of all defined workflows.
FR2: Capability to create a new workflow draft and version existing ones.
FR3: Visual Builder: Drag and drop predefined node types onto a canvas.
FR4: Visual Builder: Connect nodes with directed edges to define state transitions.
FR5: Visual Builder: Open a configuration panel (right drawer) for specific node data.
FR6: Node Config: Define 'Speak' node text with variable interpolation support.
FR7: Node Config: Define 'Listen' node variable storage and timeout settings.
FR8: Node Config: Define 'LLM Decision' node prompts, output enums, and branch mapping.
FR9: Node Config: Define 'Tool' node selections and input/output mapping.
FR10: Node Config: Define 'LLM Reply' node prompts and storage variables.
FR11: Real-time Graph Validation: Check for single start node, orphaned nodes, and endless loops.
FR12: Workflow Serialization: Transform React Flow graph into authorized backend JSON schema.
FR13: Versioning Lifecycle: Draft -> Validate -> Publish (Immutable).
FR14: Text Simulator (Test Mode): Debug workflows step-by-step with visual node highlighting.
FR15: Observability UI: View chronological session traces, variable states, and LLM logs.
FR16: Durable Execution Logic: Reliable workflow runtime using Inngest.
FR17: Dynamic Provider Vault: Secure, encrypted storage for ElevenLabs, Google, and OpenAI keys reachable at runtime.
FR18: Voice Trigger Gateway: Semantic intent resolution to start workflows from raw audio speech.
FR19: Streaming TTS Pipeline: Low-latency audio delivery using ReadableStreams (TTFW < 1s).
FR20: Audio Visualization UI: Mic overlay with real-time waveform for capture and playback status.
FR21: Node-Level Voice Overrides: Ability to configure specific voices/providers within 'Speak' node configuration.

### NonFunctional Requirements

NFR1: Determinism: Ensure transitions are predictable based on JSON schema and execution state.
NFR2: High Performance: UI should minimize latency for graph operations and state updates.
NFR3: Scalability: Decoupled architecture allowing stateless execution across many sessions.
NFR4: Debuggability: Full audit trail for every node transition and AI event.
NFR5: Audio Latency (TTFW): Achieve sub-second response time from "speech end" to "audio start".
NFR6: Credential Security: Encrypt all third-party API keys at rest in PostgreSQL.

### Additional Requirements

- **Starter Template**: Use `create-t3-app` with Next.js 15, tRPC, and Prisma.
- **Frontend Stack**: React Flow 12+, shadcn/ui, Tailwind CSS, and Zustand for state.
- **Backend Stack**: Inngest for event orchestration and Redis/Postgres hybrid storage.
- **Authentication**: Integrate Clerk for user and organization management.
- **Design**: Use default shadcn/ui theme and standard components with minimal customization.
- **Consistency**: All API interactions must use tRPC for end-to-end type safety.
- **Validation**: Use Zod for all schema and form validation.
- **Backward Compatibility**: New voice engine logic must wrap existing `EngineRunner` without breaking text-based simulation.
- **Streaming Support**: Next.js route handlers must support `ReadableStream` for TTS delivery.
- **Provider Encryption**: Use `node:crypto` (AES-256-GCM) for storing provider secrets in the DB.

### FR Coverage Map

FR1: Epic 1 - Dashboard listing
FR2: Epic 1 - Create/Draft workflow
FR3: Epic 2 - Drag/Drop nodes
FR4: Epic 2 - Directed edges
FR5: Epic 2 - Config panel trigger
FR6: Epic 3 - Speak node configuration
FR7: Epic 3 - Listen node configuration
FR8: Epic 3 - LLM Decision configuration
FR9: Epic 3 - Tool node configuration
FR10: Epic 3 - LLM Reply configuration
FR11: Epic 4 - Graph validation logic
FR12: Epic 2 - JSON Serialization
FR13: Epic 1 - Publish/Versioning lifecycle
FR14: Epic 4 - Step-by-step simulator
FR15: Epic 5 - Session observability UI
FR16: Epic 6 - Durable Execution Logic
FR17: Epic 7 - Provider Configuration Vault
FR18: Epic 8 - Voice Gateway & Intent Parsing
FR19: Epic 9 - Streaming Audio Engine
FR20: Epic 9 - Voice UI & Visualizers
FR21: Epic 3 - Node-level Override Configuration

## Epic List

### Epic 1: Workspace Management & Workflow Lifecycle
Enable users to organize their projects. Users can view a dashboard of all agents, create new ones, and move them through the "Draft to Publish" lifecycle.
**FRs covered:** FR1, FR2, FR13.

### Epic 2: Core Visual Canvas Experience
Provide the visual primary interface. Users can drag nodes from a palette onto a React Flow canvas, connect them with edges, and save the result as an authorized JSON schema.
**FRs covered:** FR3, FR4, FR5, FR12.

### Epic 3: Specialized Node Configuration
Turn visual nodes into functional logic. Users can open configuration drawers for each node type (Speak, Listen, LLM, etc.) and define their variables and prompts.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR21.

### Epic 4: Graph Integrity & Text Simulation
Ensure reliability and debuggability. Users get real-time validation for their graphs and can run a text-based simulator to step through the conversation.
**FRs covered:** FR11, FR14.

### Epic 5: Session Observability & Execution Trace UI
Provide transparency into AI operations. Users can view chronological session traces, see variable changes, and inspect LLM logs.
**FRs covered:** FR15.

### Epic 6: Durable Workflow Execution (Inngest)
Implement the core runtime engine that executes the JSON-based state machines reliably using Inngest durable functions.
**FRs covered:** FR16.

### Epic 7: Provider Configuration & Vault
Centralize AI service management. Users can securely configure ElevenLabs, Google AI, and OpenAI credentials via an encrypted UI vault.
**FRs covered:** FR17.

### Epic 8: Voice Gateway & Intent Parsing
Enable starting workflows via speech. A dedicated endpoint that transcribes audio and uses semantic mapping to trigger the correct "Trigger" node.
**FRs covered:** FR18.

### Epic 9: Real-Time Voice Streaming & UI
The interactive voice experience. High-performance streaming TTS pipeline integrated with a visual "Mic Overlay" showing waveform feedback.
**FRs covered:** FR19, FR20.

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic 1: Workspace Management & Workflow Lifecycle

Enable users to organize their projects. Users can view a dashboard of all agents, create new ones, and move them through the "Draft to Publish" lifecycle.

### Story 1.1: Project Initialization & Dashboard

As a developer,
I want to initialize the project with the T3 stack and see a list of my workflows,
So that I have a solid foundation for building the platform.

**Acceptance Criteria:**

**Given** the architecture decisions
**When** the project is initialized using `npx create-t3-app@latest ./` with the specified flags
**Then** the baseline T3 app is running with Next.js 15, Prisma, and tRPC.
**And** a user logged in via Clerk can see an empty dashboard state (or list of workflows).
**And** each workflow item displays its name, current version, and "Last Edited" timestamp.

### Story 1.2: Create New Workflow Draft

As a platform user,
I want to create a new voice agent project,
So that I can start designing a new conversation flow.

**Acceptance Criteria:**

**Given** the user is on the dashboard
**When** they click "Create New Workflow" and provide a name
**Then** a new workflow record is created in PostgreSQL with status `DRAFT`
**And** the user is redirected to the `/editor/[id]` page

### Story 1.3: Versioning & Publish Lifecycle

As a platform user,
I want to publish my draft workflows,
So that they become immutable and ready for runtime execution.

**Acceptance Criteria:**

**Given** a user is in the editor for a `DRAFT` workflow
**When** they click "Publish"
**Then** the system validates the graph integrity (simplified check for now)
**And** the version is incremented, the status becomes `PUBLISHED`, and the current version is locked from further edits

## Epic 2: Core Visual Canvas Experience

Provide the visual primary interface. Users can drag nodes from a palette onto a React Flow canvas, connect them with edges, and save the result as an authorized JSON schema.

### Story 2.1: Canvas Initialization & Node Palette

As a platform user,
I want to drag predefined voice node types from a sidebar onto a canvas,
So that I can begin building the structure of my voice agent.

**Acceptance Criteria:**

**Given** a user is on the Editor page
**When** they open the "Node Palette"
**Then** they see icons for all 7 node types (Trigger, Speak, Listen, LLM Decision, Tool, LLM Reply, End)
**And** dragging a node onto the React Flow canvas successfully renders a default card for that node type

### Story 2.2: Directed Edge Connectivity

As a platform user,
I want to connect nodes with directed edges,
So that I can define the path the conversation will take.

**Acceptance Criteria:**

**Given** two nodes exist on the canvas
**When** a user drags a connection from one node's output handle to another's input handle
**Then** a directed edge is created
**And** the UI prevents invalid connections (e.g., source and target being the same node)

### Story 2.3: Workflow Serialization & Auto-Save

As a platform user,
I want my visual design to be automatically saved as a JSON schema,
So that I don't lose my work and the engine can execute it later.

**Acceptance Criteria:**

**Given** the user has modified the canvas (moved nodes, added edges)
**When** a "Save" event is triggered (manual or debounced auto-save)
**Then** the React Flow state is transformed into the platform's `WorkflowSchema` (Normalizing nodes and edges)
**And** the JSON is successfully stored in the PostgreSQL database via a tRPC call

## Epic 3: Specialized Node Configuration

Turn visual nodes into functional logic. Users can open configuration drawers for each node type (Speak, Listen, LLM, etc.) and define their variables and prompts using default shadcn forms.

### Story 3.1: Speak & Listen Node Configuration

As a platform user,
I want to configure the speech text and listening variables for my agent,
So that I can define what the agent says and what it waits for.

**Acceptance Criteria:**

**Given** a Speak or Listen node is selected on the canvas
**When** the user clicks the node
**Then** a right drawer (shadcn Sheet) opens
**And** for a **Speak** node, the user can enter text with `{{variable}}` interpolation support
**And** for a **Listen** node, the user can define the variable name to store the result and the silence timeout (seconds)

### Story 3.2: LLM Node Configuration (Decision & Reply)

As a platform user,
I want to configure how the agent makes decisions and generates replies using LLMs,
So that I can leverage AI for natural conversation.

**Acceptance Criteria:**

**Given** an LLM Decision or LLM Reply node is selected
**When** the config drawer opens
**Then** the user can enter a prompt template
**And** for **LLM Decision**, the user can define a list of enum outcomes (branches) that map to the visual edge labels

### Story 3.3: Tool Node Configuration

As a platform user,
I want to configure external tool calls for my agent,
So that the agent can perform actions like fetching order details or booking appointments.

**Acceptance Criteria:**

**Given** a Tool node is selected
**When** the config drawer opens
**Then** the user can select a tool from a dropdown (e.g., `check_inventory`, `send_email`)
**And** they can map input variables to the tool parameters and define a `saveAs` variable for the response

## Epic 4: Graph Integrity & Text Simulation

Ensure reliability and debuggability. Users get real-time validation for their graphs and can run a text-based simulator to step through the conversation before deployment.

### Story 4.1: Real-time Graph Validation

As a platform user,
I want to see visual warnings if my workflow graph is invalid,
So that I don't publish broken agents.

**Acceptance Criteria:**

**Given** a user is designing a graph
**When** a change is made (add/remove node or edge)
**Then** a background validation runner checks:
*   Is there exactly one Start node?
*   Are there any isolated (orphaned) nodes?
*   Are all Decision branches connected?
**And** invalid nodes/edges are visually highlighted with a red border or warning icon

### Story 4.2: Step-by-Step Text Simulator

As a platform user,
I want to test my workflow in a text-based simulator within the editor,
So that I can verify the logic before running real voice sessions.

**Acceptance Criteria:**

**Given** a valid workflow draft
**When** the user clicks "Test Workflow"
**Then** a chat-like simulator opens
**And** as the simulation progresses, the current active node is highlighted on the React Flow canvas
**And** the user can see current variable states updated in real-time in a side panel

## Epic 5: Observability & Execution Trace UI

Provide transparency into AI operations. Users can view chronological session traces, see variable changes, and inspect LLM logs for finished sessions.

### Story 5.1: Session History & List

As a platform user,
I want to see a history of all conversations my agent has had,
So that I can review its performance and debug issues.

**Acceptance Criteria:**

**Given** a user is on the "Sessions" tab for a workflow
**When** the page loads
**Then** they see a table of past sessions with metadata (Session ID, Start Time, Duration, Final Status)
**And** the list is filterable by status (Ended, Error, Active)

### Story 5.2: Chronological Node Trace UI

As a platform user,
I want to see a step-by-step trace of a specific session,
So that I can understand exactly why an agent reached a certain state.

**Acceptance Criteria:**

**Given** a user is viewing a specific session detail page
**When** they select a node from the execution timeline
**Then** the UI highlights that node on the (read-only) React Flow canvas
**And** a side panel shows the exact input variables, the LLM decision/prompt used (if applicable), and the resulting output for that specific step

## Epic 6: Durable Workflow Execution (Inngest)

Implement the core runtime engine that executes the JSON-based state machines reliably. Supports conversational resumes, tool calls, and LLM orchestration via Inngest durable functions.

### Story 6.1: Inngest-Powered Execution Logic

As a system,
I want to execute workflow transitions using Inngest durable functions,
So that conversational state is preserved across interruptions and wait states.

**Acceptance Criteria:**

1. **Given** a published workflow and a trigger event
2. **When** the Inngest function is invoked
3. **Then** it loads the workflow JSON and current session state from Redis/Postgres
4. **And** it executes nodes sequentially (Speak -> Listen -> LLM) following directed edges
5. **And** for 'Listen' nodes, the function pauses (suspends) and waits for a specific 'resume' event
6. **And** once resumed, it updates the session context with user input and continues to the next node

### Story 6.2: AI & Tool Orchestration within Inngest

As a system,
I want to handle LLM calls and external tool executions within the durable workflow,
So that expensive or slow operations are retried reliably and their results persisted.

**Acceptance Criteria:**

1. **Given** the execution reaches an LLM or Tool node
2. **When** the Inngest step executes
3. **Then** it calls the respective AI provider (OpenAI/Claude) or Tool registry adapter
4. **And** it handles retries automatically on transient failures
5. **And** the result is saved back into the `ExecutionContext` variables before moving to the next node

## Epic 7: Provider Configuration & Vault

Centralize AI service management. Users can securely configure ElevenLabs, Google AI, and OpenAI credentials via an encrypted UI vault.

### Story 7.1: Encrypted Provider Configuration Schema

As a system administrator,
I want to store AI provider credentials in an encrypted database table,
So that I can configure providers at runtime without sensitive data exposure.

**Acceptance Criteria:**

**Given** a PostgreSQL database with Prisma
**When** the `provider_configs` table is created with `providerType`, `encryptedConfig`, and `isDefault`
**Then** a crypto utility must be implemented to encrypt/decrypt the `config_data` using a server-side key.

### Story 7.2: Provider Management UI (The Vault)

As a platform user,
I want a secure settings page to input my AI provider keys,
So that I can enable voice features for my workflows on demand.

**Acceptance Criteria:**

**Given** a user is on the Settings dashboard
**When** they input their API keys for Google or ElevenLabs
**Then** the keys are encrypted and saved via tRPC
**And** the UI must mask the keys once saved.

## Epic 8: Voice Gateway & Intent Parsing

Enable starting workflows via speech using semantic mapping.

### Story 8.1: Voice Capture & Gateway Entry
As a user,
I want to click a mic button and speak my intent,
So that I can start a workflow without typing.

**Acceptance Criteria:**
**Given** a user clicks the "Mic" button
**When** they stop speaking
**Then** the audio is POSTed to `/api/voice/command`
**And** the UI shows a "Processing..." state.

### Story 8.2: Semantic Intent Resolver
As a system,
I want to map user speech to the most relevant workflow trigger node,
So that the agent starts the correct conversation.

**Acceptance Criteria:**
**Given** a transcript from the STT provider
**When** the Resolver LLM analyzes published workflows
**Then** it returns the `workflowId` and `nodeId` of the best matching trigger
**And** the engine advances to that node.

## Epic 9: Real-Time Voice Streaming & UI

The interactive voice experience with low-latency streaming.

### Story 9.1: Streaming TTS Adapter (Google AI)
As a system,
I want to stream audio chunks to the browser as they are generated,
So that the user hears the agent speak immediately (TTFW < 1s).

**Acceptance Criteria:**
**Given** a `Speak` node execution
**When** the TTS provider starts generating audio
**Then** the server responds with a `ReadableStream` of audio data
**And** the client begins playback while the stream is still downloading.

### Story 9.2: Audio Visualization UI
As a user,
I want to see visual feedback when I am speaking or when the agent is speaking,
So that I know the system is active.

**Acceptance Criteria:**
**Given** an active voice session
**When** status is 'listening' or 'speaking'
**Then** a waveform visualizer renders in the chat interface
**And** it reflects the actual audio volume/frequency.
