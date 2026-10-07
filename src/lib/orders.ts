import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, type Dbx } from "@/db";
import {
  discounts,
  events,
  groups,
  ledgerEntries,
  orderItems,
  orders,
  organizers,
  payments,
  prLinks,
  promoCodes,
  tickets,
  waitlistEntries,
  type Event,
  type EventSettings,
  type Organizer,
  type Order,
  type PromoCode,
} from "@/db/schema";
import { computeAvailability, loadSaleTypes, type SaleType } from "./availability";
import { addHours, addMinutes, formatDay, formatTime } from "./dates";
import { isTimedLive, pickDiscount } from "./discounts";
import { newId, secureToken, shortCode } from "./ids";
import { renderEmail, sendMail, siteUrl } from "./mail";
import { calcFee, formatLei } from "./money";
import { getPaymentProvider } from "./payments";
import { offerSeatsToWaitlist } from "./waitlist";

export class OrderError extends Error {
  constructor(
    message: string,
    public code: string = "order_error",
  ) {
    super(message);
  }
}

export type CreateOrderInput = {
  eventId: string;
  items: { ticketTypeId: string; quantity: number }[];
  buyer: { name: string; email?: string | null; phone?: string | null };
  promoCode?: string | null;
  discountId?: string | null; // reducerea pe categorie aleasă de cumpărător (studenți etc.)
  prCode?: string | null;
  groupCode?: string | null; // mă alătur unui grup existent
  createGroup?: { name: string; size: number } | null; // fac eu un grup și țin locuri pentru gașcă
  waitlistToken?: string | null;
  marketingConsent?: boolean;
  source?: "direct" | "ticketeanu" | "pr";
};

export type CreateOrderResult = {
  orderId: string;
  code: string;
  manageToken: string;
  requiresPayment: boolean;
  redirectUrl: string; // unde trimitem cumpărătorul (plată sau confirmare)
  groupCode?: string;
};

export type ResolvedSettings = EventSettings & {
  holdMinutes: number;
  groupEnabled: boolean;
  groupHoldHours: number;
  waitlistEnabled: boolean;
  askPhone: boolean;
};

export function effectiveSettings(event: Event): ResolvedSettings {
  const s = event.settings ?? {};
  return {
    ...s,
    holdMinutes: s.holdMinutes ?? 15,
    groupEnabled: s.groupEnabled ?? true,
    groupHoldHours: s.groupHoldHours ?? 48,
    waitlistEnabled: s.waitlistEnabled ?? true,
    askPhone: s.askPhone ?? true,
  };
}

export function effectiveFeeBearer(event: Event, organizer: Organizer): "buyer" | "organizer" {
  return event.settings?.feeBearer ?? organizer.feeBearer;
}

export async function getEventWithOrganizer(dbx: Dbx, eventId: string) {
  const [row] = await dbx
    .select({ event: events, organizer: organizers })
    .from(events)
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(eq(events.id, eventId))
    .limit(1);
  return row ?? null;
}

function discountFor(promo: PromoCode, subtotalBani: number): number {
  if (promo.type === "percent") return Math.round((subtotalBani * promo.value) / 100);
  return Math.min(promo.value, subtotalBani);
}

export async function validatePromo(dbx: Dbx, eventId: string, codeRaw: string, now = new Date()): Promise<PromoCode | null> {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return null;
  const [promo] = await dbx
    .select()
    .from(promoCodes)
    .where(and(eq(promoCodes.eventId, eventId), eq(promoCodes.code, code), eq(promoCodes.active, true)))
    .limit(1);
  if (!promo) return null;
  if (promo.startsAt && promo.startsAt.getTime() > now.getTime()) return null;
  if (promo.endsAt && promo.endsAt.getTime() <= now.getTime()) return null;
  if (promo.maxUses != null && promo.uses >= promo.maxUses) return null;
  return promo;
}

const liveOrderCondition = (now: Date) =>
  sql`(${orders.status} = 'confirmed' OR (${orders.status} = 'pending' AND ${orders.expiresAt} > ${now.getTime()}))`;

