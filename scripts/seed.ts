// Date de probă: un organizator, locuri pe hartă, cinci evenimente, rezervări.
// Rulează: npm run seed   (după npm run db:push). Se poate rula de mai multe ori: șterge și reface contul demo.

import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  discounts,
  doorTokens,
  events,
  groups,
  ledgerEntries,
  orderItems,
  orders,
  organizerMembers,
  organizers,
  prLinks,
  pricePhases,
  promoCodes,
  ticketTypes,
  tickets,
  users,
  venues,
  waitlistEntries,
} from "../src/db/schema";
import { newId, secureToken, shortCode } from "../src/lib/ids";

const DEMO_EMAIL = "demo@ticketeanu.ro";

function at(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Șterge tot ce ține de organizatorul demo, în ordinea legăturilor (fără să ne bazăm pe cascade).
async function wipeDemo(orgId: string) {
  const evs = await db.select({ id: events.id }).from(events).where(eq(events.organizerId, orgId));
  const ids = evs.map((e) => e.id);
  if (ids.length > 0) {
    const ords = await db.select({ id: orders.id }).from(orders).where(inArray(orders.eventId, ids));
    const oids = ords.map((o) => o.id);
    if (oids.length > 0) await db.delete(orderItems).where(inArray(orderItems.orderId, oids));
    await db.delete(tickets).where(inArray(tickets.eventId, ids));
    await db.delete(orders).where(inArray(orders.eventId, ids));
    await db.delete(groups).where(inArray(groups.eventId, ids));
    await db.delete(waitlistEntries).where(inArray(waitlistEntries.eventId, ids));
    await db.delete(doorTokens).where(inArray(doorTokens.eventId, ids));
    await db.delete(prLinks).where(inArray(prLinks.eventId, ids));
    await db.delete(promoCodes).where(inArray(promoCodes.eventId, ids));
    await db.delete(discounts).where(inArray(discounts.eventId, ids));
    const tts = await db.select({ id: ticketTypes.id }).from(ticketTypes).where(inArray(ticketTypes.eventId, ids));
    if (tts.length > 0) await db.delete(pricePhases).where(inArray(pricePhases.ticketTypeId, tts.map((t) => t.id)));
    await db.delete(ticketTypes).where(inArray(ticketTypes.eventId, ids));
    await db.delete(events).where(inArray(events.id, ids));
  }
  await db.delete(ledgerEntries).where(eq(ledgerEntries.organizerId, orgId));
  await db.delete(venues).where(eq(venues.organizerId, orgId));
  await db.delete(organizerMembers).where(eq(organizerMembers.organizerId, orgId));
  await db.delete(organizers).where(eq(organizers.id, orgId));
}

async function seedOrders(opts: { eventId: string; orgId: string; typeId: string; nameSnapshot: string; unitBani: number; names: string[]; qtyOf: (i: number) => number }) {
  for (const [i, name] of opts.names.entries()) {
    const orderId = newId();
    const qty = opts.qtyOf(i);
    const subtotal = opts.unitBani * qty;
    const fee = Math.round(subtotal * 0.05);
    await db.insert(orders).values({
      id: orderId,
      code: shortCode(8),
      eventId: opts.eventId,
      organizerId: opts.orgId,
      status: "confirmed",
      buyerName: name,
      buyerEmail: `${name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}${i}@exemplu.ro`,
      buyerPhone: `07${String(10000000 + i * 1234567).slice(0, 8)}`,
      subtotalBani: subtotal,
      feeBani: fee,
      totalBani: subtotal + fee,
      feeBearer: "buyer",
      confirmedAt: new Date(),
      marketingConsent: i % 2 === 0,
      manageToken: secureToken(24),
    });
    await db.insert(orderItems).values({ id: newId(), orderId, ticketTypeId: opts.typeId, nameSnapshot: opts.nameSnapshot, quantity: qty, unitPriceBani: opts.unitBani, unitPaidNowBani: opts.unitBani, unitDueAtDoorBani: 0 });
    if (subtotal > 0) await db.insert(ledgerEntries).values({ id: newId(), organizerId: opts.orgId, eventId: opts.eventId, orderId, type: "sale", amountBani: subtotal, description: `Comanda (demo) ${name}` });
    for (let k = 0; k < qty; k++) {
      await db.insert(tickets).values({ id: newId(), code: shortCode(10), orderId, eventId: opts.eventId, ticketTypeId: opts.typeId, holderName: k === 0 ? name : null, status: "valid" });
    }
  }
}

const NAMES = [
  "Ana Popescu", "Mihai Ionescu", "Ioana Radu", "Vlad Dumitrescu", "Elena Stan", "Andrei Pop", "Maria Georgescu", "Radu Constantin", "Cristina Matei", "Bogdan Ilie",
  "Alexandra Toma", "Ștefan Marin", "Diana Rusu", "Cătălin Nistor", "Laura Enache", "Paul Dobre", "Roxana Șerban", "Dan Petrescu", "Simona Lazăr", "Tudor Munteanu",
  "Irina Voicu", "George Barbu", "Oana Cristea", "Florin Sava", "Bianca Neagu", "Lucian Preda", "Teodora Avram", "Marius Dinu", "Sorina Luca", "Adrian Moldovan",
];

async function main() {
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  let userId = existing?.id;
  if (existing) {
    const mem = await db.select({ organizerId: organizerMembers.organizerId }).from(organizerMembers).where(eq(organizerMembers.userId, existing.id));
    for (const m of mem) await wipeDemo(m.organizerId);
    console.log("Am șters datele demo vechi.");
  } else {
    userId = newId();
    await db.insert(users).values({ id: userId, email: DEMO_EMAIL, name: "Demo" });
  }

  const orgId = newId();
  await db.insert(organizers).values({
    id: orgId,
    slug: "nook",
    name: "Nook",
    description: "Petreceri de club în București și seri chill în Cluj. Joi, vineri, sâmbătă.",
    city: "București",
    contactEmail: DEMO_EMAIL,
    brand: { accent: "#FF4D6D", instagram: "nook.bucuresti" },
    legalName: "Nook Events SRL",
    cui: "RO12345678",
    iban: "RO49AAAA1B31007593840000",
    feeBps: 500,
    feeBearer: "buyer",
    contractVersion: "2026-10-draft",
    contractAcceptedAt: new Date(),
  });
  await db.insert(organizerMembers).values({ organizerId: orgId, userId: userId!, role: "owner" });

  // Locuri pe hartă.
  const nookId = newId();
  const areneleId = newId();
  const gradinaId = newId();
  await db.insert(venues).values([
    { id: nookId, organizerId: orgId, slug: "nook", name: "Nook", address: "Strada Gabroveni 14", city: "București", lat: 44.4311, lng: 26.1016, description: "Club în Centrul Vechi: două ringuri, terasă pe acoperiș." },
    { id: areneleId, organizerId: orgId, slug: "arenele-romane", name: "Arenele Romane", address: "Strada Cuțitul de Argint 2", city: "București", lat: 44.4142, lng: 26.0985 },
    { id: gradinaId, organizerId: orgId, slug: "gradina-urbana", name: "Grădina Urbană", address: "Piața Unirii 10", city: "Cluj-Napoca", lat: 46.7695, lng: 23.5899, description: "Grădină de vară, lumini calde, muzică la volum de vorbit." },
  ]);

  // 1. Petrecere în picioare, hot, cu valuri de preț, mese cu avans, reduceri de grup și happy hour.
  const partyId = newId();
  await db.insert(events).values({
    id: partyId,
    organizerId: orgId,
    slug: "carousel-party",
    title: "Carousel Party · Halloween Edition",
    subtitle: "3 DJ, 2 ringuri, costume obligatorii",
    description: "Cea mai mare petrecere de Halloween din Nook. Dress code: orice, dar să sperie.\n\nUșile se deschid la 22:00. Până la 23:00 intrarea e mai ieftină.",
    coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80",
    startsAt: at(9, 23, 0),
    doorsAt: at(9, 22, 0),
    endsAt: at(10, 5, 0),
    venueId: nookId,
    venueName: "Nook",
    venueAddress: "Strada Gabroveni 14",
    city: "București",
    category: "petrecere",
    vibe: "hot",
    status: "published",
    visibility: "public",
    capacity: 400,
    theme: { accent: "#FF4D6D", ticketCover: true },
    settings: { groupEnabled: true, waitlistEnabled: true, askPhone: true, holdMinutes: 15, selfCancelHoursBefore: 24, reminderHoursBefore: 24, ageMin: 18 },
    publishedAt: new Date(),
  });
  const entryId = newId();
  await db.insert(ticketTypes).values([
    { id: entryId, eventId: partyId, name: "Intrare", mode: "online", priceBani: 6000, maxPerOrder: 10, sortOrder: 0 },
    { id: newId(), eventId: partyId, name: "Masă de 6 · zona ring", description: "Masă rezervată pentru 6 persoane, consumație minimă 600 lei. Avansul se scade din consumație.", mode: "deposit", priceBani: 60000, depositBani: 20000, capacity: 8, maxPerOrder: 1, sortOrder: 1 },
    { id: newId(), eventId: partyId, name: "Listă, plata la ușă", description: "Rezervi acum, plătești 70 lei la intrare. Locul se eliberează dacă nu confirmi la reminder.", mode: "door", priceBani: 7000, capacity: 100, maxPerOrder: 4, sortOrder: 2 },
  ]);
  await db.insert(pricePhases).values([
    { id: newId(), ticketTypeId: entryId, name: "Early Bird", priceBani: 4000, quantity: 50, sortOrder: 0 },
    { id: newId(), ticketTypeId: entryId, name: "Val 1", priceBani: 6000, quantity: 150, sortOrder: 1 },
    { id: newId(), ticketTypeId: entryId, name: "Val 2", priceBani: 8000, sortOrder: 2 },
  ]);
  await db.insert(promoCodes).values({ id: newId(), eventId: partyId, code: "PRIETENI", type: "percent", value: 20, maxUses: 50, isPublic: true });
  await db.insert(discounts).values([
    { id: newId(), eventId: partyId, kind: "group", label: "Gașca de 5+", type: "percent", value: 10, minQuantity: 5 },
    { id: newId(), eventId: partyId, kind: "timed", label: "Happy hour online", type: "percent", value: 15, startsAt: null, endsAt: at(0, 23, 59) },
    { id: newId(), eventId: partyId, kind: "audience", label: "Fete", type: "percent", value: 50, proofHint: "buletinul" },
  ]);
  await db.insert(prLinks).values([
    { id: newId(), eventId: partyId, organizerId: orgId, name: "Andrei", code: "ANDREI-" + shortCode(4), commissionType: "percent", commissionValue: 10 },
    { id: newId(), eventId: partyId, organizerId: orgId, name: "Maria", code: "MARIA-" + shortCode(4), commissionType: "fixed", commissionValue: 500 },
  ]);
  await db.insert(doorTokens).values({ id: newId(), eventId: partyId, label: "Poarta 1", token: secureToken(16) });
  await seedOrders({ eventId: partyId, orgId, typeId: entryId, nameSnapshot: "Intrare · Early Bird", unitBani: 4000, names: NAMES.slice(0, 14), qtyOf: (i) => 1 + (i % 3) });

  // 2. Concert, mixt, plată online, preț tăiat și reducere pentru studenți. Fierbe.
  const concertId = newId();
  await db.insert(events).values({
    id: concertId,
    organizerId: orgId,
    slug: "concert-queen-tribute",
    title: "Queen Tribute Night",
    subtitle: "Live band, 2 ore de hituri",
    coverUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80",
    startsAt: at(20, 20, 0),
    doorsAt: at(20, 19, 0),
    venueId: areneleId,
    venueName: "Arenele Romane",
    venueAddress: "Strada Cuțitul de Argint 2",
    city: "București",
    category: "concert",
    vibe: "mixt",
    status: "published",
    capacity: 1500,
    theme: { accent: "#F5B700" },
    settings: { groupEnabled: true, waitlistEnabled: true, askPhone: false, holdMinutes: 15 },
    publishedAt: new Date(),
  });
  const generalId = newId();
  await db.insert(ticketTypes).values([
    { id: generalId, eventId: concertId, name: "General", mode: "online", priceBani: 12000, compareAtBani: 15000, maxPerOrder: 8, sortOrder: 0 },
    { id: newId(), eventId: concertId, name: "Golden Circle", mode: "online", priceBani: 22000, capacity: 200, maxPerOrder: 6, sortOrder: 1 },
  ]);
  await db.insert(discounts).values({ id: newId(), eventId: concertId, kind: "audience", label: "Studenți", type: "percent", value: 25, proofHint: "legitimația de student" });
  await seedOrders({ eventId: concertId, orgId, typeId: generalId, nameSnapshot: "General", unitBani: 12000, names: NAMES, qtyOf: () => 2 });

  // 3. Seară gratuită, chill, pe listă.
  const freeId = newId();
  await db.insert(events).values({
    id: freeId,
    organizerId: orgId,
    slug: "open-mic-joi",
    title: "Open Mic de joi",
    subtitle: "Intrare liberă, pe listă",
    startsAt: at(3, 20, 30),
    venueId: nookId,
    venueName: "Nook",
    venueAddress: "Strada Gabroveni 14",
    city: "București",
    category: "standup",
    vibe: "chill",
    status: "published",
    capacity: 80,
    theme: { accent: "#1D9E75" },
    settings: { groupEnabled: true, waitlistEnabled: true, askPhone: false, reminderHoursBefore: 6 },
    publishedAt: new Date(),
  });
  await db.insert(ticketTypes).values({ id: newId(), eventId: freeId, name: "Loc pe listă", mode: "free", priceBani: 0, maxPerOrder: 4, sortOrder: 0 });

  // 4. Seară chill în Cluj, cu preț tăiat.
  const sunsetId = newId();
  await db.insert(events).values({
    id: sunsetId,
    organizerId: orgId,
    slug: "sunset-sessions",
    title: "Sunset Sessions",
    subtitle: "Vinil, grătar, apus",
    description: "Muzică la volum de vorbit, grătar din cinci, apus din șapte. Vino cu cine vrei.",
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80",
    startsAt: at(6, 18, 0),
    endsAt: at(6, 23, 30),
    venueId: gradinaId,
    venueName: "Grădina Urbană",
    venueAddress: "Piața Unirii 10",
    city: "Cluj-Napoca",
    category: "petrecere",
    vibe: "chill",
    status: "published",
    capacity: 150,
    theme: { accent: "#FF7A3D" },
    settings: { groupEnabled: true, waitlistEnabled: true, askPhone: false },
    publishedAt: new Date(),
  });
  const sunsetTypeId = newId();
  await db.insert(ticketTypes).values({ id: sunsetTypeId, eventId: sunsetId, name: "Intrare", mode: "online", priceBani: 3000, compareAtBani: 4000, maxPerOrder: 6, sortOrder: 0 });
  await seedOrders({ eventId: sunsetId, orgId, typeId: sunsetTypeId, nameSnapshot: "Intrare", unitBani: 3000, names: NAMES.slice(5, 7), qtyOf: () => 2 });

  // 5. Workshop, fără loc pe hartă încă (doar text).
  const wsId = newId();
  await db.insert(events).values({
    id: wsId,
    organizerId: orgId,
    slug: "atelier-cocktailuri",
    title: "Atelier de cocktailuri",
    subtitle: "Trei rețete, un barman, zece oameni",
    startsAt: at(12, 19, 0),
    venueName: "Se anunță cu o zi înainte",
    city: "București",
    category: "workshop",
    vibe: "chill",
    status: "published",
    capacity: 10,
    theme: { accent: "#3DD6FF" },
    settings: { groupEnabled: false, waitlistEnabled: true, askPhone: true },
    publishedAt: new Date(),
  });
  await db.insert(ticketTypes).values({ id: newId(), eventId: wsId, name: "Loc la bar", mode: "online", priceBani: 15000, maxPerOrder: 2, sortOrder: 0 });

  console.log(`Gata. Intră cu ${DEMO_EMAIL} (codul apare pe ecran în dev).`);
  console.log("Evenimente: /e/carousel-party, /e/concert-queen-tribute, /e/open-mic-joi, /e/sunset-sessions, /e/atelier-cocktailuri");
  console.log("Harta: /evenimente · Locuri: /loc/nook, /loc/arenele-romane, /loc/gradina-urbana");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
