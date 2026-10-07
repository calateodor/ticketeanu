"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { discounts, doorTokens, events, orderItems, orders, prLinks, pricePhases, promoCodes, ticketTypes, venues, type EventSettings } from "@/db/schema";
import { requireOrganizer } from "@/lib/auth";
import { createDoorToken } from "@/lib/checkin";
import { fromLocalInputValue } from "@/lib/dates";
import { newId, shortCode, slugify } from "@/lib/ids";
import { parseLeiToBani } from "@/lib/money";
import { cancelOrder, sendOrderConfirmation } from "@/lib/orders";
import { requireEventAccess } from "@/lib/panel";
import { CATEGORY_KEYS, VIBE_KEYS, type CategoryKey, type VibeKey } from "@/lib/taxonomy";

export type ActionState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string };

function fieldErrors(err: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
  return { fieldErrors };
}

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const eventSchema = z.object({
  title: z.string().trim().min(2, "Dă-i un nume evenimentului.").max(120),
  subtitle: optionalText(160),
  description: optionalText(5000),
  coverUrl: z.string().trim().url("Pune un link valid către imagine (https://…).").optional().or(z.literal("")),
  startsAt: z.string().min(1, "Când începe?"),
  endsAt: optionalText(30),
  doorsAt: optionalText(30),
  venueName: optionalText(120),
  venueAddress: optionalText(200),
  city: optionalText(60),
  capacity: z.string().trim().optional().or(z.literal("")),
  accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Culoarea trebuie să fie hex, ex. #5B3FD1").optional().or(z.literal("")),
  visibility: z.enum(["public", "unlisted"]).optional(),
  category: z.enum(CATEGORY_KEYS, { message: "Alege o categorie." }),
  vibe: z.enum(VIBE_KEYS).optional().or(z.literal("")),
  ticketCover: z.string().optional(),
  venueMode: z.enum(["saved", "new", "none"]).optional(),
  venueId: optionalText(40),
  lat: optionalText(30),
  lng: optionalText(30),
});

type VenueChoice = { id: string } | { create: { name: string; address: string | null; city: string | null; lat: number; lng: number } } | null;

type EventValues = {
  title: string;
  subtitle: string | null;
  description: string | null;
  coverUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  doorsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string | null;
  category: CategoryKey;
  vibe: VibeKey | null;
  capacity: number | null;
  theme: { accent: string; ticketCover: boolean } | null;
  visibility: "public" | "unlisted";
};

function parseEventForm(formData: FormData): { error: ActionState; values?: never; venue?: never } | { error?: never; values: EventValues; venue: VenueChoice } {
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") ?? "",
    description: formData.get("description") ?? "",
    coverUrl: formData.get("coverUrl") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
    doorsAt: formData.get("doorsAt") ?? "",
    venueName: formData.get("venueName") ?? "",
    venueAddress: formData.get("venueAddress") ?? "",
    city: formData.get("city") ?? "",
    capacity: formData.get("capacity") ?? "",
    accent: formData.get("accent") ?? "",
    visibility: (formData.get("visibility") as "public" | "unlisted" | null) ?? undefined,
    category: formData.get("category") ?? "altceva",
    vibe: formData.get("vibe") ?? "",
    ticketCover: formData.get("ticketCover") ?? undefined,
    venueMode: (formData.get("venueMode") as "saved" | "new" | "none" | null) ?? undefined,
    venueId: formData.get("venueId") ?? "",
    lat: formData.get("lat") ?? "",
    lng: formData.get("lng") ?? "",
  });
  if (!parsed.success) return { error: fieldErrors(parsed.error) };
  const d = parsed.data;

  // Locul: unul salvat, unul nou (cu coordonate, ca să apară pe hartă) sau doar text.
  let venue: VenueChoice = null;
  if (d.venueMode === "saved" && d.venueId) venue = { id: d.venueId };
  else if (d.venueMode === "new") {
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    if (!d.venueName) return { error: { fieldErrors: { venueName: "Cum se cheamă locul?" } } satisfies ActionState };
    if (d.lat && d.lng && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      venue = { create: { name: d.venueName, address: d.venueAddress || null, city: d.city || null, lat, lng } };
    }
  }
  const startsAt = fromLocalInputValue(d.startsAt);
  if (!startsAt) return { error: { fieldErrors: { startsAt: "Data de început nu e validă." } } satisfies ActionState };
  const endsAt = d.endsAt ? fromLocalInputValue(d.endsAt) : null;
  const doorsAt = d.doorsAt ? fromLocalInputValue(d.doorsAt) : null;
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { error: { fieldErrors: { endsAt: "Sfârșitul trebuie să fie după început." } } satisfies ActionState };
  }
  const capacity = d.capacity ? Number(d.capacity) : null;
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) {
    return { error: { fieldErrors: { capacity: "Capacitatea e un număr întreg, sau lasă gol pentru nelimitat." } } satisfies ActionState };
  }
  return {
    values: {
      title: d.title,
      subtitle: d.subtitle || null,
      description: d.description || null,
      coverUrl: d.coverUrl || null,
      startsAt,
      endsAt,
      doorsAt,
      venueName: d.venueName || null,
      venueAddress: d.venueAddress || null,
      city: d.city || null,
      category: d.category,
      vibe: d.vibe || null,
      capacity,
      theme: { accent: (d.accent || "#8A3DFF").toUpperCase(), ticketCover: d.ticketCover === "on" },
      visibility: d.visibility ?? "public",
    },
    venue,
  };
}