// ---------- Crearea unei comenzi (o intrare pe listă) ----------

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const now = new Date();
  const buyerName = input.buyer.name.trim();
  const buyerEmail = input.buyer.email?.trim().toLowerCase() || null;
  const buyerPhone = input.buyer.phone?.trim() || null;
  if (buyerName.length < 2) throw new OrderError("Scrie numele tău.", "buyer_name");
  if (!buyerEmail && !buyerPhone) throw new OrderError("Lasă un e-mail sau un telefon ca să-ți trimitem biletul.", "buyer_contact");
  if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) throw new OrderError("Adresa de e-mail nu arată bine.", "buyer_email");

  const wanted = input.items.filter((i) => i.quantity > 0);
  if (wanted.length === 0) throw new OrderError("Alege cel puțin un loc.", "no_items");

  const created = await db.transaction(async (tx) => {
    const ctx = await getEventWithOrganizer(tx, input.eventId);
    if (!ctx) throw new OrderError("Evenimentul nu există.", "event_missing");
    const { event, organizer } = ctx;
    if (event.status !== "published") throw new OrderError("Evenimentul nu e deschis pentru rezervări.", "event_closed");
    const endsAt = event.endsAt ?? addHours(event.startsAt, 6);
    if (endsAt.getTime() < now.getTime()) throw new OrderError("Evenimentul a trecut.", "event_past");
    const settings = effectiveSettings(event);

    const { types } = await loadSaleTypes(tx, event.id, event.capacity, now);
    const byId = new Map(types.map((t) => [t.type.id, t]));

    // Ofertă din lista de așteptare: locurile oferite sunt deja socotite ocupate, le punem la loc.
    if (input.waitlistToken) {
      const [offer] = await tx.select().from(waitlistEntries).where(eq(waitlistEntries.offerToken, input.waitlistToken)).limit(1);
      if (!offer || offer.eventId !== event.id || offer.status !== "offered" || !offer.offerExpiresAt || offer.offerExpiresAt.getTime() < now.getTime()) {
        throw new OrderError("Oferta de pe lista de așteptare a expirat.", "offer_expired");
      }
      for (const t of types) {
        if (offer.ticketTypeId && t.type.id !== offer.ticketTypeId) continue;
        if (t.remaining != null) t.remaining += offer.quantity;
        if (t.reason === "Epuizat" && t.remaining !== 0 && !(t.phases.length > 0 && !t.phase)) {
          t.onSale = true;
          t.reason = undefined;
        }
      }
    }

    // Grup existent?
    let group: typeof groups.$inferSelect | null = null;
    if (input.groupCode) {
      const [g] = await tx.select().from(groups).where(eq(groups.code, input.groupCode)).limit(1);
      if (!g || g.eventId !== event.id) throw new OrderError("Linkul grupului nu e valid.", "group_missing");
      if (g.status !== "open" || g.holdExpiresAt.getTime() <= now.getTime()) {
        throw new OrderError("Grupul s-a închis. Locurile ținute au fost eliberate.", "group_closed");
      }
      group = g;
    }

    // Validăm fiecare rând.
    const lines: { sale: SaleType; quantity: number }[] = [];
    for (const item of wanted) {
      const sale = byId.get(item.ticketTypeId);
      if (!sale) throw new OrderError("Unul dintre bilete nu mai există.", "type_missing");
      if (group && sale.type.id !== group.ticketTypeId) {
        throw new OrderError("Prin linkul grupului poți lua doar locurile ținute de grup.", "group_type");
      }
      if (!sale.onSale && !group) throw new OrderError(`${sale.type.name}: ${sale.reason ?? "nu e la vânzare"}.`, "not_on_sale");
      if (item.quantity < sale.type.minPerOrder || item.quantity > sale.type.maxPerOrder) {
        throw new OrderError(`${sale.type.name}: poți lua între ${sale.type.minPerOrder} și ${sale.type.maxPerOrder} locuri.`, "quantity");
      }
      if (!group && sale.remaining != null && item.quantity > sale.remaining) {
        throw new OrderError(
          sale.remaining === 0 ? `${sale.type.name}: s-a epuizat.` : `${sale.type.name}: mai sunt doar ${sale.remaining} locuri.`,
          "sold_out",
        );
      }
      lines.push({ sale, quantity: item.quantity });
    }

    // Grup existent: verificăm că mai sunt locuri ținute.
    if (group) {
      const [claimedRow] = await tx
        .select({ quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(eq(orders.groupId, group.id), liveOrderCondition(now)));
      const claimed = Number(claimedRow?.quantity ?? 0);
      const free = group.holdQuantity - claimed;
      const asked = lines.reduce((s, l) => s + l.quantity, 0);
      if (asked > free) {
        throw new OrderError(free <= 0 ? "Toate locurile grupului au fost luate." : `Grupul mai are doar ${free} locuri.`, "group_full");
      }
    }

    // Grup nou: avem nevoie de locuri și pentru prieteni.
    let newGroupSize = 0;
    if (input.createGroup && !group) {
      if (!settings.groupEnabled) throw new OrderError("Evenimentul nu are rezervare de grup.", "group_disabled");
      if (lines.length !== 1) throw new OrderError("Un grup se face pe un singur tip de loc.", "group_single_type");
      const size = Math.floor(input.createGroup.size);
      const own = lines[0].quantity;
      if (size <= own) throw new OrderError("Gașca trebuie să aibă mai multe locuri decât iei tu acum.", "group_size");
      if (size > 30) throw new OrderError("Un grup poate ține cel mult 30 de locuri.", "group_size");
      const sale = lines[0].sale;
      if (sale.remaining != null && size > sale.remaining) {
        throw new OrderError(`Mai sunt doar ${sale.remaining} locuri; gașca nu încape toată.`, "group_capacity");
      }
      newGroupSize = size;
    }

    // Prețuri.
    let subtotal = 0;
    let dueAtDoor = 0;
    for (const l of lines) {
      subtotal += l.sale.paidNowBani * l.quantity;
      dueAtDoor += l.sale.dueAtDoorBani * l.quantity;
    }

    // Reduceri fără cod (grup, ofertă pe timp limitat, categorie de oameni) și codul promo.
    // Nu se cumulează: se aplică cea mai mare.
    const rulesAll = await tx.select().from(discounts).where(and(eq(discounts.eventId, event.id), eq(discounts.active, true)));
    if (input.discountId && !rulesAll.some((r) => r.id === input.discountId && r.kind === "audience" && isTimedLive(r, now))) {
      throw new OrderError("Reducerea aleasă nu mai e disponibilă.", "discount");
    }
    const applied = pickDiscount({
      rules: rulesAll,
      lines: lines.map((l) => ({ paidNowBani: l.sale.paidNowBani, dueAtDoorBani: l.sale.dueAtDoorBani, quantity: l.quantity })),
      chosenAudienceId: input.discountId ?? null,
      now,
    });

    let promo: PromoCode | null = null;
    let promoDiscount = 0;
    if (input.promoCode) {
      promo = await validatePromo(tx, event.id, input.promoCode, now);
      if (!promo) throw new OrderError("Codul de reducere nu e valid.", "promo");
      promoDiscount = discountFor(promo, subtotal);
    }

    let discount = 0;
    let discountId: string | null = null;
    let discountNote: string | null = null;
    if (applied && applied.onlineBani + applied.doorBani >= promoDiscount) {
      discount = applied.onlineBani;
      dueAtDoor = Math.max(0, dueAtDoor - applied.doorBani);
      discountId = applied.rule.id;
      discountNote = applied.note;
      promo = null;
    } else {
      discount = promoDiscount;
    }
    const net = Math.max(0, subtotal - discount);
    const feeBearer = effectiveFeeBearer(event, organizer);
    const fee = calcFee(net, organizer.feeBps);
    const total = feeBearer === "buyer" ? net + fee : net;

    let prLinkId: string | null = null;
    let source: "direct" | "ticketeanu" | "pr" = input.source ?? "direct";
    if (input.prCode) {
      const [pr] = await tx
        .select()
        .from(prLinks)
        .where(and(eq(prLinks.code, input.prCode), eq(prLinks.eventId, event.id), eq(prLinks.active, true)))
        .limit(1);
      if (pr) {
        prLinkId = pr.id;
        source = "pr";
      }
    }

    const requiresPayment = total > 0;
    const orderId = newId();
    const code = shortCode(8);
    const manageToken = secureToken(24);
    const expiresAt = requiresPayment ? addMinutes(now, settings.holdMinutes) : null;

    let groupId: string | null = group?.id ?? null;
    let groupCode: string | undefined = group?.code;
    if (newGroupSize > 0) {
      groupId = newId();
      groupCode = shortCode(8);
      const holdExpiresAt = new Date(Math.min(addHours(now, settings.groupHoldHours).getTime(), event.startsAt.getTime()));
      await tx.insert(groups).values({
        id: groupId,
        code: groupCode,
        eventId: event.id,
        ticketTypeId: lines[0].sale.type.id,
        name: input.createGroup!.name.trim() || `Gașca lui ${buyerName.split(" ")[0]}`,
        leaderName: buyerName,
        leaderEmail: buyerEmail,
        leaderOrderId: orderId,
        holdQuantity: newGroupSize,
        holdExpiresAt,
        status: "open",
      });
    }

    await tx.insert(orders).values({
      id: orderId,
      code,
      eventId: event.id,
      organizerId: organizer.id,
      status: requiresPayment ? "pending" : "confirmed",
      buyerName,
      buyerEmail,
      buyerPhone,
      subtotalBani: subtotal,
      discountBani: discount,
      feeBani: fee,
      totalBani: total,
      dueAtDoorBani: dueAtDoor,
      feeBearer,
      promoCodeId: promo?.id ?? null,
      discountId,
      discountNote,
      prLinkId,
      source,
      groupId,
      expiresAt,
      confirmedAt: requiresPayment ? null : now,
      marketingConsent: input.marketingConsent ?? false,
      manageToken,
    });

    for (const l of lines) {
      await tx.insert(orderItems).values({
        id: newId(),
        orderId,
        ticketTypeId: l.sale.type.id,
        pricePhaseId: l.sale.phase?.id ?? null,
        nameSnapshot: l.sale.phase ? `${l.sale.type.name} · ${l.sale.phase.name}` : l.sale.type.name,
        quantity: l.quantity,
        unitPriceBani: l.sale.priceBani,
        unitPaidNowBani: l.sale.paidNowBani,
        unitDueAtDoorBani: l.sale.dueAtDoorBani,
      });
      for (let i = 0; i < l.quantity; i++) {
        await tx.insert(tickets).values({
          id: newId(),
          code: shortCode(10),
          orderId,
          eventId: event.id,
          ticketTypeId: l.sale.type.id,
          holderName: i === 0 ? buyerName : null,
          status: "valid",
        });
      }
    }

    if (input.waitlistToken) {
      await tx
        .update(waitlistEntries)
        .set({ status: "claimed" })
        .where(and(eq(waitlistEntries.offerToken, input.waitlistToken), eq(waitlistEntries.status, "offered")));
    }

    let confirmed: Order | null = null;
    if (!requiresPayment) confirmed = await writeConfirmation(tx, orderId);

    return { orderId, code, manageToken, requiresPayment, groupCode, total, eventTitle: event.title, confirmed };
  });

  // Efecte după commit: e-mailuri, pagina de plată.
  if (created.confirmed) await sendOrderConfirmation(created.confirmed);

  if (!created.requiresPayment) {
    return {
      orderId: created.orderId,
      code: created.code,
      manageToken: created.manageToken,
      requiresPayment: false,
      redirectUrl: `/comanda/${created.manageToken}?nou=1`,
      groupCode: created.groupCode,
    };
  }

  const checkout = await getPaymentProvider().createCheckout({
    orderId: created.orderId,
    orderCode: created.code,
    amountBani: created.total,
    description: `${created.eventTitle} · comanda ${created.code}`,
    buyerEmail,
    buyerName,
  });
  return {
    orderId: created.orderId,
    code: created.code,
    manageToken: created.manageToken,
    requiresPayment: true,
    redirectUrl: checkout.redirectUrl,
    groupCode: created.groupCode,
  };
}

