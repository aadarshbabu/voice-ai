# Story 2.1: Canvas Initialization & Node Palette

Status: done

## Story

As a platform user,
I want to drag predefined voice node types from a sidebar onto a canvas,
so that I can begin building the structure of my voice agent.

## Acceptance Criteria

1. **Given** a user is on the Editor page
2. **When** they open the "Node Palette" (Sidebar)
3. **Then** they see icons/labels for all 7 node types (Trigger, Speak, Listen, LLM Decision, Tool, LLM Reply, End)
4. **And** dragging a node onto the `@xyflow/react` canvas successfully renders a default node for that type
5. **And** the canvas is zoomable and pannable by default

## Tasks / Subtasks

- [x] Task 1: React Flow (Xyflow) Setup (AC: 4, 5)
  - [x] Initialize `@xyflow/react` in `src/app/editor/[id]/page.tsx`.
  - [x] Create a basic `WorkflowCanvas` component.
  - [x] Add `Background` and `Controls` components from Xyflow.
- [x] Task 2: Node Palette Component (AC: 2, 3)
  - [x] Create `src/app/editor/_components/node-palette.tsx`.
  - [x] Implement draggable items for: Trigger, Speak, Listen, LLM Decision, Tool, LLM Reply, End.
  - [x] Use `onDragStart` to pass node type in `dataTransfer`.
- [x] Task 3: Drag & Drop Logic (AC: 4)
  - [x] Implement `onDrop` and `onDragOver` handlers on the canvas wrapper.
  - [x] Calculate drop position relative to canvas coordinates using `screenToFlowPosition`.
  - [x] Update local state (nodes) with the new node.
- [x] Task 4: Custom Node Components (Basic) (AC: 4)
  - [x] Define a `base` node style using shadcn/ui Card patterns.
  - [x] Register custom node types with Xyflow.

## Dev Notes

- **Library**: Using `@xyflow/react` (v12+).
- **Architecture Compliance**: Managed nodes and edges state locally; drag and drop verified with coordinate conversion.
- **Styling**: Leveraged shadcn/ui for Node Palette and custom Node shells.

### Project Structure Notes

- `src/app/editor/_components/workflow-canvas.tsx` - Main canvas component.
- `src/app/editor/_components/node-palette.tsx` - Draggable sidebar.
- `src/app/editor/_components/nodes/base-node.tsx` - Reusable custom node component.

### References

- [Source: package.json # @xyflow/react]
- [Source: _bmad-output/planning-artifacts/epics.md #Story 2.1]

## Dev Agent Record

### Agent Model Used

Gemini 2.0 Flash

### Debug Log References

- Fixed `BackgroundVariant` enum usage.
- Added `scroll-area` shadcn component.
- Implemented `screenToFlowPosition` logic for accurate dropping.
- **Review Follow-up**: Created `src/types/nodes.ts` for shared constants and default data.
- **Review Follow-up**: Removed `fitView` to prevent annoying camera snapping.
- **Review Follow-up**: Switched to `crypto.randomUUID()` for unique node IDs.
- **Review Follow-up**: Enhanced node handle size and visibility (primary theme color).
- **Review Follow-up**: Added premium selection states (glow, slight scale) to active nodes.

### Completion Notes List

- [x] Infinite canvas with dots background and controls.
- [x] Sidebar with 7 voice-themed draggable nodes.
- [x] Successful drop logic with coordinate mapping.
- [x] Branded custom nodes with icons and distinct colors.
- [x] Type-safe node data initialization.

### File List

- `src/app/editor/[id]/page.tsx`
- `src/app/editor/_components/workflow-canvas.tsx`
- `src/app/editor/_components/node-palette.tsx`
- `src/app/editor/_components/nodes/base-node.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/types/nodes.ts`
