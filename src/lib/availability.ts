import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { Dbx } from "@/db";
import {
  groups,
  orderItems,
  orders,
  pricePhases,
  ticketTypes,
  waitlistEntries,
  type PricePhase,
  type TicketType,
} from "@/db/schema";

export type TypeAvailability = {
  taken: number; // locuri ocupate (confirmate + ținute)
  soldByPhase: Record<string, number>;
};

export type EventAvailability = {
  byType: Record<string, TypeAvailability>;
  eventTaken: number;
};

// Locurile "ocupate" = bilete din comenzi confirmate sau în așteptarea plății (neexpirate),
// plus locurile ținute de grupuri deschise care nu au fost încă luate,
// plus locurile oferite celor de pe lista de așteptare (până expiră oferta).
export async function computeAvailability(dbx: Dbx, eventId: string, now = new Date()): Promise<EventAvailability> {
  const rows = await dbx
    .select({
      ticketTypeId: orderItems.ticketTypeId,
      pricePhaseId: orderItems.pricePhaseId,
      quantity: sql<number>`sum(${orderItems.quantity})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.eventId, eventId),
        sql`(${orders.status} = 'confirmed' OR (${orders.status} = 'pending' AND ${orders.expiresAt} > ${now.getTime()}))`,
      ),
    )
    .groupBy(orderItems.ticketTypeId, orderItems.pricePhaseId);

  const byType: Record<string, TypeAvailability> = {};
  const bump = (typeId: string, qty: number, phaseId?: string | null) => {
    const t = (byType[typeId] ??= { taken: 0, soldByPhase: {} });
    t.taken += qty;
    if (phaseId) t.soldByPhase[phaseId] = (t.soldByPhase[phaseId] ?? 0) + qty;
  };
  for (const r of rows) bump(r.ticketTypeId, Number(r.quantity), r.pricePhaseId);

  // Grupuri deschise: locurile ținute minus cele deja luate prin grup.
  const openGroups = await dbx
    .select({ id: groups.id, ticketTypeId: groups.ticketTypeId, holdQuantity: groups.holdQuantity })
    .from(groups)
    .where(and(eq(groups.eventId, eventId), eq(groups.status, "open"), gt(groups.holdExpiresAt, now)));
  if (openGroups.length > 0) {
    const claimed = await dbx
      .select({ groupId: orders.groupId, quantity: sql<number>`sum(${orderItems.quantity})` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          inArray(orders.groupId, openGroups.map((g) => g.id)),
          sql`(${orders.status} = 'confirmed' OR (${orders.status} = 'pending' AND ${orders.expiresAt} > ${now.getTime()}))`,
        ),
      )
      .groupBy(orders.groupId);
    const claimedBy = new Map(claimed.map((c) => [c.groupId, Number(c.quantity)]));
    for (const g of openGroups) {
      const free = Math.max(0, g.holdQuantity - (claimedBy.get(g.id) ?? 0));
      if (free > 0) bump(g.ticketTypeId, free);
    }
  }

  // Oferte active din lista de așteptare.
  const offers = await dbx
    .select({ ticketTypeId: waitlistEntries.ticketTypeId, quantity: waitlistEntries.quantity })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.eventId, eventId), eq(waitlistEntries.status, "offered"), gt(waitlistEntries.offerExpiresAt, now)));
  let offeredWithoutType = 0;
  for (const o of offers) {
    if (o.ticketTypeId) bump(o.ticketTypeId, o.quantity);
    else offeredWithoutType += o.quantity;
  }

  const eventTaken = Object.values(byType).reduce((s, t) => s + t.taken, 0) + offeredWithoutType;
  return { byType, eventTaken };
}

export type SaleType = {
  type: TicketType;
  phases: PricePhase[];
  phase: PricePhase | null; // valul activ (sau null dacă nu sunt valuri)
  priceBani: number; // prețul curent al locului
  paidNowBani: number; // cât se plătește online acum
  dueAtDoorBani: number; // cât se plătește la intrare
  remaining: number | null; // null = nelimitat
  onSale: boolean;
  reason?: string; // de ce nu e la vânzare
};

export function pricingFor(type: TicketType, phase: PricePhase | null): Pick<SaleType, "priceBani" | "paidNowBani" | "dueAtDoorBani"> {
  const price = phase ? phase.priceBani : type.priceBani;
  switch (type.mode) {
    case "free":
      return { priceBani: 0, paidNowBani: 0, dueAtDoorBani: 0 };
    case "door":
      return { priceBani: price, paidNowBani: 0, dueAtDoorBani: price };
    case "deposit": {
      const dep = Math.min(type.depositBani, price);
      return { priceBani: price, paidNowBani: dep, dueAtDoorBani: price - dep };
    }
    default:
      return { priceBani: price, paidNowBani: price, dueAtDoorBani: 0 };
  }
}

export function activePhase(phases: PricePhase[], soldByPhase: Record<string, number>, now: Date): PricePhase | null {
  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const p of sorted) {
    if (p.startsAt && p.startsAt.getTime() > now.getTime()) continue;
    if (p.endsAt && p.endsAt.getTime() <= now.getTime()) continue;
    if (p.quantity != null && (soldByPhase[p.id] ?? 0) >= p.quantity) continue;
    return p;
  }
  return null;
}

export async function loadSaleTypes(dbx: Dbx, eventId: string, eventCapacity: number | null, now = new Date()): Promise<{ types: SaleType[]; availability: EventAvailability }> {
  const [types, phases, availability] = await Promise.all([
    dbx.select().from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).orderBy(ticketTypes.sortOrder, ticketTypes.createdAt),
    dbx
      .select()
      .from(pricePhases)
      .innerJoin(ticketTypes, eq(ticketTypes.id, pricePhases.ticketTypeId))
      .where(eq(ticketTypes.eventId, eventId))
      .then((rows) => rows.map((r) => r.price_phases)),
    computeAvailability(dbx, eventId, now),
  ]);

  const eventRemaining = eventCapacity == null ? null : Math.max(0, eventCapacity - availability.eventTaken);

  const result: SaleType[] = types.map((type) => {
    const myPhases = phases.filter((p) => p.ticketTypeId === type.id);
    const av = availability.byType[type.id] ?? { taken: 0, soldByPhase: {} };
    const phase = myPhases.length > 0 ? activePhase(myPhases, av.soldByPhase, now) : null;
    const typeRemaining = type.capacity == null ? null : Math.max(0, type.capacity - av.taken);
    const remaining =
      typeRemaining == null ? eventRemaining : eventRemaining == null ? typeRemaining : Math.min(typeRemaining, eventRemaining);
    let onSale = true;
    let reason: string | undefined;
    if (type.salesStartAt && type.salesStartAt.getTime() > now.getTime()) {
      onSale = false;
      reason = "Vânzarea nu a început";
    } else if (type.salesEndAt && type.salesEndAt.getTime() <= now.getTime()) {
      onSale = false;
      reason = "Vânzarea s-a încheiat";
    } else if (myPhases.length > 0 && !phase) {
      onSale = false;
      reason = "Epuizat";
    } else if (remaining != null && remaining <= 0) {
      onSale = false;
      reason = "Epuizat";
    }
    return { type, phases: myPhases, phase, ...pricingFor(type, phase), remaining, onSale, reason };
  });

  return { types: result, availability };
}
