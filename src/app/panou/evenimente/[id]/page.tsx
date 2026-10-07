import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { formatLei } from "@/lib/money";
import { eventStats, expireStale } from "@/lib/orders";
import { requireEventAccess } from "@/lib/panel";
import { Card, LinkButton, Stat } from "@/components/ui";
import { OrderBadge } from "@/components/order-badge";

export default async function EventOverview({ params, searchParams }: PageProps<"/panou/evenimente/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { event } = await requireEventAccess(id);
  await expireStale(event.id);
  const stats = await eventStats(event.id);
  const recent = await db
    .select({ order: orders, qty: orderItems.quantity, name: orderItems.nameSnapshot })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.eventId, event.id))
    .orderBy(desc(orders.createdAt))
    .limit(30);

  const grouped = new Map<string, { order: typeof orders.$inferSelect; items: string[] }>();
  for (const r of recent) {
    const g = grouped.get(r.order.id) ?? { order: r.order, items: [] };
    if (r.name) g.items.push(`${r.qty} × ${r.name}`);
    grouped.set(r.order.id, g);
  }
  const list = [...grouped.values()].slice(0, 12);
  const publicUrl = siteUrl(`/e/${event.slug}`);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${event.title} · ${publicUrl}`)}`;

  return (
    <div className="space-y-6">
      {sp.nou ? (
        <div className="rounded-(--radius-card) bg-stamp-soft text-stamp-deep px-5 py-4">
          <p className="font-bold">Evenimentul e creat, ca ciornă.</p>
          <p className="text-sm mt-0.5">Verifică biletele în tab-ul „Bilete”, apoi apasă „Publică”. Până atunci, linkul merge doar pentru tine.</p>
        </div>
      ) : null}
      {event.status === "draft" ? (
        <div className="rounded-(--radius-card) border border-warn-soft bg-warn-soft/60 text-[#854f0b] px-5 py-3 text-sm">
          Evenimentul nu e publicat. Lumea nu poate rezerva încă.
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Locuri ocupate" value={event.capacity ? `${stats.taken}/${event.capacity}` : stats.taken} hint={`${stats.confirmedOrders} ${stats.confirmedOrders === 1 ? "rezervare" : "rezervări"}`} />
        <Stat label="Încasat online" value={formatLei(stats.paidOnline)} hint="înainte de comision" />
        <Stat label="De încasat la intrare" value={formatLei(stats.dueAtDoor)} hint="rezervări cu plata la ușă" />
        <Stat label="Au venit" value={stats.arrived} hint={stats.seats ? `din ${stats.seats} așteptați` : undefined} />
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-lg mb-1">Trimite linkul</h2>
        <p className="text-sm text-muted mb-3">Pagina e gândită pentru telefon. Pe WhatsApp și Instagram apare cu afiș, dată și preț.</p>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={wa} target="_blank" variant="secondary">
            Trimite pe WhatsApp
          </LinkButton>
          <LinkButton href={`/panou/evenimente/${event.id}/promovare`} variant="secondary">
            Linkuri pentru PR-i
          </LinkButton>
          <LinkButton href={`/panou/evenimente/${event.id}/intrare`} variant="secondary">
            Linkuri de scanare
          </LinkButton>
        </div>
      </Card>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Ultimele rezervări</h2>
          <Link href={`/panou/evenimente/${event.id}/participanti`} className="text-sm font-medium text-stamp-deep hover:underline">
            Toți participanții →
          </Link>
        </div>
        {list.length === 0 ? (
          <p className="text-muted text-sm">Încă nimic. Când cineva rezervă, apare aici pe loc.</p>
        ) : (
          <ul className="divide-y divide-line rounded-(--radius-card) border border-line bg-surface">
            {list.map(({ order, items }) => (
              <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{order.buyerName}</p>
                  <p className="text-sm text-muted truncate">{items.join(", ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular">{order.totalBani > 0 ? formatLei(order.totalBani) : order.dueAtDoorBani > 0 ? `${formatLei(order.dueAtDoorBani)} la ușă` : "gratuit"}</p>
                  <p className="text-xs text-muted">{formatDateTime(order.createdAt)}</p>
                </div>
                <OrderBadge status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
