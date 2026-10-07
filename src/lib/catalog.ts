import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, organizers, venues, type Event } from "@/db/schema";
import type { CatalogItem } from "./catalog-types";
import { heatLevel, type HeatLevel } from "./taxonomy";

export type CatalogVenue = { id: string; slug: string; name: string; address: string | null; city: string | null; lat: number; lng: number };

export type CatalogEvent = {
  event: Event;
  organizerName: string;
  organizerSlug: string;
  venue: CatalogVenue | null;
  minPrice: number | null;
  discountPct: number | null; // cea mai mare reducere vizibilă, în procente (preț tăiat sau regulă procentuală activă)
  hasDiscount: boolean; // există vreo reducere activă (inclusiv sume fixe sau coduri publice)
  seats48h: number; // locuri luate în ultimele 48 de ore
  taken: number; // locuri confirmate
  occupancy: number | null; // taken / capacitate
  heat: HeatLevel;
};

export type CatalogFilter = {
  city?: string | null;
  organizerId?: string | null;
  venueId?: string | null;
  category?: string | null;
  vibe?: string | null;
  discounted?: boolean;
  limit?: number;
};

// Subinterogările sunt scrise explicit: într-un select cu join, Drizzle nu prefixează
// coloanele din subinterogări, așa că folosim "events"."id" direct.
export async function listPublicEvents(opts: CatalogFilter = {}): Promise<CatalogEvent[]> {
  const nowMs = Date.now();
  const since = new Date(nowMs - 6 * 3_600_000);
  const h48 = nowMs - 48 * 3_600_000;
  const conds = [eq(events.status, "published"), gte(events.startsAt, since)];
  if (!opts.organizerId) conds.push(eq(events.visibility, "public"));
  if (opts.city) conds.push(eq(events.city, opts.city));
  if (opts.organizerId) conds.push(eq(events.organizerId, opts.organizerId));
  if (opts.venueId) conds.push(eq(events.venueId, opts.venueId));
  if (opts.category) conds.push(sql`${events.category} = ${opts.category}`);
  if (opts.vibe) conds.push(sql`${events.vibe} = ${opts.vibe}`);

  const compareAtPct = sql<number | null>`(select max((tt.compare_at_bani - tt.price_bani) * 100 / tt.compare_at_bani) from ticket_types tt where tt.event_id = "events"."id" and tt.hidden = 0 and tt.compare_at_bani > tt.price_bani)`;
  const rulePct = sql<number | null>`(select max(case when d.type = 'percent' then d.value else 0 end) from discounts d where d.event_id = "events"."id" and d.active = 1 and (d.starts_at is null or d.starts_at <= ${nowMs}) and (d.ends_at is null or d.ends_at > ${nowMs}))`;
  const ruleCount = sql<number>`(select count(*) from discounts d where d.event_id = "events"."id" and d.active = 1 and (d.starts_at is null or d.starts_at <= ${nowMs}) and (d.ends_at is null or d.ends_at > ${nowMs}))`;
  const publicPromoCount = sql<number>`(select count(*) from promo_codes p where p.event_id = "events"."id" and p.active = 1 and p.is_public = 1 and (p.max_uses is null or p.uses < p.max_uses))`;
  if (opts.discounted) {
    conds.push(sql`(coalesce(${compareAtPct}, 0) > 0 or ${ruleCount} > 0 or ${publicPromoCount} > 0)`);
  }

  const rows = await db
    .select({
      event: events,
      organizerName: organizers.name,
      organizerSlug: organizers.slug,
      venue: venues,
      minPrice: sql<number | null>`(select min(case when tt.mode = 'free' then 0 else tt.price_bani end) from ticket_types tt where tt.event_id = "events"."id" and tt.hidden = 0)`,
      compareAtPct,
      rulePct,
      ruleCount,
      publicPromoCount,
      seats48h: sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where o.event_id = "events"."id" and o.status = 'confirmed' and o.created_at > ${h48}), 0)`,
      taken: sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where o.event_id = "events"."id" and o.status = 'confirmed'), 0)`,
    })
    .from(events)
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(and(...conds))
    .orderBy(asc(events.startsAt))
    .limit(opts.limit ?? 200);

  return rows.map((r) => {
    const taken = Number(r.taken);
    const seats48h = Number(r.seats48h);
    const occupancy = r.event.capacity ? Math.min(1, taken / r.event.capacity) : null;
    const pct = Math.max(Number(r.compareAtPct ?? 0), Number(r.rulePct ?? 0));
    const hasDiscount = pct > 0 || Number(r.ruleCount) > 0 || Number(r.publicPromoCount) > 0;
    return {
      event: r.event,
      organizerName: r.organizerName,
      organizerSlug: r.organizerSlug,
      venue: r.venue ? { id: r.venue.id, slug: r.venue.slug, name: r.venue.name, address: r.venue.address, city: r.venue.city, lat: r.venue.lat, lng: r.venue.lng } : null,
      minPrice: r.minPrice == null ? null : Number(r.minPrice),
      discountPct: pct > 0 ? Math.round(pct) : null,
      hasDiscount,
      seats48h,
      taken,
      occupancy,
      heat: heatLevel(seats48h, occupancy),
    };
  });
}

