# Story 3.3: Tool Node Configuration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user,
I want to configure external tool calls for my agent,
so that the agent can perform actions like fetching order details or booking appointments.

## Acceptance Criteria

1. **Given** a Tool node is selected
2. **When** the config drawer opens
3. **Then** the user can select a tool from a dropdown (e.g., `check_inventory`, `send_email`)
4. **And** they can map input variables to tool parameters (Key-Value pairs)
5. **And** they can define a `saveAs` variable for the tool's JSON response
6. **And** changes update the node's `data` object and are saved.

## Tasks / Subtasks

- [x] Task 1: Tool Selection UI (AC: 1, 3)
  - [x] Create `ToolNodeConfig` component.
  - [x] Implement a `Select` component for tool types.
  - [x] Mock a list of available tools (e.g., `check_inventory`, `search_knowledge_base`).
- [x] Task 2: Parameter Mapping (AC: 4)
  - [x] Implement a dynamic Key-Value pair editor for tool inputs.
  - [x] Allow users to use `{{variables}}` as values.
- [x] Task 3: Response Action (AC: 5, 6)
  - [x] Add input for `saveAs` variable.
  - [x] Update `data.toolId`, `data.inputs`, and `data.outputVar`.

## Dev Notes

- **Architecture Compliance**:
  - Ensure tool schemas are consistent with the backend engine's expected "Tool" execution logic.
- **Source Tree Components**:
  - `src/app/editor/_components/nodes/tool-config.tsx` (New)

### Project Structure Notes

- Future-proof: Consider where "Tool Definitions" will live (likely a central registry).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3]

## Dev Agent Record
 
 ### Agent Model Used
 
 Antigravity (Gemini 2.0 Flash)
 
 ### Debug Log References
- Integrated shadcn `Select` for tool type picking.
- Used `useFieldArray` for flexible parameter mapping.

 ### Completion Notes List
- [x] Tool nodes can now be fully configured with external tool IDs and inputs.
- [x] Parameter mapping supports variable interpolation.
- [x] Response storage variable is configurable.

 ### File List
- `src/app/editor/_components/nodes/tool-config.tsx` (Created)
- `src/app/editor/_components/node-config-drawer.tsx` (Modified)
