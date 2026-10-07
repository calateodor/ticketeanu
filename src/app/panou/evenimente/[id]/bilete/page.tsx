import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pricePhases, ticketTypes } from "@/db/schema";
import { loadSaleTypes } from "@/lib/availability";
import { requireEventAccess } from "@/lib/panel";
import { TicketTypeEditor } from "./ticket-type-editor";

export default async function TicketsPage({ params }: PageProps<"/panou/evenimente/[id]/bilete">) {
  const { id } = await params;
  const { event, organizer } = await requireEventAccess(id);
  const [types, phases, sale] = await Promise.all([
    db.select().from(ticketTypes).where(eq(ticketTypes.eventId, event.id)).orderBy(ticketTypes.sortOrder, ticketTypes.createdAt),
    db
      .select()
      .from(pricePhases)
      .innerJoin(ticketTypes, eq(ticketTypes.id, pricePhases.ticketTypeId))
      .where(eq(ticketTypes.eventId, event.id))
      .orderBy(pricePhases.sortOrder)
      .then((rows) => rows.map((r) => r.price_phases)),
    loadSaleTypes(db, event.id, event.capacity),
  ]);
  const takenByType = Object.fromEntries(Object.entries(sale.availability.byType).map(([k, v]) => [k, v.taken]));
  const soldByPhase: Record<string, number> = {};
  for (const v of Object.values(sale.availability.byType)) for (const [pid, n] of Object.entries(v.soldByPhase)) soldByPhase[pid] = n;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Tipurile de bilete</h2>
        <p className="text-sm text-muted">
          Fiecare tip e o opțiune de pe listă: gratuit, cu plata la intrare, cu avans sau plătit integral online. Comisionul Ticketeanu ({organizer.feeBps / 100}%) se aplică doar la ce se plătește online.
        </p>
      </div>
      <TicketTypeEditor eventId={event.id} types={types} phases={phases} takenByType={takenByType} soldByPhase={soldByPhase} />
    </div>
  );
}