// ---------- Confirmare ----------

// Scrie în registru (doar baza de date). Se apelează o singură dată per comandă.
async function writeConfirmation(tx: Dbx, orderId: string): Promise<Order | null> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const net = Math.max(0, order.subtotalBani - order.discountBani);

  if (net > 0) {
    await tx.insert(ledgerEntries).values({
      id: newId(),
      organizerId: order.organizerId,
      eventId: order.eventId,
      orderId: order.id,
      type: "sale",
      amountBani: net,
      description: `Comanda ${order.code}`,
    });
    if (order.feeBearer === "organizer" && order.feeBani > 0) {
      await tx.insert(ledgerEntries).values({
        id: newId(),
        organizerId: order.organizerId,
        eventId: order.eventId,
        orderId: order.id,
        type: "platform_fee",
        amountBani: -order.feeBani,
        description: `Comision Ticketeanu · comanda ${order.code}`,
      });
    }
    if (order.prLinkId) {
      const [pr] = await tx.select().from(prLinks).where(eq(prLinks.id, order.prLinkId)).limit(1);
      if (pr && pr.commissionValue > 0) {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const qty = items.reduce((s, i) => s + i.quantity, 0);
        const commission =
          pr.commissionType === "percent" ? Math.round((net * pr.commissionValue) / 100) : pr.commissionValue * qty;
        if (commission > 0) {
          await tx.insert(ledgerEntries).values({
            id: newId(),
            organizerId: order.organizerId,
            eventId: order.eventId,
            orderId: order.id,
            type: "pr_commission",
            amountBani: -commission,
            description: `Comision PR ${pr.name} · comanda ${order.code}`,
          });
        }
      }
    }
  }
  if (order.promoCodeId) {
    await tx
      .update(promoCodes)
      .set({ uses: sql`${promoCodes.uses} + 1` })
      .where(eq(promoCodes.id, order.promoCodeId));
  }
  return order;
}

