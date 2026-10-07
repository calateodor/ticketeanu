import { runScheduledTasks } from "@/lib/scheduler";

// Apelat periodic (la 1-5 minute) de un cron extern sau de instrumentation.ts în dev.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? new URL(req.url).searchParams.get("secret");
  if (secret && auth !== `Bearer ${secret}` && auth !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runScheduledTasks();
  return Response.json(result);
}
