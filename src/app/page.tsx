import { requireAuth } from "@/lib/auth-util";
export default async function Home() {
  await requireAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <>We can able to load please reload the browser.</>
    </div>
  );
}