export async function markPaymentPaid(
  paymentId: string,
  providerRef?: string,
  raw?: Record<string, unknown>,
): Promise<{ orderManageToken: string } | null> {
  const result = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) return null;
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
    if (!order) return null;
    if (payment.status === "paid") return { token: order.manageToken, confirmed: null as Order | null };

    await tx
      .update(payments)
      .set({ status: "paid", paidAt: new Date(), providerRef: providerRef ?? payment.providerRef, raw: raw ?? payment.raw })
      .where(eq(payments.id, paymentId));

    let confirmed: Order | null = null;
    if (order.status === "pending" || order.status === "expired") {
      // Chiar dacă rezervarea a expirat între timp, plata a venit: o onorăm.
      await tx
        .update(orders)
        .set({ status: "confirmed", confirmedAt: new Date(), expiresAt: null })
        .where(eq(orders.id, order.id));
      await tx.update(tickets).set({ status: "valid" }).where(eq(tickets.orderId, order.id));
      confirmed = await writeConfirmation(tx, order.id);
    }
    return { token: order.manageToken, confirmed };
  });
  if (!result) return null;
  if (result.confirmed) await sendOrderConfirmation(result.confirmed);
  return { orderManageToken: result.token };
}

export async function markPaymentFailed(
  paymentId: string,
  raw?: Record<string, unknown>,
): Promise<{ orderManageToken: string } | null> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) return null;
  if (payment.status === "created") {
    await db.update(payments).set({ status: "failed", raw: raw ?? payment.raw }).where(eq(payments.id, paymentId));
  }
  const [order] = await db.select({ manageToken: orders.manageToken }).from(orders).where(eq(orders.id, payment.orderId)).limit(1);
  return order ? { orderManageToken: order.manageToken } : null;
}

