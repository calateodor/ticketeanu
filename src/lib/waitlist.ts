import "server-only";
import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { events, organizers, ticketTypes, waitlistEntries } from "@/db/schema";
import { computeAvailability } from "./availability";
import { addHours, formatDay, formatTime } from "./dates";
import { newId, secureToken } from "./ids";
import { renderEmail, sendMail, siteUrl } from "./mail";

const OFFER_HOURS = 6;

export async function joinWaitlist(input: {
  eventId: string;
  ticketTypeId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  quantity: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: "Scrie numele tău." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Adresa de e-mail nu arată bine." };
  const quantity = Math.max(1, Math.min(10, Math.floor(input.quantity || 1)));

  const [existing] = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.eventId, input.eventId), eq(waitlistEntries.email, email), eq(waitlistEntries.status, "waiting")))
    .limit(1);
  if (existing) return { ok: false, error: "Ești deja pe lista de așteptare cu acest e-mail." };

  await db.insert(waitlistEntries).values({
    id: newId(),
    eventId: input.eventId,
    ticketTypeId: input.ticketTypeId ?? null,
    name,
    email,
    phone: input.phone?.trim() || null,
    quantity,
    status: "waiting",
  });
  return { ok: true };
}

// Când se eliberează locuri, le oferim pe rând celor din listă. Oferta ține
// câteva ore; locurile oferite sunt considerate ocupate până expiră.
export async function offerSeatsToWaitlist(eventId: string): Promise<number> {
  const now = new Date();
  await expireOffers(now);

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.status !== "published") return 0;
  const waiting = await db
    .select()
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.eventId, eventId), eq(waitlistEntries.status, "waiting")))
    .orderBy(asc(waitlistEntries.createdAt));
  if (waiting.length === 0) return 0;

  const availability = await computeAvailability(db, eventId, now);
  const types = await db.select().from(ticketTypes).where(eq(ticketTypes.eventId, eventId));
  const typeCap = new Map(types.map((t) => [t.id, t.capacity]));
  let eventFree = event.capacity == null ? Number.POSITIVE_INFINITY : event.capacity - availability.eventTaken;
  const typeTaken: Record<string, number> = {};
  for (const [id, a] of Object.entries(availability.byType)) typeTaken[id] = a.taken;

  const [organizer] = await db.select().from(organizers).where(eq(organizers.id, event.organizerId)).limit(1);
  let offered = 0;
  for (const entry of waiting) {
    if (eventFree < entry.quantity) continue;
    if (entry.ticketTypeId) {
      const cap = typeCap.get(entry.ticketTypeId);
      if (cap != null && cap - (typeTaken[entry.ticketTypeId] ?? 0) < entry.quantity) continue;
    }
    const token = secureToken(18);
    const offerExpiresAt = new Date(Math.min(addHours(now, OFFER_HOURS).getTime(), event.startsAt.getTime()));
    if (offerExpiresAt.getTime() <= now.getTime()) break;
    await db
      .update(waitlistEntries)
      .set({ status: "offered", offerToken: token, offeredAt: now, offerExpiresAt })
      .where(eq(waitlistEntries.id, entry.id));
    eventFree -= entry.quantity;
    if (entry.ticketTypeId) typeTaken[entry.ticketTypeId] = (typeTaken[entry.ticketTypeId] ?? 0) + entry.quantity;
    offered++;

    const mail = renderEmail({
      title: `S-a eliberat un loc la ${event.title}`,
      intro: `Salut, ${entry.name.split(" ")[0]}! Ți-am păstrat ${entry.quantity === 1 ? "un loc" : `${entry.quantity} locuri`} până la ora ${formatTime(offerExpiresAt)} (${formatDay(offerExpiresAt)}).`,
      lines: ["Dacă nu le iei până atunci, trec la următoarea persoană de pe listă."],
      cta: { label: "Ia locul", url: siteUrl(`/e/${event.slug}?oferta=${token}`) },
      footer: `Organizator: ${organizer?.name ?? ""}.`,
      accent: event.theme?.accent ?? organizer?.brand?.accent,
    });
    await sendMail({ to: entry.email, subject: `Loc liber la ${event.title}`, ...mail, related: { type: "waitlist", id: entry.id } });
  }
  return offered;
}

export async function expireOffers(now = new Date()): Promise<void> {
  await db
    .update(waitlistEntries)
    .set({ status: "expired" })
    .where(and(eq(waitlistEntries.status, "offered"), lt(waitlistEntries.offerExpiresAt, now)));
}

export async function getActiveOffer(token: string) {
  const [entry] = await db.select().from(waitlistEntries).where(eq(waitlistEntries.offerToken, token)).limit(1);
  if (!entry || entry.status !== "offered") return null;
  if (!entry.offerExpiresAt || entry.offerExpiresAt.getTime() < Date.now()) return null;
  return entry;
}
