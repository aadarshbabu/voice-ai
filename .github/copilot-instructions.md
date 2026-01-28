# Copilot Instructions for Voice AI Workflow Platform

## Architecture Overview

This is a **Next.js 16 + TypeScript + Prisma** workflow automation platform with the following stack:

- **Frontend**: React 19 with Radix UI components (via Shadcn), TailwindCSS
- **Backend**: tRPC v11 for type-safe APIs, Prisma ORM with PostgreSQL
- **Auth**: BetterAuth (email/password) with session-based authentication
- **State Management**: TanStack React Query (v5) with tRPC integration
- **Task Queue**: Inngest for asynchronous workflow processing
- **Drag & Drop**: @dnd-kit for workflow node/edge manipulation
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form + Zod validation

## Critical Architecture Patterns

### 1. tRPC Router Structure (`src/server/routers/`)

- **Root router** (`_app.ts`): Composes all sub-routers (e.g., `workflowRouter`)
- **Pattern**: Each domain gets its own router file
  - `workflowRouter` in `workflow.ts` handles Workflow CRUD and operations
  - Use `baseProcedure` for public endpoints, `protectedProcedure` for auth-required endpoints
- **Middleware**: `isAuthed` middleware enforces authentication, extracts `ctx.user` for protected procedures

### 2. Authentication Flow