// Reia plata pentru o comandă încă în așteptare.
export async function restartPayment(orderId: string): Promise<string> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new OrderError("Comanda nu există.");
  if (order.status !== "pending") throw new OrderError("Comanda nu mai e în așteptarea plății.");
  if (order.expiresAt && order.expiresAt.getTime() < Date.now()) throw new OrderError("Rezervarea a expirat. Fă una nouă.");
  const [event] = await db.select().from(events).where(eq(events.id, order.eventId)).limit(1);
  const checkout = await getPaymentProvider().createCheckout({
    orderId: order.id,
    orderCode: order.code,
    amountBani: order.totalBani,
    description: `${event?.title ?? "Eveniment"} · comanda ${order.code}`,
    buyerEmail: order.buyerEmail,
    buyerName: order.buyerName,
  });
  return checkout.redirectUrl;
}

// ---------- Anulare și rambursare ----------

export async function cancelOrder(
  orderId: string,
  opts: { by: "buyer" | "organizer" | "system"; reason?: string; refund?: boolean },
): Promise<void> {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new OrderError("Comanda nu există.");
    if (order.status === "cancelled" || order.status === "refunded") return null;

    const wasConfirmed = order.status === "confirmed";
    const net = Math.max(0, order.subtotalBani - order.discountBani);
    let refunded = 0;

    if (wasConfirmed && opts.refund !== false && order.totalBani > 0) {
      const paid = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, "paid")));
      const provider = getPaymentProvider();
      for (const p of paid) {
        const amount = p.amountBani - p.refundedBani;
        if (amount <= 0) continue;
        const res = await provider.refund(p.id, amount);
        if (!res.ok) throw new OrderError(`Rambursarea nu a reușit: ${res.error ?? "eroare la procesator"}`);
        await tx.update(payments).set({ status: "refunded", refundedBani: p.amountBani }).where(eq(payments.id, p.id));
        refunded += amount;
      }
    }

    if (wasConfirmed && net > 0) {
      // Dăm înapoi tot ce a intrat pe comanda asta: vânzarea, comisionul, comisionul PR.
      const entries = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, order.id));
      for (const e of entries) {
        if (e.type === "refund") continue;
        await tx.insert(ledgerEntries).values({
          id: newId(),
          organizerId: e.organizerId,
          eventId: e.eventId,
          orderId: e.orderId,
          type: "refund",
          amountBani: -e.amountBani,
          description: `Anulare · ${e.description ?? order.code}`,
        });
      }
    }

    await tx
      .update(orders)
      .set({
        status: refunded > 0 ? "refunded" : "cancelled",
        cancelledAt: new Date(),
        cancelReason: opts.reason ?? opts.by,
      })
      .where(eq(orders.id, order.id));
    await tx.update(tickets).set({ status: "cancelled" }).where(eq(tickets.orderId, order.id));
    return { order, wasConfirmed, refunded };
  });
  if (!result) return;

  if (result.wasConfirmed) {
    const [event] = await db.select().from(events).where(eq(events.id, result.order.eventId)).limit(1);
    if (event && result.order.buyerEmail) {
      const mail = renderEmail({
        title: result.refunded > 0 ? "Rezervarea a fost anulată și banii se întorc" : "Rezervarea a fost anulată",
        intro: `Comanda ${result.order.code} pentru „${event.title}” a fost anulată${opts.by === "organizer" ? " de organizator" : ""}.`,
        lines:
          result.refunded > 0
            ? [`Îți dăm înapoi ${formatLei(result.refunded)}, cu tot cu comision. Banii ajung pe card în câteva zile lucrătoare.`]
            : [],
      });
      await sendMail({ to: result.order.buyerEmail, subject: `Anulare · ${event.title}`, ...mail, related: { type: "order", id: result.order.id } });
    }
    await offerSeatsToWaitlist(result.order.eventId);
  }
}

