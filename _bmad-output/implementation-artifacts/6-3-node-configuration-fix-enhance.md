# Story 6.3: Node Configuration Fix & Dynamic Workflow Customization

Status: review

---

## Story

As a **platform user**,
I want **a fully customizable workflow builder (like N8N) where I can configure every node with my own settings, call ANY external API, and have the system execute exactly as I designed**,
So that **I can build unique voice AI workflows tailored to my specific business needs without being limited to preset options**.

---

## Problem Statement

The current node configuration system has **critical bugs** and **lacks the customization flexibility** expected from a modern workflow builder:

### Critical Bugs:
1. **Data Loss on Config Changes**: Node config components only send partial data on `onChange`, causing existing fields to be overwritten/lost
2. **Schema Mismatch**: Config panels use different field names than the engine expects (e.g., `prompt` vs `systemPrompt`/`userPromptTemplate`)
3. **Decision Node Routing**: LLM Decision outcomes aren't properly mapped to edge handles, causing incorrect branching (always takes last/wrong decision)

### Missing N8N-Style Customization:
4. **Tool Node Limited to Presets**: Users cannot configure ANY HTTP endpoint - only choose from hardcoded list
5. **No Dynamic HTTP Configuration**: Cannot specify custom URL, method, headers, request body
6. **Variable System Incomplete**: Cannot reliably pass data between nodes using `{{variables}}`
7. **No API Response Mapping**: Cannot extract specific fields from API response to variables

### Product Philosophy
This is a **workflow customization platform** like N8N - users should be able to:
- 🔧 **Configure ANY external API** (not just preset tools)
- 📝 **Write their own prompts** for AI nodes (system prompt, user prompt template)
- 🔀 **Define decision logic** with custom LLM instructions and branch outcomes
- 🔗 **Chain data between nodes** using variable interpolation `{{var}}`
- 🌐 **Call any REST API** with custom URL, method, headers, body

---

## Acceptance Criteria

### AC1: Config Data Persistence (Bug Fix)
- **Given** any node is selected and configured
- **When** I modify any field and the drawer closes
- **Then** ALL my configuration is persisted correctly
- **And** no existing fields are lost or overwritten

### AC2: LLM Decision - Full Customization
- **Given** an LLM Decision node is selected
- **When** I open the configuration panel
- **Then** I can configure:
  - **System Prompt**: My custom instructions for how the AI should decide
  - **User Prompt Template**: Template with `{{variables}}` for context
  - **Outcomes List**: My custom branch names (e.g., "order_status", "product_inquiry", "transfer_agent")
- **And** each outcome maps to an edge handle
- **And** during execution, the LLM uses MY prompts to make the decision
- **And** the workflow routes to the correct branch

### AC3: LLM Reply - Full Customization
- **Given** an LLM Reply node is selected
- **When** I open the configuration panel
- **Then** I can configure:
  - **System Prompt**: AI personality/response guidelines
  - **User Prompt Template**: Context template with `{{variables}}`
  - **Save Response As**: Variable name to store the AI's response
- **And** during execution, the AI uses MY custom prompts
- **And** the response is saved to MY specified variable

### AC4: Tool Node - Generic HTTP Request (N8N Style)
- **Given** a Tool node (HTTP Request) is selected
- **When** I open the configuration panel
- **Then** I can configure:
  - **HTTP Method**: GET, POST, PUT, PATCH, DELETE
  - **URL**: Any endpoint with `{{variable}}` interpolation (e.g., `https://api.example.com/tasks/{{task_id}}`)
  - **Headers**: Key-value pairs with interpolation support
  - **Request Body**: JSON template with `{{variable}}` interpolation (for POST/PUT/PATCH)
  - **Save Response As**: Variable name to store the response
  - **Response Path (optional)**: JSONPath to extract specific field (e.g., `data.items[0].title`)
- **And** the node makes a REAL HTTP call during execution
- **And** the response is available as `{{my_variable}}` in subsequent nodes

### AC5: Variable System - End-to-End Data Flow
- **Given** I build a workflow:
  1. Listen node → saves user input to `{{user_input}}`
  2. Tool node → calls `https://jsonplaceholder.typicode.com/todos/{{user_input}}` → saves to `{{task_data}}`
  3. LLM Reply node → uses `{{task_data}}` in prompt → saves to `{{ai_response}}`
  4. Speak node → speaks `{{ai_response}}`
- **When** the workflow executes with user input "1"
- **Then** each node correctly receives interpolated values
- **And** the final spoken text includes actual API data

### AC6: Speak Node - Variable Interpolation
- **Given** a Speak node with text `"The task is: {{task_data.title}}"`
- **When** `task_data` contains `{ "title": "Buy groceries" }`
- **Then** the spoken text is "The task is: Buy groceries"

### AC7: Listen Node - Clean Configuration
- **Given** a Listen node is selected
- **When** I configure:
  - **Save Transcript As**: Variable name (e.g., `user_query`)
  - **Timeout**: Silence timeout in seconds
