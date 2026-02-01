import { requireAuth } from "@/lib/auth-util";
import { HydrateClient, prefetch, trpc } from "@/server/trpc/server";
import { CreateWorkflowButton } from "./_components/create-workflow-button";
import { WorkflowTable } from "./_components/workflow-table";

export default async function Page() {
  await requireAuth();
  prefetch(trpc.workflow.list.queryOptions());

  return (
    <HydrateClient>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="flex items-center justify-between px-4 lg:px-6">
              <h1 className="text-2xl font-bold">Workflows</h1>
              <CreateWorkflowButton />
            </div>
            <div className="px-4 lg:px-6">
              <WorkflowTable />
            </div>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
