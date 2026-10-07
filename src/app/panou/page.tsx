import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireOrganizer } from "@/lib/auth";
import { formatDayShort, formatTime, nowMs } from "@/lib/dates";
import { Badge, Empty, LinkButton, PageTitle } from "@/components/ui";

export const metadata = { title: "Evenimente" };

const statusLabel: Record<string, { label: string; tone: "neutral" | "ok" | "warn" | "danger" }> = {
  draft: { label: "Ciornă", tone: "neutral" },
  published: { label: "Publicat", tone: "ok" },
  cancelled: { label: "Anulat", tone: "danger" },
  ended: { label: "Încheiat", tone: "neutral" },
};

export default async function PanelHome(props: PageProps<"/panou">) {
  const { organizer } = await requireOrganizer("/panou");
  const sp = await props.searchParams;
  const rows = await db
    .select({
      event: events,
      // Subinterogare scrisă explicit: într-un select pe o singură tabelă, Drizzle nu prefixează coloanele.
      seats: sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where o.event_id = "events"."id" and o.status = 'confirmed'), 0)`,
    })
    .from(events)
    .where(eq(events.organizerId, organizer.id))
    .orderBy(desc(events.startsAt));

  const now = nowMs();
  const upcoming = rows.filter((r) => r.event.startsAt.getTime() >= now - 6 * 3_600_000 && r.event.status !== "cancelled");
  const past = rows.filter((r) => !upcoming.includes(r));

  return (
    <>
      {sp["bun-venit"] ? (
        <div className="rounded-(--radius-card) bg-stamp-soft text-stamp-deep px-5 py-4 mb-6">
          <p className="font-bold">Bun venit, {organizer.name}!</p>
          <p className="text-sm mt-0.5">Fă primul eveniment: ai nevoie de un nume, o dată și un preț. Restul vine după.</p>
        </div>
      ) : null}
      <PageTitle sub="Tot ce vinzi și rezervi, într-un singur loc." actions={<LinkButton href="/panou/evenimente/nou">+ Eveniment nou</LinkButton>}>
        Evenimente
      </PageTitle>

      {rows.length === 0 ? (
        <Empty title="Niciun eveniment încă" action={<LinkButton href="/panou/evenimente/nou">Fă primul eveniment</LinkButton>}>
          Pagina de eveniment e gata în câteva minute și o poți trimite pe WhatsApp sau Instagram imediat.
        </Empty>
      ) : null}

      {upcoming.length > 0 ? <EventList title="Urmează" rows={upcoming} /> : null}
      {past.length > 0 ? <EventList title="Trecute sau anulate" rows={past} muted /> : null}
    </>
  );
}

function EventList({ title, rows, muted = false }: { title: string; rows: { event: typeof events.$inferSelect; seats: number }[]; muted?: boolean }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm uppercase tracking-wider text-muted font-semibold mb-3">{title}</h2>
      <ul className="grid gap-3">
        {rows.map(({ event, seats }) => {
          const st = statusLabel[event.status] ?? statusLabel.draft;
          return (
            <li key={event.id}>
              <Link
                href={`/panou/evenimente/${event.id}`}
                className={`flex items-center gap-4 rounded-(--radius-card) bg-surface border border-line p-4 hover:border-line-strong transition-colors ${muted ? "opacity-70" : ""}`}
              >
                <div className="w-16 shrink-0 text-center rounded-xl bg-paper py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{formatDayShort(event.startsAt).split(" ").slice(-1)[0]}</p>
                  <p className="text-2xl font-extrabold font-display leading-none">{event.startsAt.toLocaleDateString("ro-RO", { day: "numeric", timeZone: "Europe/Bucharest" })}</p>
                  <p className="text-[11px] text-muted">{formatTime(event.startsAt)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{event.title}</p>
                  <p className="text-sm text-muted truncate">{[event.venueName, event.city].filter(Boolean).join(" · ") || "Fără locație"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-extrabold text-xl tabular">
                    {Number(seats)}
                    {event.capacity ? <span className="text-muted text-sm font-sans font-medium">/{event.capacity}</span> : null}
                  </p>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
