import "server-only";
import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { doorTokens, events, orders, ticketTypes, tickets } from "@/db/schema";
import { newId, secureToken } from "./ids";

export async function getDoorContext(token: string) {
  const [row] = await db
    .select({ door: doorTokens, event: events })
    .from(doorTokens)
    .innerJoin(events, eq(events.id, doorTokens.eventId))
    .where(and(eq(doorTokens.token, token), isNull(doorTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  return row;
}

export async function createDoorToken(eventId: string, label: string) {
  const id = newId();
  const token = secureToken(16);
  await db.insert(doorTokens).values({ id, eventId, label: label.trim() || "Intrare", token });
  return { id, token };
}

export type CheckInResult =
  | { status: "ok"; ticket: TicketView }
  | { status: "already"; ticket: TicketView }
  | { status: "cancelled"; ticket: TicketView }
  | { status: "wrong_event" }
  | { status: "invalid" };

export type TicketView = {
  id: string;
  code: string;
  holderName: string | null;
  buyerName: string;
  typeName: string;
  orderCode: string;
  status: "valid" | "used" | "cancelled";
  checkedInAt: Date | null;
  checkedInBy: string | null;
  dueAtDoorBani: number; // cât mai are de plătit comanda, în total
  seatsInOrder: number;
  discountNote: string | null; // reducere de verificat la intrare („Studenți · arată legitimația”)
};

async function loadTicket(code: string): Promise<(TicketView & { eventId: string }) | null> {
  const [row] = await db
    .select({
      ticket: tickets,
      order: orders,
      typeName: ticketTypes.name,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, tickets.ticketTypeId))
    .where(eq(tickets.code, code))
    .limit(1);
  if (!row) return null;
  const [cnt] = await db
    .select({ n: sql<number>`count(*)` })
    .from(tickets)
    .where(eq(tickets.orderId, row.order.id));
  return {
    id: row.ticket.id,
    code: row.ticket.code,
    holderName: row.ticket.holderName,
    buyerName: row.order.buyerName,
    typeName: row.typeName,
    orderCode: row.order.code,
    status: row.ticket.status,
    checkedInAt: row.ticket.checkedInAt,
    checkedInBy: row.ticket.checkedInBy,
    dueAtDoorBani: row.order.dueAtDoorBani,
    seatsInOrder: Number(cnt?.n ?? 1),
    discountNote: row.order.discountNote,
    eventId: row.ticket.eventId,
  };
}

// Codul poate veni ca text simplu sau ca URL de bilet (/bilet/COD).
export function extractTicketCode(raw: string): string {
  const s = raw.trim();
  const m = s.match(/\/bilet\/([A-Za-z0-9]+)/);
  return (m ? m[1] : s).toUpperCase();
}

export async function checkIn(doorToken: string, rawCode: string): Promise<CheckInResult> {
  const ctx = await getDoorContext(doorToken);
  if (!ctx) return { status: "invalid" };
  const code = extractTicketCode(rawCode);
  const t = await loadTicket(code);
  if (!t) return { status: "invalid" };
  if (t.eventId !== ctx.event.id) return { status: "wrong_event" };
  if (t.status === "cancelled") return { status: "cancelled", ticket: t };
  if (t.status === "used") return { status: "already", ticket: t };
  const now = new Date();
  await db
    .update(tickets)
    .set({ status: "used", checkedInAt: now, checkedInBy: ctx.door.label })
    .where(and(eq(tickets.id, t.id), eq(tickets.status, "valid")));
  await db.update(doorTokens).set({ lastUsedAt: now }).where(eq(doorTokens.id, ctx.door.id));
  return { status: "ok", ticket: { ...t, status: "used", checkedInAt: now, checkedInBy: ctx.door.label } };
}

export async function undoCheckIn(doorToken: string, ticketId: string): Promise<boolean> {
  const ctx = await getDoorContext(doorToken);
  if (!ctx) return false;
  await db
    .update(tickets)
    .set({ status: "valid", checkedInAt: null, checkedInBy: null })
    .where(and(eq(tickets.id, ticketId), eq(tickets.eventId, ctx.event.id), eq(tickets.status, "used")));
  return true;
}

// Căutare după nume, e-mail, telefon sau cod, pentru când scanarea nu merge.
export async function searchTickets(eventId: string, query: string, limit = 20): Promise<TicketView[]> {
  const q = `%${query.trim()}%`;
  if (query.trim().length < 2) return [];
  const rows = await db
    .select({ ticket: tickets, order: orders, typeName: ticketTypes.name })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, tickets.ticketTypeId))
    .where(
      and(
        eq(tickets.eventId, eventId),
        or(like(orders.buyerName, q), like(orders.buyerEmail, q), like(orders.buyerPhone, q), like(orders.code, q), like(tickets.code, q), like(tickets.holderName, q)),
      ),
    )
    .limit(limit);
  return rows.map((row) => ({
    id: row.ticket.id,
    code: row.ticket.code,
    holderName: row.ticket.holderName,
    buyerName: row.order.buyerName,
    typeName: row.typeName,
    orderCode: row.order.code,
    status: row.ticket.status,
    checkedInAt: row.ticket.checkedInAt,
    checkedInBy: row.ticket.checkedInBy,
    dueAtDoorBani: row.order.dueAtDoorBani,
    seatsInOrder: 0,
    discountNote: row.order.discountNote,
  }));
}

export async function doorStats(eventId: string) {
  const [row] = await db
    .select({
      valid: sql<number>`sum(case when ${tickets.status} = 'valid' then 1 else 0 end)`,
      used: sql<number>`sum(case when ${tickets.status} = 'used' then 1 else 0 end)`,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .where(and(eq(tickets.eventId, eventId), eq(orders.status, "confirmed")));
  return { expected: Number(row?.valid ?? 0) + Number(row?.used ?? 0), arrived: Number(row?.used ?? 0) };
}