- **Then** the user's speech is saved to `{{user_query}}`
- **And** subsequent nodes can use `{{user_query}}`

## Tasks / Subtasks

### Task 1: Fix Node Config Data Merge Pattern (AC: 1)
- [x] 1.1 Update `speak-config.tsx`: `onChange({ ...data, text: e.target.value })`
- [x] 1.2 Update `listen-config.tsx`: merge all fields properly on change
- [x] 1.3 Update `llm-decision-config.tsx`: merge data properly on all field changes
- [x] 1.4 Update `llm-reply-config.tsx`: merge data properly on all field changes
- [x] 1.5 Update `tool-config.tsx`: merge data properly on all field changes

### Task 2: LLM Decision Node - Fix Schema + Routing (AC: 2)
- [x] 2.1 Add `systemPrompt` textarea field (for AI decision instructions)
- [x] 2.2 Rename `prompt` to `userPromptTemplate` (context template with variables)
- [x] 2.3 Ensure outcomes array syncs with edge handles
- [x] 2.4 Update `base-node.tsx` to render dynamic output handles per outcome
- [x] 2.5 Fix `runner.ts` decision routing: match LLM response to `sourceHandle`

### Task 3: LLM Reply Node - Fix Schema (AC: 3)
- [x] 3.1 Add `systemPrompt` textarea field (AI personality/guidelines)
- [x] 3.2 Add `userPromptTemplate` textarea field (context template)
- [x] 3.3 Keep `saveAs` field for response variable name
- [x] 3.4 Remove old `prompt` field, migrate to new schema

### Task 4: Tool Node - N8N Style HTTP Request (AC: 4, 5)
- [x] 4.1 Redesign `tool-config.tsx` as generic HTTP Request config:
  - HTTP Method dropdown: GET, POST, PUT, PATCH, DELETE
  - URL text input with `{{variable}}` helper text
  - Headers section: dynamic key-value pairs (add/remove)
  - Request Body textarea (shown for POST/PUT/PATCH)
  - Response Variable Name input
  - Response Path input (optional JSONPath extraction)
- [x] 4.2 Update `src/lib/engine/types.ts` ToolNodeData schema:
  ```typescript
  ToolNodeDataSchema = z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
    url: z.string(), // Supports {{variable}} interpolation
    headers: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
    body: z.string().optional(), // JSON template with {{variables}}
    outputVar: z.string().default('http_response'),
    responsePath: z.string().optional(), // JSONPath like "data.items[0].title"
  })
  ```
- [x] 4.3 Create `src/lib/engine/http-client.ts`:
  - `executeHttpRequest(config, variables)` function
  - Interpolate `{{variables}}` in URL, headers, body
  - Parse JSON response
  - Extract value at responsePath if specified
- [x] 4.4 Update `runner.ts` TOOL node handler:
  - Call `executeHttpRequest()` with node config and context variables
  - Save result to `outputVar` variable
  - Handle errors gracefully

### Task 5: Enhanced Variable Interpolation (AC: 5, 6)
- [x] 5.1 Update `interpolateTemplate()` to support nested paths: `{{task_data.title}}`
- [x] 5.2 Add helper util: `getNestedValue(obj, path)` for `data.items[0].title`
- [x] 5.3 Show variable hint tooltips in config text fields

### Task 6: Listen Node - Clean Config (AC: 7)
- [x] 6.1 Rename internal field labels for clarity
- [x] 6.2 Ensure timeout is in milliseconds but shown as seconds in UI

### Task 7: Update Type Definitions (AC: 1, all)
- [x] 7.1 Update `src/types/nodes.ts` DEFAULT_NODE_DATA to match updated schemas
- [x] 7.2 Ensure all node types have correct default data

---

## Dev Notes

### N8N-Style Product Philosophy

This is a **workflow customization platform** - NOT a preset tool selector. Users should feel empowered like N8N:

| Instead of... | We provide... |
|---------------|---------------|
| Dropdown of preset tools | Free-form URL input for ANY API |
| Hardcoded API calls | User-configured HTTP requests |
| Limited options | Full control over method, headers, body |
| Magic behavior | Predictable variable interpolation |

### Critical Architecture Patterns

**1. Data Merge Pattern** (MUST FOLLOW):
```typescript
// ❌ WRONG - loses existing fields
onChange({ text: e.target.value })

// ✅ CORRECT - preserves all fields
onChange({ ...data, text: e.target.value })
```

**2. Schema Alignment** - Config field names MUST match `src/lib/engine/types.ts`:
```
Config UI Field → Engine Schema Field → Runner Usage
```

**3. Variable Interpolation** - Support nested paths:
```typescript
// Input: "Hello {{user.name}}, your task is {{task_data.title}}"
// Variables: { user: { name: "John" }, task_data: { title: "Buy milk" } }
// Output: "Hello John, your task is Buy milk"
```

---

### Updated Schema Definitions

