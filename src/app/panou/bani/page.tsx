import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, ledgerEntries, payouts } from "@/db/schema";
import { requireOrganizer } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { PageTitle, Stat } from "@/components/ui";

export const metadata = { title: "Bani" };

const typeLabel: Record<string, string> = {
  sale: "Încasare",
  platform_fee: "Comision Ticketeanu",
  refund: "Rambursare",
  payout: "Virament către tine",
  pr_commission: "Comision PR",
  promo: "Promovare",
  adjustment: "Corecție",
};

export default async function MoneyPage() {
  const { organizer } = await requireOrganizer("/panou/bani");
  const [balanceRow] = await db
    .select({ balance: sql<number>`coalesce(sum(${ledgerEntries.amountBani}), 0)` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.organizerId, organizer.id));
  const [totals] = await db
    .select({
      sales: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'sale' then ${ledgerEntries.amountBani} else 0 end), 0)`,
      fees: sql<number>`coalesce(sum(case when ${ledgerEntries.type} in ('platform_fee','pr_commission','promo') then ${ledgerEntries.amountBani} else 0 end), 0)`,
      refunds: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'refund' then ${ledgerEntries.amountBani} else 0 end), 0)`,
      paid: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'payout' then ${ledgerEntries.amountBani} else 0 end), 0)`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.organizerId, organizer.id));
  const entries = await db
    .select({ entry: ledgerEntries, eventTitle: events.title })
    .from(ledgerEntries)
    .leftJoin(events, eq(events.id, ledgerEntries.eventId))
    .where(eq(ledgerEntries.organizerId, organizer.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(200);
  const pending = await db.select().from(payouts).where(eq(payouts.organizerId, organizer.id)).orderBy(desc(payouts.createdAt)).limit(10);

  const balance = Number(balanceRow?.balance ?? 0);

  return (
    <>
      <PageTitle sub="Extrasul tău, la zi. Banii se virează după fiecare eveniment, în IBAN-ul din profil.">Bani</PageTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Sold de virat" value={formatLei(balance)} hint={organizer.iban ? `către ${organizer.iban.slice(0, 8)}…` : "adaugă IBAN-ul în profil"} />
        <Stat label="Încasări" value={formatLei(Number(totals?.sales ?? 0))} hint="din bilete plătite online" />
        <Stat label="Comisioane" value={formatLei(Math.abs(Number(totals?.fees ?? 0)))} hint="Ticketeanu, PR, promovare" />
        <Stat label="Rambursări" value={formatLei(Math.abs(Number(totals?.refunds ?? 0)))} />
      </div>

      {pending.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-muted font-semibold mb-2">Viramente</h2>
          <ul className="divide-y divide-line rounded-(--radius-card) border border-line bg-surface text-sm">
            {pending.map((p) => (
              <li key={p.id} className="px-4 py-2.5 flex justify-between">
                <span>
                  {formatDateTime(p.createdAt)} · {p.status === "paid" ? "virat" : p.status === "requested" ? "în lucru" : "anulat"}
                </span>
                <span className="font-semibold tabular">{formatLei(p.amountBani)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm uppercase tracking-wider text-muted font-semibold mb-2">Mișcări</h2>
        {entries.length === 0 ? (
          <p className="text-muted text-sm">Nicio mișcare încă. Prima vânzare online apare aici imediat.</p>
        ) : (
          <ul className="divide-y divide-line rounded-(--radius-card) border border-line bg-surface text-sm">
            {entries.map(({ entry, eventTitle }) => (
              <li key={entry.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {typeLabel[entry.type] ?? entry.type}
                    {eventTitle ? <span className="text-muted font-normal"> · {eventTitle}</span> : null}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {entry.description} · {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                <span className={`font-semibold tabular ${entry.amountBani < 0 ? "text-danger" : "text-ok"}`}>
                  {entry.amountBani < 0 ? "−" : "+"}
                  {formatLei(Math.abs(entry.amountBani))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