// Întoarce ce scriem pe eveniment: id-ul locului și copia numelui/adresei/orașului.
async function resolveVenue(organizerId: string, choice: VenueChoice, fallback: Pick<EventValues, "venueName" | "venueAddress" | "city">) {
  if (choice && "id" in choice) {
    const [v] = await db.select().from(venues).where(and(eq(venues.id, choice.id), eq(venues.organizerId, organizerId))).limit(1);
    if (v) return { venueId: v.id, venueName: v.name, venueAddress: v.address, city: v.city };
    return { venueId: null, ...fallback };
  }
  if (choice && "create" in choice) {
    const c = choice.create;
    let slug = slugify(c.name, 40);
    const [taken] = await db.select({ id: venues.id }).from(venues).where(eq(venues.slug, slug)).limit(1);
    if (taken) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const id = newId();
    await db.insert(venues).values({ id, organizerId, slug, name: c.name, address: c.address, city: c.city, lat: c.lat, lng: c.lng });
    return { venueId: id, venueName: c.name, venueAddress: c.address, city: c.city };
  }
  return { venueId: null, ...fallback };
}

export async function createEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireOrganizer();
  const res = parseEventForm(formData);
  if (res.error) return res.error;

  let slug = slugify(res.values.title, 50);
  const [taken] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
  if (taken) slug = `${slug}-${shortCode(4).toLowerCase()}`;

  const place = await resolveVenue(ctx.organizer.id, res.venue, res.values);
  const id = newId();
  await db.insert(events).values({
    id,
    organizerId: ctx.organizer.id,
    slug,
    ...res.values,
    ...place,
    city: place.city ?? ctx.organizer.city,
    status: "draft",
    settings: { groupEnabled: true, waitlistEnabled: true, askPhone: true, holdMinutes: 15 },
  });

  // Un prim tip de bilet, ca pagina să aibă ce vinde.
  const priceRaw = String(formData.get("price") ?? "").trim();
  const mode = String(formData.get("mode") ?? "online") as "free" | "door" | "online";
  let priceBani = 0;
  if (priceRaw) {
    try {
      priceBani = parseLeiToBani(priceRaw);
    } catch {
      priceBani = 0;
    }
  }
  await db.insert(ticketTypes).values({
    id: newId(),
    eventId: id,
    name: priceBani === 0 ? "Intrare" : "Intrare",
    mode: priceBani === 0 ? "free" : mode === "door" ? "door" : "online",
    priceBani,
    sortOrder: 0,
  });

  redirect(`/panou/evenimente/${id}?nou=1`);
}

