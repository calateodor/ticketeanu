import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { events, orders, ticketTypes, tickets } from "@/db/schema";
import { formatDayShort, formatTime } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { Logo } from "@/components/ui";
import { Ticket } from "@/components/ticket/ticket";

export const metadata = { title: "Bilet" };

export default async function TicketPage({ params }: PageProps<"/bilet/[code]">) {
  const { code } = await params;
  const [row] = await db
    .select({ ticket: tickets, order: orders, event: events, typeName: ticketTypes.name })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(events, eq(events.id, tickets.eventId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, tickets.ticketTypeId))
    .where(eq(tickets.code, code.toUpperCase()))
    .limit(1);
  if (!row) notFound();
  const { ticket, order, event, typeName } = row;
  const valid = order.status === "confirmed";
  const dataUrl = await QRCode.toDataURL(siteUrl(`/bilet/${ticket.code}`), { margin: 1, width: 360, color: { dark: "#15102A", light: "#FFFFFF" } });

  return (
    <div className="night min-h-dvh">
      <header className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
          <Logo dark />
        </Link>
        <Link href={`/comanda/${order.manageToken}`} className="text-sm text-night-muted hover:text-white">
          Toată comanda
        </Link>
      </header>
      <main className="max-w-md mx-auto px-6 pb-12">
        <Ticket
          title={event.title}
          subtitle={event.subtitle}
          dayLabel={formatDayShort(event.startsAt)}
          timeLabel={formatTime(event.startsAt)}
          venue={event.venueName}
          city={event.city}
          holder={ticket.holderName ?? order.buyerName}
          typeName={typeName}
          code={ticket.code}
          orderCode={order.code}
          qrDataUrl={dataUrl}
          coverUrl={event.coverUrl}
          useCover={event.theme?.ticketCover ?? false}
          status={valid ? ticket.status : order.status === "pending" ? "pending" : "cancelled"}
          discountNote={order.discountNote}
        />
        {!valid ? <p className="mt-4 text-center text-sm text-night-muted">{order.status === "pending" ? "Comanda așteaptă plata." : "Biletul nu mai e valabil."}</p> : null}
      </main>
    </div>
  );
}
