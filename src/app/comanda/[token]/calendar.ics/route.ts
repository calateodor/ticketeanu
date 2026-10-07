import { getOrderByManageToken } from "@/lib/orders";
import { siteUrl } from "@/lib/mail";

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(_req: Request, ctx: RouteContext<"/comanda/[token]/calendar.ics">) {
  const { token } = await ctx.params;
  const data = await getOrderByManageToken(token);
  if (!data) return new Response("Not found", { status: 404 });
  const { event, order } = data;
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + 4 * 3_600_000);
  const location = [event.venueName, event.venueAddress, event.city].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ticketeanu//RO",
    "BEGIN:VEVENT",
    `UID:${order.id}@ticketeanu`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(event.title)}`,
    `DESCRIPTION:${esc(`Biletele tale: ${siteUrl(`/comanda/${token}`)}`)}`,
    location ? `LOCATION:${esc(location)}` : "",
    `URL:${siteUrl(`/e/${event.slug}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