**ToolNodeData** (N8N-Style HTTP Request):
```typescript
{
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,              // "https://api.example.com/tasks/{{task_id}}"
  headers: Array<{key: string, value: string}>,
  body?: string,            // JSON template: '{"query": "{{user_input}}"}'
  outputVar: string,        // "api_response"
  responsePath?: string     // "data.items[0]" to extract nested value
}
```

**LLMReplyNodeData**:
```typescript
{
  systemPrompt: string,        // "You are a helpful customer service agent..."
  userPromptTemplate: string,  // "Based on {{api_response}}, help the user with: {{user_input}}"
  saveAs: string,              // "ai_reply"
  llmConfig?: LLMConfig
}
```

**LLMDecisionNodeData**:
```typescript
{
  systemPrompt: string,        // "Classify the user's intent..."
  userPromptTemplate: string,  // "User said: {{user_input}}"
  outcomes: Array<{
    value: string,             // "order_status" (also used as edge handle)
    description?: string       // "User is asking about their order"
  }>,
  llmConfig?: LLMConfig
}
```

---

### File Structure

```
src/
  app/editor/_components/nodes/
    speak-config.tsx          # FIX: data merge
    listen-config.tsx         # FIX: data merge
    llm-decision-config.tsx   # REWRITE: systemPrompt + userPromptTemplate + outcomes
    llm-reply-config.tsx      # REWRITE: systemPrompt + userPromptTemplate + saveAs
    tool-config.tsx           # REWRITE: N8N-style HTTP Request config
    base-node.tsx             # UPDATE: dynamic handles for Decision outcomes
  
  lib/engine/
    types.ts                  # UPDATE: ToolNodeData schema
    runner.ts                 # UPDATE: Tool node handler
    http-client.ts            # NEW: HTTP request executor with interpolation
  
  types/
    nodes.ts                  # UPDATE: DEFAULT_NODE_DATA
```

---

### Example Workflow Configuration (User's Perspective)

**Node 1: Speak** → "Hello! What's your task ID?"
**Node 2: Listen** → Save to `{{task_id}}`
**Node 3: HTTP Request** → 
  - Method: `GET`
  - URL: `https://jsonplaceholder.typicode.com/todos/{{task_id}}`
  - Save as: `{{task_data}}`
**Node 4: LLM Reply** →
  - System: "You are a helpful assistant. Summarize task info concisely."
  - User Template: "The task data is: {{task_data}}. Explain it to the user."
  - Save as: `{{ai_summary}}`
**Node 5: Speak** → "{{ai_summary}}"

---

### References

- [Source: src/lib/engine/types.ts] - Zod schemas (source of truth)
- [Source: src/lib/engine/runner.ts] - Execution logic
- [Source: _bmad-output/planning-artifacts/architecture.md] - FR6-FR10
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3] - Node configuration stories

---

## Dev Agent Record

### Agent Model Used

Claude (Anthropic)

### Debug Log References

- Pre-existing TypeScript errors in workflow-canvas.tsx (not introduced by this story)

### Completion Notes List

1. **Task 1: Data Merge Pattern** - Updated all 5 node config components to properly merge data with `{...data, fieldName: value}` pattern, preventing data loss on config changes.

2. **Task 2: LLM Decision Node** - Rewrote `llm-decision-config.tsx` to use:
   - `systemPrompt` (AI decision instructions)
   - `userPromptTemplate` (context template with variables)
   - `outcomes` array with optional descriptions
   - Proper data merge via useEffect

3. **Task 3: LLM Reply Node** - Rewrote `llm-reply-config.tsx` to use:
   - `systemPrompt` (AI personality/guidelines)
   - `userPromptTemplate` (context template)
   - `saveAs` for storing AI response in variable

4. **Task 4: N8N-Style HTTP Request Tool Node** - Complete rewrite:
   - New schema in `types.ts`: method, url, headers, body, outputVar, responsePath
   - Created `http-client.ts` with `executeHttpRequest()` and nested path interpolation
   - New `tool-config.tsx` with full HTTP configuration UI
   - Updated `runner.ts` to execute real HTTP requests

5. **Task 5: Enhanced Variable Interpolation** - Added support for nested paths like `{{task_data.title}}` using `getNestedValue()` function.

6. **Task 6: Listen Node** - Cleaned up config with user-friendly labels and seconds-based timeout input.

7. **Task 7: DEFAULT_NODE_DATA** - Updated to match all new schema definitions.

### File List

**New Files:**
- src/lib/engine/http-client.ts

**Modified Files:**
- src/app/editor/_components/nodes/speak-config.tsx
- src/app/editor/_components/nodes/listen-config.tsx
- src/app/editor/_components/nodes/llm-decision-config.tsx
- src/app/editor/_components/nodes/llm-reply-config.tsx
- src/app/editor/_components/nodes/tool-config.tsx
- src/lib/engine/types.ts
- src/lib/engine/runner.ts
- src/types/nodes.ts
- src/app/dashboard/workflow/[id]/page.tsx (type fix - unrelated bug)

### Change Log

- 2026-02-07: Story 6-3 implemented - N8N-style workflow customization with data merge fixes, schema updates, HTTP request tool node, and enhanced variable interpolation
