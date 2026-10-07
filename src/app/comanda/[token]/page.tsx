import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import type { CSSProperties } from "react";
import { formatDay, formatDayShort, formatTime, nowMs } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { formatLei } from "@/lib/money";
import { expireStale, getOrderByManageToken } from "@/lib/orders";
import { Logo } from "@/components/ui";
import { ShareButtons } from "@/components/event/share-buttons";
import { Ticket, TicketMachine } from "@/components/ticket/ticket";
import { OrderControls } from "./order-controls";

export const metadata = { title: "Rezervarea ta" };

export default async function OrderPage({ params, searchParams }: PageProps<"/comanda/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  await expireStale();
  const data = await getOrderByManageToken(token);
  if (!data) notFound();
  const { order, event, organizer, items, tickets, group } = data;
  const accent = event.theme?.accent ?? organizer.brand?.accent ?? "#8A3DFF";
  const isNew = sp.nou === "1";
  const seats = items.reduce((s, i) => s + i.quantity, 0);

  const qrs = await Promise.all(
    tickets.map(async (t) => ({
      ticket: t,
      dataUrl: await QRCode.toDataURL(siteUrl(`/bilet/${t.code}`), { margin: 1, width: 360, color: { dark: "#15102A", light: "#FFFFFF" } }),
    })),
  );
  const active = order.status === "confirmed";
  const pendingPay = order.status === "pending" && order.expiresAt && order.expiresAt.getTime() > nowMs();
  const groupUrl = group ? siteUrl(`/g/${group.code}`) : null;
  const ticketStatus = (s: "valid" | "used" | "cancelled") => (active ? s : pendingPay ? "pending" : "cancelled");

  return (
    <div className="night min-h-dvh" style={{ "--accent": accent } as CSSProperties}>
      <header className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
          <Logo dark />
        </Link>
        <Link href={`/e/${event.slug}`} className="text-sm text-night-muted hover:text-white">
          Pagina evenimentului
        </Link>
      </header>
      <main className="max-w-xl mx-auto px-4 pb-16">
        <section className="text-center pt-2 pb-4">
          <h1 className="headline text-[clamp(2.2rem,9vw,3.6rem)]">
            {active ? (isNew ? "Biletul tău a ieșit." : "Intri.") : pendingPay ? "Mai e un pas." : order.status === "refunded" ? "Rambursată." : order.status === "expired" ? "A expirat." : "Anulată."}
          </h1>
          <p className="text-night-muted mt-2">
            {event.title} · {formatDay(event.startsAt)}, ora {formatTime(event.startsAt)}
          </p>
          <p className="mt-1 text-sm text-night-muted">
            {order.buyerName} · {seats === 1 ? "1 loc" : `${seats} locuri`} · comanda <span className="font-mono font-bold text-white">{order.code}</span>
          </p>
        </section>

        {pendingPay ? (
          <div className="glass rounded-3xl p-5 mb-6">
            <p className="font-bold">Rezervarea așteaptă plata.</p>
            <p className="text-sm text-night-muted mt-1">Locurile sunt ținute până la ora {formatTime(order.expiresAt!)}. După, se eliberează.</p>
            <OrderControls token={token} mode="pay" />
          </div>
        ) : null}

        {order.dueAtDoorBani > 0 && active ? (
          <div className="glass rounded-2xl px-4 py-3 text-sm mb-4">
            La intrare mai ai de plătit <strong>{formatLei(order.dueAtDoorBani)}</strong>. Arăți codul QR și plătești acolo.
          </div>
        ) : null}

        <TicketMachine>
          <ul className="grid gap-5">
            {qrs.map(({ ticket, dataUrl }, i) => (
              <li key={ticket.id} style={isNew && i > 0 ? ({ animationDelay: `${1400 + i * 120}ms` } as CSSProperties) : undefined} className={isNew ? (i === 0 ? "ticket-print" : "fade-up") : undefined}>
                <Ticket
                  title={event.title}
                  subtitle={event.subtitle}
                  dayLabel={formatDayShort(event.startsAt)}
                  timeLabel={formatTime(event.startsAt)}
                  venue={event.venueName}
                  city={event.city}
                  holder={ticket.holderName ?? order.buyerName}
                  typeName={items.find((it) => it.ticketTypeId === ticket.ticketTypeId)?.nameSnapshot ?? "Intrare"}
                  code={ticket.code}
                  orderCode={order.code}
                  qrDataUrl={dataUrl}
                  coverUrl={event.coverUrl}
                  useCover={event.theme?.ticketCover ?? false}
                  status={ticketStatus(ticket.status)}
                  discountNote={order.discountNote}
                  dueAtDoorLabel={i === 0 && order.dueAtDoorBani > 0 ? formatLei(order.dueAtDoorBani) : null}
                  index={i + 1}
                  count={tickets.length}
                  motionButton={i === 0}
                  animate={false}
                />
              </li>
            ))}
          </ul>
        </TicketMachine>
        {active ? <p className="text-sm text-night-muted text-center -mt-2">Salvează pagina sau fă o captură; codurile merg și fără internet.</p> : null}

        {groupUrl && group ? (
          <section className="mt-8 glass rounded-3xl p-5">
            <h2 className="font-display font-bold text-xl">{group.name}</h2>
            <p className="text-sm text-night-muted mt-1">
              Ții {group.holdQuantity} locuri până {formatDay(group.holdExpiresAt).toLowerCase()}, ora {formatTime(group.holdExpiresAt)}. Trimite linkul în grupul de WhatsApp: fiecare își ia și își plătește locul lui.
            </p>
            <p className="mt-2 text-sm font-mono break-all">{groupUrl}</p>
            <div className="mt-3">
              <ShareButtons url={groupUrl} title={`${group.name} · ${event.title}`} dark />
            </div>
          </section>
        ) : null}

        <section className="mt-8 space-y-3">
          {active ? (
            <a href={`/comanda/${token}/calendar.ics`} className="block text-center glass rounded-2xl py-3 text-sm font-bold hover:bg-white/15">
              Pune în calendar
            </a>
          ) : null}
          {active ? <OrderControls token={token} mode="cancel" paid={order.totalBani > 0} /> : null}
          <p className="text-xs text-night-muted text-center">
            Organizator: {organizer.name}
            {organizer.contactEmail ? (
              <>
                {" · "}
                <a href={`mailto:${organizer.contactEmail}`} className="underline">
                  {organizer.contactEmail}
                </a>
              </>
            ) : null}
          </p>
        </section>
      </main>
    </div>
  );
}
