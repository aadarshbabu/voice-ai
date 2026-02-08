# Story 3.2: LLM Node Configuration (Decision & Reply)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to configure how the agent makes decisions and generates replies using LLMs,
so that I can leverage AI for natural conversation.

## Acceptance Criteria

1. **Given** an LLM Decision or LLM Reply node is selected
2. **When** the config drawer opens
3. **Then** the user can enter a prompt template with `{{variable}}` support
4. **And** for **LLM Decision**, the user can define a list of outcomes (branches) that map to edges.
5. **And** for **LLM Reply**, the user can define a `saveAs` variable to store the AI's response text.
6. **And** changes update the node's `data` object, which is then serialized and saved.

## Tasks / Subtasks

- [x] Task 1: LLM Decision Configuration (AC: 3, 4, 6)
  - [x] Create `LLMDecisionConfig` component.
  - [x] Implement prompt `Textarea`.
  - [x] Implement a dynamic list for "Outcomes" (e.g., "Yes", "No", "Maybe").
  - [x] Ensure outcomes update the node's `data.outcomes` array.
- [x] Task 2: LLM Reply Configuration (AC: 3, 5, 6)
  - [x] Create `LLMReplyConfig` component.
  - [x] Implement prompt `Textarea`.
  - [x] Add input for `saveAs` variable name.
- [x] Task 3: Edge Synchronization (Decision Node) (AC: 4)
  - [x] Research how to represent decision branches in React Flow (likely edge labels or specific handle IDs).
  - [x] Ensure that adding an outcome in the drawer allows the user to connect an edge corresponding to that outcome.

## Dev Notes

- **Architecture Compliance**:
  - Extend the `NodeConfigDrawer` created in Story 3.1.
  - Use `react-hook-form`'s `useFieldArray` for dynamic outcomes.
- **Source Tree Components**:
  - `src/app/editor/_components/node-config-drawer.tsx`
  - `src/app/editor/_components/nodes/llm-decision-config.tsx` (New)
  - `src/app/editor/_components/nodes/llm-reply-config.tsx` (New)

### Project Structure Notes

- Standardize prompt editors across all LLM nodes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.0 Flash)

### Debug Log References
- Implemented multi-handle support in `BaseNode` specifically for `llm-decision` nodes.
- Used `react-hook-form`'s `useFieldArray` for efficient outcome management.
- Initialized `LLM_DECISION` with default outcomes in `src/types/nodes.ts`.

### Completion Notes List
- [x] LLM Decision nodes now dynamically render source handles for each outcome.
- [x] LLM Reply nodes support prompt configuration and variable storage.
- [x] Real-time synchronization between drawer forms and canvas node data.

### File List
- `src/app/editor/_components/nodes/llm-decision-config.tsx` (Created)
- `src/app/editor/_components/nodes/llm-reply-config.tsx` (Created)
- `src/app/editor/_components/node-config-drawer.tsx` (Modified)
- `src/app/editor/_components/nodes/base-node.tsx` (Modified)
- `src/types/nodes.ts` (Modified)
