import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { prLinks, promoCodes } from "@/db/schema";
import { siteUrl } from "@/lib/mail";
import { formatLei } from "@/lib/money";
import { requireEventAccess } from "@/lib/panel";
import { PrForm, PrToggle } from "./promo-forms";

export default async function PromoPage({ params }: PageProps<"/panou/evenimente/[id]/promovare">) {
  const { id } = await params;
  const { event } = await requireEventAccess(id);
  const [promos, prs] = await Promise.all([
    db.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.eventId, event.id)),
    db
      .select({
        pr: prLinks,
        ordersCount: sql<number>`(select count(*) from orders o where o.pr_link_id = "pr_links"."id" and o.status = 'confirmed')`,
        seats: sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where o.pr_link_id = "pr_links"."id" and o.status = 'confirmed'), 0)`,
        revenue: sql<number>`coalesce((select sum(o.subtotal_bani - o.discount_bani) from orders o where o.pr_link_id = "pr_links"."id" and o.status = 'confirmed'), 0)`,
      })
      .from(prLinks)
      .where(eq(prLinks.eventId, event.id))
      .orderBy(desc(prLinks.createdAt)),
  ]);

  const prView = prs.map((r) => {
    const revenue = Number(r.revenue);
    const commission = r.pr.commissionType === "percent" ? Math.round((revenue * r.pr.commissionValue) / 100) : r.pr.commissionValue * Number(r.seats);
    return {
      ...r.pr,
      url: siteUrl(`/e/${event.slug}?pr=${r.pr.code}`),
      ordersCount: Number(r.ordersCount),
      seats: Number(r.seats),
      revenue,
      commission,
      commissionLabel: r.pr.commissionType === "percent" ? `${r.pr.commissionValue}%` : `${formatLei(r.pr.commissionValue)}/bilet`,
    };
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold">Linkuri de PR</h2>
        <p className="text-sm text-muted mb-4">
          Fiecare PR primește linkul lui. Vezi câte bilete a vândut fiecare, iar comisionul se calculează singur și se reține din încasările evenimentului.
        </p>
        <PrForm eventId={event.id} />
        {prView.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-(--radius-card) border border-line bg-surface">
            {prView.map((pr) => (
              <li key={pr.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {pr.name} <span className="text-muted font-normal text-sm">· comision {pr.commissionLabel}</span>
                    {!pr.active ? <span className="text-xs ml-2 text-danger">oprit</span> : null}
                  </p>
                  <p className="text-xs text-muted break-all">{pr.url}</p>
                </div>
                <div className="text-sm text-right tabular">
                  <p>
                    <strong>{pr.seats}</strong> bilete · {formatLei(pr.revenue)}
                  </p>
                  <p className="text-muted">
                    {pr.clicks} clicuri · comision {formatLei(pr.commission)}
                  </p>
                </div>
                <PrToggle eventId={event.id} prId={pr.id} active={pr.active} url={pr.url} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-(--radius-card) border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">Coduri și reduceri</h2>
        <p className="text-sm text-muted mt-1">
          Codurile de reducere, prețurile tăiate, ofertele pe timp limitat și reducerile pe categorii ({promos.length} {promos.length === 1 ? "cod" : "coduri"} acum) s-au mutat în{" "}
          <Link href={`/panou/evenimente/${event.id}/reduceri`} className="text-stamp-deep font-medium hover:underline">
            tab-ul „Reduceri”
          </Link>
          .
        </p>
      </section>

      <section className="rounded-(--radius-card) border border-dashed border-line-strong p-5">
        <h2 className="text-lg font-bold">Promovare plătită</h2>
        <p className="text-sm text-muted mt-1">
          Locuri promovate pe oraș și zonă, mesaje către cei care au mai fost la evenimente asemănătoare și reclame pornite din platformă vin în versiunea următoare. Costul se va reține din încasări, fără card și fără facturi separate.
        </p>
      </section>
    </div>
  );
}
