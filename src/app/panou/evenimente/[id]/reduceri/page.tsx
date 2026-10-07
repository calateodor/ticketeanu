import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { discounts, promoCodes, ticketTypes } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { discountValueLabel, isTimedLive } from "@/lib/discounts";
import { formatLei } from "@/lib/money";
import { requireEventAccess } from "@/lib/panel";
import { Badge } from "@/components/ui";
import { PromoForm, PromoToggle } from "../promovare/promo-forms";
import { DiscountActions, DiscountForm, PromoPublicToggle } from "./discount-forms";

const kindLabel = { audience: "Categorie de oameni", group: "Grup", timed: "Pe timp limitat" } as const;

export default async function DiscountsPage({ params }: PageProps<"/panou/evenimente/[id]/reduceri">) {
  const { id } = await params;
  const { event } = await requireEventAccess(id);
  const [rules, promos, types] = await Promise.all([
    db.select().from(discounts).where(eq(discounts.eventId, event.id)).orderBy(desc(discounts.createdAt)),
    db.select().from(promoCodes).where(eq(promoCodes.eventId, event.id)).orderBy(desc(promoCodes.createdAt)),
    db.select().from(ticketTypes).where(eq(ticketTypes.eventId, event.id)),
  ]);
  const now = new Date();
  const struck = types.filter((t) => t.compareAtBani && t.compareAtBani > t.priceBani);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-bold">Preț tăiat</h2>
        <p className="text-sm text-muted mb-3">
          La fiecare tip de bilet poți pune un „preț întreg”: apare tăiat lângă prețul de acum, cu „-X%”, iar evenimentul intră la „Reduceri” pe hartă. Se setează din tab-ul „Bilete”.
        </p>
        {struck.length > 0 ? (
          <ul className="divide-y divide-line rounded-(--radius-card) border border-line bg-surface text-sm">
            {struck.map((t) => (
              <li key={t.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="font-semibold">{t.name}</span>
                <span className="tabular">
                  <s className="text-muted">{formatLei(t.compareAtBani!)}</s> {formatLei(t.priceBani)} <Badge tone="warn">-{Math.round(((t.compareAtBani! - t.priceBani) * 100) / t.compareAtBani!)}%</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Niciun bilet cu preț tăiat încă.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">Reduceri fără cod</h2>
        <p className="text-sm text-muted mb-4">
          Grup (de la N locuri într-o comandă), ofertă pe timp limitat (cu numărătoare inversă pe pagină) sau categorie de oameni (studenți, fete până la o oră), pe care cumpărătorul o bifează și o dovedește la intrare. Nu se cumulează: pe o comandă se aplică cea mai mare.
        </p>
        <DiscountForm eventId={event.id} />
        {rules.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-(--radius-card) border border-line bg-surface">
            {rules.map((r) => {
              const live = r.active && isTimedLive(r, now);
              return (
                <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {r.label} <span className="font-extrabold">{discountValueLabel(r)}</span>
                      <Badge tone={live ? "ok" : "neutral"} className="ml-2">
                        {!r.active ? "oprită" : live ? "activă" : r.startsAt && r.startsAt > now ? "urmează" : "expirată"}
                      </Badge>
                    </p>
                    <p className="text-sm text-muted">
                      {kindLabel[r.kind]}
                      {r.kind === "group" ? ` · de la ${r.minQuantity} locuri` : ""}
                      {r.kind === "timed" ? ` · ${r.startsAt ? `din ${formatDateTime(r.startsAt)} ` : ""}până la ${r.endsAt ? formatDateTime(r.endsAt) : "—"}` : ""}
                      {r.kind === "audience" && r.proofHint ? ` · la intrare arată ${r.proofHint}` : ""}
                    </p>
                  </div>
                  <DiscountActions eventId={event.id} discountId={r.id} active={r.active} />
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-bold">Coduri de reducere</h2>
        <p className="text-sm text-muted mb-4">Pentru liste de prieteni, parteneri sau early access. Un cod „public” apare pe pagina evenimentului, gata de apăsat.</p>
        <PromoForm eventId={event.id} />
        {promos.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-(--radius-card) border border-line bg-surface">
            {promos.map((p) => (
              <li key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold">
                    {p.code}
                    {p.isPublic ? <Badge tone="stamp" className="ml-2 font-sans">public</Badge> : null}
                    {!p.active ? <Badge tone="danger" className="ml-2 font-sans">oprit</Badge> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {p.type === "percent" ? `${p.value}% reducere` : `${formatLei(p.value)} reducere`} · folosit de {p.uses} ori{p.maxUses ? ` din ${p.maxUses}` : ""}
                  </p>
                </div>
                <PromoPublicToggle eventId={event.id} promoId={p.id} isPublic={p.isPublic} />
                <PromoToggle eventId={event.id} promoId={p.id} active={p.active} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