export function toCatalogItem(r: CatalogEvent): CatalogItem {
  return {
    id: r.event.id,
    slug: r.event.slug,
    title: r.event.title,
    subtitle: r.event.subtitle,
    coverUrl: r.event.coverUrl,
    accent: r.event.theme?.accent ?? "#8A3DFF",
    startsAt: r.event.startsAt.getTime(),
    venueName: r.venue?.name ?? r.event.venueName,
    venueSlug: r.venue?.slug ?? null,
    city: r.venue?.city ?? r.event.city,
    lat: r.venue?.lat ?? null,
    lng: r.venue?.lng ?? null,
    category: r.event.category,
    vibe: r.event.vibe,
    heat: r.heat,
    discountPct: r.discountPct,
    hasDiscount: r.hasDiscount,
    minPrice: r.minPrice,
    organizerName: r.organizerName,
    organizerSlug: r.organizerSlug,
  };
}

export async function listCatalogItems(opts: CatalogFilter = {}): Promise<CatalogItem[]> {
  return (await listPublicEvents(opts)).map(toCatalogItem);
}

export async function listCities(): Promise<{ city: string; count: number }[]> {
  const since = new Date(Date.now() - 6 * 3_600_000);
  const rows = await db
    .select({ city: events.city, count: sql<number>`count(*)` })
    .from(events)
    .where(and(eq(events.status, "published"), eq(events.visibility, "public"), gte(events.startsAt, since)))
    .groupBy(events.city)
    .orderBy(sql`count(*) desc`);
  return rows.filter((r): r is { city: string; count: number } => !!r.city).map((r) => ({ city: r.city, count: Number(r.count) }));
}

// Cererea pentru un singur eveniment (pagina publică).
export async function eventDemand(eventId: string, capacity: number | null) {
  const nowMs = Date.now();
  const h48 = nowMs - 48 * 3_600_000;
  const [row] = await db
    .select({
      seats48h: sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where o.event_id = ${eventId} and o.status = 'confirmed' and o.created_at > ${h48}), 0)`,
      taken: sql<number>`coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where o.event_id = ${eventId} and o.status = 'confirmed'), 0)`,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  const seats48h = Number(row?.seats48h ?? 0);
  const taken = Number(row?.taken ?? 0);
  const occupancy = capacity ? Math.min(1, taken / capacity) : null;
  return { seats48h, taken, occupancy, heat: heatLevel(seats48h, occupancy) };
}

export async function getVenueBySlug(slug: string) {
  const [v] = await db.select().from(venues).where(eq(venues.slug, slug)).limit(1);
  return v ?? null;
}

export async function listOrganizerVenues(organizerId: string) {
  return db.select().from(venues).where(eq(venues.organizerId, organizerId)).orderBy(asc(venues.name));
}

// Distanța pe glob, în km. Suficient pentru „la 2 km de tine”.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
