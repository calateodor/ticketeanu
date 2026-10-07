import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, prLinks } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { expireStale } from "@/lib/orders";
import { requireEventAccess } from "@/lib/panel";
import { LinkButton } from "@/components/ui";
import { OrderBadge } from "@/components/order-badge";
import { OrderActions } from "./order-actions";

export default async function AttendeesPage({ params, searchParams }: PageProps<"/panou/evenimente/[id]/participanti">) {
  const { id } = await params;
  const sp = await searchParams;
  const { event } = await requireEventAccess(id);
  await expireStale(event.id);
  const rows = await db
    .select({ order: orders, qty: orderItems.quantity, name: orderItems.nameSnapshot, pr: prLinks.name })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(prLinks, eq(prLinks.id, orders.prLinkId))
    .where(eq(orders.eventId, event.id))
    .orderBy(desc(orders.createdAt));

  const grouped = new Map<string, { order: typeof orders.$inferSelect; items: string[]; qty: number; pr: string | null }>();
  for (const r of rows) {
    const g = grouped.get(r.order.id) ?? { order: r.order, items: [], qty: 0, pr: r.pr };
    if (r.name) {
      g.items.push(`${r.qty} × ${r.name}`);
      g.qty += r.qty ?? 0;
    }
    grouped.set(r.order.id, g);
  }
  const filter = typeof sp.stare === "string" ? sp.stare : "active";
  const all = [...grouped.values()];
  const list = filter === "toate" ? all : all.filter((g) => g.order.status === "confirmed" || g.order.status === "pending");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Participanți</h2>
          <p className="text-sm text-muted">Lista e a ta: o descarci oricând, cu acordul de marketing al fiecăruia.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton variant="secondary" size="sm" href={`/panou/evenimente/${event.id}/participanti?stare=${filter === "toate" ? "active" : "toate"}`}>
            {filter === "toate" ? "Doar active" : "Arată și anulate"}
          </LinkButton>
          <LinkButton variant="secondary" size="sm" href={`/panou/evenimente/${event.id}/participanti/export`}>
            Descarcă CSV
          </LinkButton>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-muted text-sm">Nicio rezervare{filter === "toate" ? "" : " activă"} încă.</p>
      ) : (
        <div className="overflow-x-auto rounded-(--radius-card) border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5">Nume</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Locuri</th>
                <th className="px-4 py-2.5">Bani</th>
                <th className="px-4 py-2.5">Stare</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map(({ order, items, qty, pr }) => (
                <tr key={order.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{order.buyerName}</p>
                    <p className="text-xs text-muted">
                      {order.code} · {formatDateTime(order.createdAt)}
                      {pr ? ` · PR: ${pr}` : order.source === "ticketeanu" ? " · adus de Ticketeanu" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{order.buyerEmail ?? "—"}</p>
                    <p className="text-muted">{order.buyerPhone ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold tabular">{qty}</p>
                    <p className="text-xs text-muted">{items.join(", ")}</p>
                  </td>
                  <td className="px-4 py-3 tabular">
                    {order.totalBani > 0 ? <p>{formatLei(order.totalBani)} online</p> : null}
                    {order.dueAtDoorBani > 0 ? <p className="text-[#854f0b]">{formatLei(order.dueAtDoorBani)} la intrare</p> : null}
                    {order.totalBani === 0 && order.dueAtDoorBani === 0 ? <p className="text-muted">gratuit</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <OrderBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <OrderActions eventId={event.id} orderId={order.id} status={order.status} paidOnline={order.totalBani > 0} hasEmail={!!order.buyerEmail} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
