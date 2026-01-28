import { DataTable } from "@/components/data-table";
import data from "./data.json";
import { requireAuth } from "@/lib/auth-util";
import { HydrateClient, prefetch, trpc } from "@/server/trpc/server";

export default async function Page() {
  await requireAuth();
  prefetch(trpc.workflow.hello.queryOptions({ text: "hello" }));

  return (
    <HydrateClient>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <DataTable data={data} />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
