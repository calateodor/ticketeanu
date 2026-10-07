import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, tickets } from "@/db/schema";
import { requireEventAccess } from "@/lib/panel";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, ctx: RouteContext<"/panou/evenimente/[id]/participanti/export">) {
  const { id } = await ctx.params;
  const { event } = await requireEventAccess(id);
  const rows = await db
    .select({ order: orders, item: orderItems, ticket: tickets })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(tickets.eventId, event.id))
    .orderBy(desc(orders.createdAt));

  const seen = new Set<string>();
  const lines = [
    ["Nume", "E-mail", "Telefon", "Comanda", "Bilet", "Tip", "Stare comanda", "Stare bilet", "Platit online (lei)", "De platit la intrare (lei)", "Acord marketing", "Creat la"].join(";"),
  ];
  for (const r of rows) {
    if (seen.has(r.ticket.id) || r.item.ticketTypeId !== r.ticket.ticketTypeId) continue;
    seen.add(r.ticket.id);
    lines.push(
      [
        r.ticket.holderName ?? r.order.buyerName,
        r.order.buyerEmail,
        r.order.buyerPhone,
        r.order.code,
        r.ticket.code,
        r.item.nameSnapshot,
        r.order.status,
        r.ticket.status,
        (r.order.totalBani / 100).toFixed(2),
        (r.order.dueAtDoorBani / 100).toFixed(2),
        r.order.marketingConsent ? "da" : "nu",
        r.order.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  const body = "﻿" + lines.join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participanti-${event.slug}.csv"`,
    },
  });
}