// Comenzile neplătite la timp expiră și eliberează locurile; grupurile expirate se închid.
export async function expireStale(eventId?: string): Promise<number> {
  const now = new Date();
  const where = eventId
    ? and(eq(orders.status, "pending"), lt(orders.expiresAt, now), eq(orders.eventId, eventId))
    : and(eq(orders.status, "pending"), lt(orders.expiresAt, now));
  const stale = await db.select({ id: orders.id, eventId: orders.eventId }).from(orders).where(where);
  if (stale.length > 0) {
    const ids = stale.map((s) => s.id);
    await db.update(orders).set({ status: "expired" }).where(inArray(orders.id, ids));
    await db.update(tickets).set({ status: "cancelled" }).where(inArray(tickets.orderId, ids));
  }
  const gwhere = eventId
    ? and(eq(groups.status, "open"), lt(groups.holdExpiresAt, now), eq(groups.eventId, eventId))
    : and(eq(groups.status, "open"), lt(groups.holdExpiresAt, now));
  const expiredGroups = await db.select({ eventId: groups.eventId }).from(groups).where(gwhere);
  await db.update(groups).set({ status: "expired" }).where(gwhere);

  const touched = new Set([...stale.map((s) => s.eventId), ...expiredGroups.map((g) => g.eventId)]);
  for (const id of touched) await offerSeatsToWaitlist(id);
  return stale.length;
}