- **Library**: BetterAuth with Prisma adapter connected to PostgreSQL
- **Session Model**: Server validates session via `auth.api.getSession({ headers })` (see [auth.ts](src/lib/auth.ts#L1))
- **Protection**:
  - Server components: Use `requireAuth()` from [auth-util.ts](src/lib/auth-util.ts#L1) to redirect unauthenticated users to `/login`
  - tRPC procedures: Use `protectedProcedure` instead of `baseProcedure`
- **Auth Routes**: All auth endpoints routed through [src/app/api/auth/[...all]/route.ts](src/app/api/auth/[...all]/route.ts#L1) using `toNextJsHandler`

### 3. Database Layer

- **Schema**: Located at [prisma/schema.prisma](prisma/schema.prisma#L1)
- **Models**: `User`, `Workflow`, `Account`, `Session` (managed by BetterAuth + custom)
- **Workflow Model**: Stores `nodes` and `edges` as JSON (serialized graph structure for visual editor)
- **Generation**: Prisma client generated to [src/generated/prisma/client.ts](src/generated/prisma/client.ts) (custom output path in generator)

### 4. Client-Side Data Flow

- **Provider**: [TRPCReactProvider](src/providers/TRPCProvider.tsx#L27) wraps the app with:
  - TanStack React Query client (singleton pattern to avoid re-creation)
  - tRPC HTTP batch link pointing to `/api/trpc`
- **Calling APIs**: Use tRPC hooks via React Query integration
  - Example: `trpc.workflow.list.useQuery()` in client components
  - Server-side prefetch: Use `prefetch()` with `queryOptions()` in Server Components before hydration (see [dashboard/page.tsx](src/app/dashboard/page.tsx#L1))

### 5. Dashboard Layout Structure

- **Layout**: [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx#L1) provides:
  - Sidebar provider with dynamic width/height CSS vars
  - AppSidebar component for navigation
  - SiteHeader for top bar
  - SidebarInset container for main content
- **Auth**: Dashboard pages protected via `requireAuth()` redirects

## Developer Workflows

### Starting Development

```bash
npm run dev        # Start Next.js dev server (port 3000)
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint (basic Next.js config)
```

### Database Operations

```bash
npx prisma migrate dev --name <migration-name>  # Create + run migration
npx prisma studio                              # Open Prisma visual DB editor
npx prisma generate                            # Regenerate Prisma client
```

### Adding a New API Endpoint

1. Create or extend router in `src/server/routers/` (e.g., `src/server/routers/workflow.ts`)
2. Define input schema with Zod, use `protectedProcedure.input().mutation/query()`
3. Register in app router (`src/server/routers/_app.ts`): `export const appRouter = createTRPCRouter({ workflow: workflowRouter })`
4. Call from client using React Query hooks: `trpc.workflow.<method>.useQuery/useMutation()`

### Adding a Database Model

1. Update [prisma/schema.prisma](prisma/schema.prisma#L1)
2. Run `npx prisma migrate dev --name <name>`
3. Regenerate client: `npx prisma generate`
4. Update tRPC routers to expose new model

## Project-Specific Conventions

### Styling & UI Components

- **Tailwind + Shadcn**: All UI components in `src/components/ui/` are Shadcn variants
- **Custom Components**: Feature components in `src/components/` (e.g., `DataTable`, `AppSidebar`, `LoginForm`)
- **CSS**: Global styles in `src/app/globals.css`, component-level styles via Tailwind classes
- **Dark Mode**: Configured via `next-themes` (available but needs explicit theme provider if not already set)

### Data Table Component (`src/components/data-table.tsx`)

- **Size**: 856 lines with complex sorting/filtering/pagination logic
- **Features**: TanStack React Table integration with dnd-kit for drag-and-drop row reordering
- **Usage**: Displays workflow/data tables with interactive rows, column visibility toggle, faceted filtering

### Workflow Node/Edge Structure

- **Storage**: Workflow `nodes` and `edges` stored as JSON in Prisma
- **Visual Editor**: Uses `@xyflow/react` v12.9.2 (React Flow library)
- **Nodes Directory**: [src/components/Nodes/](src/components/Nodes/) (currently empty—node components to be added)

### Forms & Validation

- **Library**: React Hook Form + Zod schema validation
- **Pattern**: Define schema (e.g., `loginSchema`, `signupSchema` in form components)
- **Error Handling**: Form validation errors auto-display via `useForm` error state, toast notifications via `sonner` library

### API Endpoint URL

- **Root**: `/api/trpc`
- **tRPC Batching**: Single HTTP request for multiple tRPC calls (configured via `httpBatchLink`)
- **Environment**: URL adapts for local dev (`http://localhost:3000`), Vercel deployments, and edge deployments

## Key File References

| File                                                             | Purpose                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| [src/server/routers/\_app.ts](src/server/routers/_app.ts)        | Root tRPC router, composes all sub-routers                |
| [src/server/trpc/init.ts](src/server/trpc/init.ts)               | tRPC initialization, middleware, procedure types          |
| [src/lib/auth.ts](src/lib/auth.ts)                               | BetterAuth instance + Prisma adapter config               |
| [src/lib/auth-util.ts](src/lib/auth-util.ts)                     | Server-side auth helpers (`requireAuth`, `requireUnAuth`) |
| [src/lib/auth-client.ts](src/lib/auth-client.ts)                 | Client-side auth client for form submissions              |
| [src/providers/TRPCProvider.tsx](src/providers/TRPCProvider.tsx) | React Query + tRPC client setup                           |
| [prisma/schema.prisma](prisma/schema.prisma)                     | Database schema definition                                |
| [src/app/dashboard/](src/app/dashboard/)                         | Protected dashboard pages and layout                      |
| [src/components/ui/](src/components/ui/)                         | Shadcn UI component library                               |

## Common Pitfalls & Best Practices

1. **Always use `protectedProcedure` for user-specific data** to ensure session validation
2. **Prefix server-only utilities with comments** (`import { type X } from "server-only"`) to prevent accidental client imports
3. **Invalidate React Query cache** after mutations: `queryClient.invalidateQueries({ queryKey: ['trpc', 'workflow'] })`
4. **Use `HydrateClient` wrapper** in Server Components that prefetch tRPC data to hydrate the client cache
5. **Workflow nodes/edges are JSON**—ensure serialization when storing complex objects
6. **Environment variables**: Set `DATABASE_URL` for Prisma, `VERCEL_URL` for deployment detection