export async function updateEventAction(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireEventAccess(eventId);
  const res = parseEventForm(formData);
  if (res.error) return res.error;
  const place = await resolveVenue(organizer.id, res.venue, res.values);
  await db
    .update(events)
    .set({ ...res.values, ...place })
    .where(eq(events.id, eventId));
  refresh();
  return { ok: true, message: "Salvat." };
}

export async function deleteVenueAction(venueId: string) {
  const { organizer } = await requireOrganizer();
  await db.delete(venues).where(and(eq(venues.id, venueId), eq(venues.organizerId, organizer.id)));
  refresh();
}

export async function setEventStatusAction(eventId: string, status: "draft" | "published") {
  const { event } = await requireEventAccess(eventId);
  if (event.status === "cancelled") return;
  const [count] = await db.select({ id: ticketTypes.id }).from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).limit(1);
  if (status === "published" && !count) throw new Error("Adaugă cel puțin un tip de bilet înainte să publici.");
  await db
    .update(events)
    .set({ status, publishedAt: status === "published" ? (event.publishedAt ?? new Date()) : event.publishedAt })
    .where(eq(events.id, eventId));
  refresh();
}

export async function cancelEventAction(eventId: string) {
  await requireEventAccess(eventId);
  const live = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.eventId, eventId), eq(orders.status, "confirmed")));
  for (const o of live) {
    await cancelOrder(o.id, { by: "organizer", reason: "Eveniment anulat", refund: true });
  }
  await db.update(events).set({ status: "cancelled" }).where(eq(events.id, eventId));
  refresh();
}

// ---------- Tipuri de bilete ----------

const typeSchema = z.object({
  name: z.string().trim().min(1, "Numele biletului lipsește.").max(80),
  description: optionalText(300),
  mode: z.enum(["free", "door", "deposit", "online"]),
  price: z.string().trim().optional().or(z.literal("")),
  compareAt: z.string().trim().optional().or(z.literal("")),
  deposit: z.string().trim().optional().or(z.literal("")),
  capacity: z.string().trim().optional().or(z.literal("")),
  maxPerOrder: z.string().trim().optional().or(z.literal("")),
  salesStartAt: optionalText(30),
  salesEndAt: optionalText(30),
  hidden: z.string().optional(),
});

export async function upsertTicketTypeAction(eventId: string, typeId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEventAccess(eventId);
  const parsed = typeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    mode: formData.get("mode"),
    price: formData.get("price") ?? "",
    compareAt: formData.get("compareAt") ?? "",
    deposit: formData.get("deposit") ?? "",
    capacity: formData.get("capacity") ?? "",
    maxPerOrder: formData.get("maxPerOrder") ?? "",
    salesStartAt: formData.get("salesStartAt") ?? "",
    salesEndAt: formData.get("salesEndAt") ?? "",
    hidden: formData.get("hidden") ?? undefined,
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  let priceBani = 0;
  let depositBani = 0;
  let compareAtBani: number | null = null;
  try {
    priceBani = d.mode === "free" ? 0 : parseLeiToBani(d.price || "0");
    depositBani = d.mode === "deposit" ? parseLeiToBani(d.deposit || "0") : 0;
    compareAtBani = d.mode !== "free" && d.compareAt ? parseLeiToBani(d.compareAt) : null;
  } catch {
    return { fieldErrors: { price: "Prețul nu e un număr valid." } };
  }
  if (d.mode !== "free" && priceBani <= 0) return { fieldErrors: { price: "Pune un preț mai mare ca zero sau alege „Gratuit”." } };
  if (compareAtBani != null && compareAtBani <= priceBani) return { fieldErrors: { compareAt: "Prețul întreg trebuie să fie mai mare decât prețul de acum, altfel nu e reducere." } };
  if (d.mode === "deposit" && (depositBani <= 0 || depositBani >= priceBani)) {
    return { fieldErrors: { deposit: "Avansul trebuie să fie mai mare ca zero și mai mic decât prețul." } };
  }
  const capacity = d.capacity ? Number(d.capacity) : null;
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) return { fieldErrors: { capacity: "Număr întreg sau gol." } };
  const maxPerOrder = d.maxPerOrder ? Number(d.maxPerOrder) : 10;
  if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 50) return { fieldErrors: { maxPerOrder: "Între 1 și 50." } };

  const values = {
    name: d.name,
    description: d.description || null,
    mode: d.mode,
    priceBani,
    compareAtBani,
    depositBani,
    capacity,
    maxPerOrder,
    salesStartAt: d.salesStartAt ? fromLocalInputValue(d.salesStartAt) : null,
    salesEndAt: d.salesEndAt ? fromLocalInputValue(d.salesEndAt) : null,
    hidden: d.hidden === "on",
  };

  if (typeId) {
    await db.update(ticketTypes).set(values).where(and(eq(ticketTypes.id, typeId), eq(ticketTypes.eventId, eventId)));
  } else {
    const [last] = await db.select({ sortOrder: ticketTypes.sortOrder }).from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).orderBy(ticketTypes.sortOrder);
    await db.insert(ticketTypes).values({ id: newId(), eventId, ...values, sortOrder: (last?.sortOrder ?? -1) + 1 });
  }
  refresh();
  return { ok: true, message: "Salvat." };
}