// ---------- E-mail de confirmare ----------

export async function sendOrderConfirmation(order: Order) {
  if (!order.buyerEmail) return;
  const ctx = await getEventWithOrganizer(db, order.eventId);
  if (!ctx) return;
  const { event, organizer } = ctx;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const qty = items.reduce((s, i) => s + i.quantity, 0);
  const when = `${formatDay(event.startsAt)}, ora ${formatTime(event.startsAt)}`;
  const where = [event.venueName, event.venueAddress, event.city].filter(Boolean).join(", ");

  const lines: string[] = [
    `<strong>${qty === 1 ? "1 loc" : `${qty} locuri`}</strong> · ${items.map((i) => `${i.quantity} × ${i.nameSnapshot}`).join(", ")}`,
    `<strong>Când:</strong> ${when}`,
  ];
  if (where) lines.push(`<strong>Unde:</strong> ${where}`);
  if (order.totalBani > 0) lines.push(`<strong>Plătit online:</strong> ${formatLei(order.totalBani)}`);
  if (order.dueAtDoorBani > 0) lines.push(`<strong>De plătit la intrare:</strong> ${formatLei(order.dueAtDoorBani)}`);
  if (order.discountNote) lines.push(`<strong>Reducere:</strong> ${order.discountNote}`);
  lines.push(`Codul comenzii: <strong>${order.code}</strong>. Biletele au cod QR; le arăți la intrare de pe telefon.`);

  const mail = renderEmail({
    title: `Ai loc la ${event.title}`,
    intro: `Salut, ${order.buyerName.split(" ")[0]}! Rezervarea ta e confirmată.`,
    lines,
    cta: { label: "Vezi biletele", url: siteUrl(`/comanda/${order.manageToken}`) },
    footer: `Organizator: ${organizer.name}. Dacă nu mai poți veni, deschide linkul de mai sus; eliberezi locul pentru altcineva.`,
    accent: event.theme?.accent ?? organizer.brand?.accent,
  });
  await sendMail({ to: order.buyerEmail, subject: `Ai loc la ${event.title} · ${order.code}`, ...mail, related: { type: "order", id: order.id } });
}

// ---------- Citire ----------

export async function getOrderByManageToken(token: string) {
  const [order] = await db.select().from(orders).where(eq(orders.manageToken, token)).limit(1);
  if (!order) return null;
  const [ctx, items, tix, group] = await Promise.all([
    getEventWithOrganizer(db, order.eventId),
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(tickets).where(eq(tickets.orderId, order.id)).orderBy(tickets.createdAt),
    order.groupId
      ? db
          .select()
          .from(groups)
          .where(eq(groups.id, order.groupId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  if (!ctx) return null;
  return { order, event: ctx.event, organizer: ctx.organizer, items, tickets: tix, group };
}

export async function eventStats(eventId: string) {
  const now = new Date();
  const [row] = await db
    .select({
      confirmedOrders: sql<number>`count(distinct case when ${orders.status} = 'confirmed' then ${orders.id} end)`,
      seats: sql<number>`coalesce(sum(case when ${orders.status} = 'confirmed' then ${orderItems.quantity} else 0 end), 0)`,
      paidOnline: sql<number>`coalesce(sum(case when ${orders.status} = 'confirmed' then ${orderItems.unitPaidNowBani} * ${orderItems.quantity} else 0 end), 0)`,
      dueAtDoor: sql<number>`coalesce(sum(case when ${orders.status} = 'confirmed' then ${orderItems.unitDueAtDoorBani} * ${orderItems.quantity} else 0 end), 0)`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.eventId, eventId));
  const [att] = await db
    .select({ arrived: sql<number>`count(*)` })
    .from(tickets)
    .where(and(eq(tickets.eventId, eventId), eq(tickets.status, "used")));
  const availability = await computeAvailability(db, eventId, now);
  return {
    confirmedOrders: Number(row?.confirmedOrders ?? 0),
    seats: Number(row?.seats ?? 0),
    paidOnline: Number(row?.paidOnline ?? 0),
    dueAtDoor: Number(row?.dueAtDoor ?? 0),
    arrived: Number(att?.arrived ?? 0),
    taken: availability.eventTaken,
  };
}
