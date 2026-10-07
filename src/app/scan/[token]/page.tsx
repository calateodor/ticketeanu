import { notFound } from "next/navigation";
import { doorStats, getDoorContext } from "@/lib/checkin";
import { formatDayShort, formatTime } from "@/lib/dates";
import { Scanner } from "./scanner";

export const metadata = { title: "Scanare" };

export default async function ScanPage({ params }: PageProps<"/scan/[token]">) {
  const { token } = await params;
  const ctx = await getDoorContext(token);
  if (!ctx) notFound();
  const stats = await doorStats(ctx.event.id);
  return (
    <Scanner
      token={token}
      eventTitle={ctx.event.title}
      eventWhen={`${formatDayShort(ctx.event.startsAt)}, ${formatTime(ctx.event.startsAt)}`}
      doorLabel={ctx.door.label}
      initialStats={stats}
    />
  );
}