export async function deleteTicketTypeAction(eventId: string, typeId: string) {
  await requireEventAccess(eventId);
  const [used] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.ticketTypeId, typeId)).limit(1);
  // Dacă există comenzi pe eveniment, mai bine ascundem decât ștergem.
  if (used) {
    await db.update(ticketTypes).set({ hidden: true }).where(and(eq(ticketTypes.id, typeId), eq(ticketTypes.eventId, eventId)));
  } else {
    await db.delete(ticketTypes).where(and(eq(ticketTypes.id, typeId), eq(ticketTypes.eventId, eventId)));
  }
  refresh();
}

const phaseSchema = z.object({
  name: z.string().trim().min(1, "Numele valului lipsește.").max(60),
  price: z.string().trim().min(1, "Pune prețul valului."),
  quantity: z.string().trim().optional().or(z.literal("")),
  startsAt: optionalText(30),
  endsAt: optionalText(30),
});

export async function addPhaseAction(eventId: string, typeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEventAccess(eventId);
  const parsed = phaseSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    quantity: formData.get("quantity") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  let priceBani: number;
  try {
    priceBani = parseLeiToBani(d.price);
  } catch {
    return { fieldErrors: { price: "Prețul nu e un număr valid." } };
  }
  const quantity = d.quantity ? Number(d.quantity) : null;
  if (quantity != null && (!Number.isInteger(quantity) || quantity < 1)) return { fieldErrors: { quantity: "Număr întreg sau gol." } };
  const [last] = await db.select({ sortOrder: pricePhases.sortOrder }).from(pricePhases).where(eq(pricePhases.ticketTypeId, typeId)).orderBy(pricePhases.sortOrder);
  await db.insert(pricePhases).values({
    id: newId(),
    ticketTypeId: typeId,
    name: d.name,
    priceBani,
    quantity,
    startsAt: d.startsAt ? fromLocalInputValue(d.startsAt) : null,
    endsAt: d.endsAt ? fromLocalInputValue(d.endsAt) : null,
    sortOrder: (last?.sortOrder ?? -1) + 1,
  });
  refresh();
  return { ok: true };
}

export async function deletePhaseAction(eventId: string, phaseId: string) {
  await requireEventAccess(eventId);
  await db.delete(pricePhases).where(eq(pricePhases.id, phaseId));
  refresh();
}

// ---------- Coduri de reducere și PR ----------

