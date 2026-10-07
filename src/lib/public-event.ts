import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { discounts, events, groups, orderItems, orders, organizers, prLinks, promoCodes, venues, type Discount, type Venue } from "@/db/schema";
import { loadSaleTypes, type SaleType } from "./availability";
import { eventDemand } from "./catalog";
import { isTimedLive } from "./discounts";
import { effectiveFeeBearer, effectiveSettings, expireStale, type ResolvedSettings } from "./orders";
import type { HeatLevel } from "./taxonomy";
import { getActiveOffer } from "./waitlist";

export type PublicPromo = { code: string; type: "percent" | "fixed"; value: number };

export type PublicEvent = {
  event: typeof events.$inferSelect;
  organizer: typeof organizers.$inferSelect;
  venue: Venue | null;
  types: SaleType[];
  settings: ResolvedSettings;
  feeBearer: "buyer" | "organizer";
  feeBps: number;
  group: (typeof groups.$inferSelect & { claimed: number; free: number }) | null;
  offer: { token: string; quantity: number; ticketTypeId: string | null; expiresAt: Date } | null;
  prCode: string | null;
  accent: string;
  rules: Discount[]; // reducerile active acum (grup, ofertă pe timp limitat, categorii de oameni)
  publicPromos: PublicPromo[]; // codurile pe care organizatorul le afișează public
  demand: { heat: HeatLevel; seats48h: number; taken: number; occupancy: number | null };
};

export async function loadPublicEvent(opts: { slug?: string; groupCode?: string; prCode?: string | null; offerToken?: string | null }): Promise<PublicEvent | null> {
  const now = new Date();
  let group: typeof groups.$inferSelect | null = null;
  let eventRow: typeof events.$inferSelect | undefined;

  if (opts.groupCode) {
    const [g] = await db.select().from(groups).where(eq(groups.code, opts.groupCode)).limit(1);
    if (!g) return null;
    group = g;
    [eventRow] = await db.select().from(events).where(eq(events.id, g.eventId)).limit(1);
  } else if (opts.slug) {
    [eventRow] = await db.select().from(events).where(eq(events.slug, opts.slug)).limit(1);
  }
  if (!eventRow) return null;
  const event = eventRow;

  await expireStale(event.id);
  const [organizer] = await db.select().from(organizers).where(eq(organizers.id, event.organizerId)).limit(1);
  if (!organizer) return null;

  const [{ types }, settings, venue, rulesAll, promos, demand] = await Promise.all([
    loadSaleTypes(db, event.id, event.capacity, now),
    Promise.resolve(effectiveSettings(event)),
    event.venueId
      ? db
          .select()
          .from(venues)
          .where(eq(venues.id, event.venueId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select().from(discounts).where(and(eq(discounts.eventId, event.id), eq(discounts.active, true))),
    db
      .select({ code: promoCodes.code, type: promoCodes.type, value: promoCodes.value })
      .from(promoCodes)
      .where(and(eq(promoCodes.eventId, event.id), eq(promoCodes.active, true), eq(promoCodes.isPublic, true), sql`(${promoCodes.maxUses} is null or ${promoCodes.uses} < ${promoCodes.maxUses})`)),
    eventDemand(event.id, event.capacity),
  ]);
  const rules = rulesAll.filter((r) => isTimedLive(r, now));

  let groupView: PublicEvent["group"] = null;
  if (group) {
    const [row] = await db
      .select({ quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.groupId, group.id), sql`(${orders.status} = 'confirmed' OR (${orders.status} = 'pending' AND ${orders.expiresAt} > ${now.getTime()}))`));
    const claimed = Number(row?.quantity ?? 0);
    groupView = { ...group, claimed, free: Math.max(0, group.holdQuantity - claimed) };
  }

  let offer: PublicEvent["offer"] = null;
  if (opts.offerToken) {
    const entry = await getActiveOffer(opts.offerToken);
    if (entry && entry.eventId === event.id && entry.offerExpiresAt) {
      offer = { token: opts.offerToken, quantity: entry.quantity, ticketTypeId: entry.ticketTypeId, expiresAt: entry.offerExpiresAt };
    }
  }

  let prCode: string | null = null;
  if (opts.prCode) {
    const [pr] = await db.select({ id: prLinks.id, code: prLinks.code }).from(prLinks).where(and(eq(prLinks.code, opts.prCode), eq(prLinks.eventId, event.id), eq(prLinks.active, true))).limit(1);
    if (pr) {
      prCode = pr.code;
      await db.update(prLinks).set({ clicks: sql`${prLinks.clicks} + 1` }).where(eq(prLinks.id, pr.id));
    }
  }

  return {
    event,
    organizer,
    venue,
    types,
    settings,
    feeBearer: effectiveFeeBearer(event, organizer),
    feeBps: organizer.feeBps,
    group: groupView,
    offer,
    prCode,
    accent: event.theme?.accent ?? organizer.brand?.accent ?? "#8A3DFF",
    rules,
    publicPromos: promos,
    demand,
  };
}
