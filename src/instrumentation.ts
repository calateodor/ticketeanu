// În dev și pe un server propriu, rulăm sarcinile programate din proces.
// Pe platforme serverless, folosește un cron extern care apelează /api/cron/tick.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.INPROCESS_CRON === "0") return;
  const { runScheduledTasks } = await import("./lib/scheduler");
  const every = Number(process.env.INPROCESS_CRON_SECONDS ?? 60) * 1000;
  const g = globalThis as unknown as { __ticketeanuCron?: ReturnType<typeof setInterval> };
  if (g.__ticketeanuCron) clearInterval(g.__ticketeanuCron);
  g.__ticketeanuCron = setInterval(() => {
    runScheduledTasks().catch((err) => console.error("[cron]", err));
  }, every);
}