export async function createPromoAction(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEventAccess(eventId);
  const code = String(formData.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const type = String(formData.get("type") ?? "percent") as "percent" | "fixed";
  const valueRaw = String(formData.get("value") ?? "").trim();
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  if (code.length < 2) return { fieldErrors: { code: "Codul are cel puțin 2 caractere (litere și cifre)." } };
  let value: number;
  try {
    value = type === "percent" ? Number(valueRaw) : parseLeiToBani(valueRaw);
  } catch {
    return { fieldErrors: { value: "Valoarea nu e validă." } };
  }
  if (type === "percent" && (!Number.isInteger(value) || value < 1 || value > 100)) return { fieldErrors: { value: "Procent între 1 și 100." } };
  if (type === "fixed" && value <= 0) return { fieldErrors: { value: "Suma trebuie să fie mai mare ca zero." } };
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  const [exists] = await db.select({ id: promoCodes.id }).from(promoCodes).where(and(eq(promoCodes.eventId, eventId), eq(promoCodes.code, code))).limit(1);
  if (exists) return { fieldErrors: { code: "Codul există deja la acest eveniment." } };
  await db.insert(promoCodes).values({ id: newId(), eventId, code, type, value, maxUses });
  refresh();
  return { ok: true };
}

export async function togglePromoAction(eventId: string, promoId: string, active: boolean) {
  await requireEventAccess(eventId);
  await db.update(promoCodes).set({ active }).where(and(eq(promoCodes.id, promoId), eq(promoCodes.eventId, eventId)));
  refresh();
}

export async function setPromoPublicAction(eventId: string, promoId: string, isPublic: boolean) {
  await requireEventAccess(eventId);
  await db.update(promoCodes).set({ isPublic }).where(and(eq(promoCodes.id, promoId), eq(promoCodes.eventId, eventId)));
  refresh();
}

// ---------- Reduceri fără cod ----------

const discountSchema = z.object({
  kind: z.enum(["audience", "group", "timed"]),
  label: z.string().trim().min(2, "Dă-i un nume reducerii (ex. Studenți).").max(60),
  type: z.enum(["percent", "fixed"]),
  value: z.string().trim().min(1, "Cât scade?"),
  minQuantity: z.string().trim().optional().or(z.literal("")),
  startsAt: optionalText(30),
  endsAt: optionalText(30),
  proofHint: optionalText(80),
});

export async function createDiscountAction(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEventAccess(eventId);
  const parsed = discountSchema.safeParse({
    kind: formData.get("kind"),
    label: formData.get("label"),
    type: formData.get("type") ?? "percent",
    value: formData.get("value") ?? "",
    minQuantity: formData.get("minQuantity") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
    proofHint: formData.get("proofHint") ?? "",
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  let value: number;
  try {
    value = d.type === "percent" ? Number(d.value) : parseLeiToBani(d.value);
  } catch {
    return { fieldErrors: { value: "Valoarea nu e validă." } };
  }
  if (d.type === "percent" && (!Number.isInteger(value) || value < 1 || value > 100)) return { fieldErrors: { value: "Procent între 1 și 100." } };
  if (d.type === "fixed" && value <= 0) return { fieldErrors: { value: "Suma trebuie să fie mai mare ca zero." } };
  const minQuantity = d.kind === "group" ? Number(d.minQuantity || 0) : null;
  if (d.kind === "group" && (!minQuantity || !Number.isInteger(minQuantity) || minQuantity < 2)) return { fieldErrors: { minQuantity: "De la câte locuri? Cel puțin 2." } };
  const startsAt = d.kind === "timed" && d.startsAt ? fromLocalInputValue(d.startsAt) : null;
  const endsAt = d.kind === "timed" && d.endsAt ? fromLocalInputValue(d.endsAt) : null;
  if (d.kind === "timed" && !endsAt) return { fieldErrors: { endsAt: "O ofertă pe timp limitat are nevoie de o oră la care se termină." } };
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) return { fieldErrors: { endsAt: "Sfârșitul trebuie să fie după început." } };
  await db.insert(discounts).values({
    id: newId(),
    eventId,
    kind: d.kind,
    label: d.label,
    type: d.type,
    value,
    minQuantity,
    startsAt,
    endsAt,
    proofHint: d.kind === "audience" ? d.proofHint || null : null,
  });
  refresh();
  return { ok: true };
}

export async function toggleDiscountAction(eventId: string, discountId: string, active: boolean) {
  await requireEventAccess(eventId);
  await db.update(discounts).set({ active }).where(and(eq(discounts.id, discountId), eq(discounts.eventId, eventId)));
  refresh();
}

export async function deleteDiscountAction(eventId: string, discountId: string) {
  await requireEventAccess(eventId);
  await db.delete(discounts).where(and(eq(discounts.id, discountId), eq(discounts.eventId, eventId)));
  refresh();
}

export async function createPrLinkAction(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organizer } = await requireEventAccess(eventId);
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("commissionType") ?? "percent") as "percent" | "fixed";
  const valueRaw = String(formData.get("commissionValue") ?? "0").trim();
  if (name.length < 2) return { fieldErrors: { name: "Scrie numele PR-ului." } };
  let value: number;
  try {
    value = type === "percent" ? Number(valueRaw || 0) : parseLeiToBani(valueRaw || "0");
  } catch {
    return { fieldErrors: { commissionValue: "Comisionul nu e valid." } };
  }
  if (type === "percent" && (value < 0 || value > 100)) return { fieldErrors: { commissionValue: "Procent între 0 și 100." } };
  const base = slugify(name, 16).replace(/-/g, "").toUpperCase() || "PR";
  const code = `${base}-${shortCode(4)}`;
  await db.insert(prLinks).values({ id: newId(), eventId, organizerId: organizer.id, name, code, commissionType: type, commissionValue: value });
  refresh();
  return { ok: true };
}

export async function togglePrLinkAction(eventId: string, prId: string, active: boolean) {
  await requireEventAccess(eventId);
  await db.update(prLinks).set({ active }).where(and(eq(prLinks.id, prId), eq(prLinks.eventId, eventId)));
  refresh();
}

// ---------- Intrare ----------

export async function createDoorTokenAction(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireEventAccess(eventId);
  const label = String(formData.get("label") ?? "").trim() || "Intrare";
  await createDoorToken(eventId, label);
  refresh();
  return { ok: true };
}

export async function revokeDoorTokenAction(eventId: string, tokenId: string) {
  await requireEventAccess(eventId);
  await db.update(doorTokens).set({ revokedAt: new Date() }).where(and(eq(doorTokens.id, tokenId), eq(doorTokens.eventId, eventId)));
  refresh();
}

// ---------- Participanți ----------

export async function cancelOrderAction(eventId: string, orderId: string, refund: boolean) {
  await requireEventAccess(eventId);
  const [order] = await db.select({ id: orders.id, eventId: orders.eventId }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.eventId !== eventId) return;
  await cancelOrder(orderId, { by: "organizer", refund });
  refresh();
}

export async function resendConfirmationAction(eventId: string, orderId: string) {
  await requireEventAccess(eventId);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.eventId !== eventId || order.status !== "confirmed") return;
  await sendOrderConfirmation(order);
}

// ---------- Setări ----------

export async function updateSettingsAction(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { event } = await requireEventAccess(eventId);
  const feeBearerRaw = String(formData.get("feeBearer") ?? "inherit");
  const settings: EventSettings = {
    ...(event.settings ?? {}),
    feeBearer: feeBearerRaw === "buyer" || feeBearerRaw === "organizer" ? feeBearerRaw : null,
    holdMinutes: Math.min(60, Math.max(5, Number(formData.get("holdMinutes") ?? 15) || 15)),
    groupEnabled: formData.get("groupEnabled") === "on",
    groupHoldHours: Math.min(168, Math.max(1, Number(formData.get("groupHoldHours") ?? 48) || 48)),
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    askPhone: formData.get("askPhone") === "on",
    selfCancelHoursBefore: formData.get("selfCancel") === "on" ? Math.max(0, Number(formData.get("selfCancelHoursBefore") ?? 24) || 24) : null,
    reminderHoursBefore: formData.get("reminder") === "on" ? Math.max(1, Number(formData.get("reminderHoursBefore") ?? 24) || 24) : null,
    ageMin: formData.get("ageMin") ? Number(formData.get("ageMin")) || null : null,
  };
  await db.update(events).set({ settings }).where(eq(events.id, eventId));
  refresh();
  return { ok: true, message: "Salvat." };
}
