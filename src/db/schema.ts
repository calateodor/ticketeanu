import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { CATEGORY_KEYS, VIBE_KEYS } from "@/lib/taxonomy";

// Toate sumele sunt în bani (1 leu = 100 bani), ca întregi.
// Toate datele sunt timestamp-uri în milisecunde (mode: timestamp_ms -> Date în JS).

const id = () => text("id").primaryKey();
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

// ---------- Conturi ----------

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: createdAt(),
});

export const loginCodes = sqliteTable(
  "login_codes",
  {
    id: id(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("login_codes_email_idx").on(t.email)],
);

export const sessions = sqliteTable("sessions", {
  id: id(), // hash-ul tokenului din cookie
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

// ---------- Organizatori ----------

export type OrganizerBrand = {
  accent?: string; // culoare hex
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
};

export const organizers = sqliteTable("organizers", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(), // numele public (brandul)
  description: text("description"),
  city: text("city"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  brand: text("brand", { mode: "json" }).$type<OrganizerBrand>(),
  // date de firmă
  legalName: text("legal_name"),
  cui: text("cui"),
  regCom: text("reg_com"),
  address: text("address"),
  iban: text("iban"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  // comision și contract
  feeBps: integer("fee_bps").notNull().default(500),
  feeBearer: text("fee_bearer", { enum: ["buyer", "organizer"] })
    .notNull()
    .default("buyer"),
  contractVersion: text("contract_version"),
  contractAcceptedAt: ts("contract_accepted_at"),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
  createdAt: createdAt(),
});

export const organizerMembers = sqliteTable(
  "organizer_members",
  {
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin"] }).notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organizerId, t.userId] })],
);

// ---------- Locuri ----------

// Un loc (club, sală, grădină) e salvat o dată și refolosit la fiecare eveniment.
// Coordonatele îl pun pe hartă; pagina publică /loc/[slug] arată tot ce urmează acolo.
export const venues = sqliteTable(
  "venues",
  {
    id: id(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("venues_org_idx").on(t.organizerId)],
);

// ---------- Evenimente ----------

export type EventTheme = {
  accent?: string; // hex
  mode?: "dark" | "light";
  ticketCover?: boolean; // afișul evenimentului pe fundalul biletului (altfel, gradientul din accent)
};

export type EventSettings = {
  feeBearer?: "buyer" | "organizer" | null; // null = moștenit de la organizator
  holdMinutes?: number; // cât ținem locul până la plată (implicit 15)
  reminderHoursBefore?: number | null; // null = fără reminder
  selfCancelHoursBefore?: number | null; // participantul poate renunța singur până la X ore înainte
  groupEnabled?: boolean; // rezervarea de grup
  groupHoldHours?: number; // cât ținem locurile unui grup (implicit 48)
  ageMin?: number | null;
  waitlistEnabled?: boolean;
  askPhone?: boolean; // cerem și telefon la cumpărare
};

export const events = sqliteTable(
  "events",
  {
    id: id(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    coverUrl: text("cover_url"),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at"),
    doorsAt: ts("doors_at"),
    venueId: text("venue_id").references(() => venues.id, { onDelete: "set null" }),
    venueName: text("venue_name"), // copie la momentul salvării, ca pagina să meargă și fără loc salvat
    venueAddress: text("venue_address"),
    city: text("city"),
    category: text("category", { enum: CATEGORY_KEYS }).notNull().default("altceva"),
    vibe: text("vibe", { enum: VIBE_KEYS }), // ales de organizator; null = nespus
    status: text("status", {
      enum: ["draft", "published", "cancelled", "ended"],
    })
      .notNull()
      .default("draft"),
    visibility: text("visibility", { enum: ["public", "unlisted"] })
      .notNull()
      .default("public"),
    capacity: integer("capacity"), // null = nelimitat
    theme: text("theme", { mode: "json" }).$type<EventTheme>(),
    settings: text("settings", { mode: "json" }).$type<EventSettings>(),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_org_idx").on(t.organizerId),
    index("events_city_starts_idx").on(t.city, t.startsAt),
    index("events_venue_idx").on(t.venueId),
  ],
);

// Un "tip de bilet" = o opțiune de pe listă. Modul spune cum se ocupă locul:
//  free    - gratuit, fără plată
//  door    - rezervare, plata integrală la intrare
//  deposit - avans online acum, restul la intrare
//  online  - plată integrală online
export const ticketTypes = sqliteTable(
  "ticket_types",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    mode: text("mode", { enum: ["free", "door", "deposit", "online"] })
      .notNull()
      .default("online"),
    priceBani: integer("price_bani").notNull().default(0),
    compareAtBani: integer("compare_at_bani"), // „prețul întreg”, afișat tăiat lângă prețul de acum
    depositBani: integer("deposit_bani").notNull().default(0),
    capacity: integer("capacity"), // null = limitat doar de capacitatea evenimentului
    minPerOrder: integer("min_per_order").notNull().default(1),
    maxPerOrder: integer("max_per_order").notNull().default(10),
    salesStartAt: ts("sales_start_at"),
    salesEndAt: ts("sales_end_at"),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("ticket_types_event_idx").on(t.eventId)],
);

// Valuri de preț (Early Bird, Val 1, Val 2...). Un val se termină când se
// epuizează cantitatea sau când trece data de final; se trece la următorul.
export const pricePhases = sqliteTable(
  "price_phases",
  {
    id: id(),
    ticketTypeId: text("ticket_type_id")
      .notNull()
      .references(() => ticketTypes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceBani: integer("price_bani").notNull(),
    quantity: integer("quantity"), // null = nelimitat în acest val
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("price_phases_type_idx").on(t.ticketTypeId)],
);

// ---------- Comenzi (intrări pe listă) ----------

export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    code: text("code").notNull().unique(), // codul public, scurt
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "confirmed", "cancelled", "expired", "refunded"],
    })
      .notNull()
      .default("pending"),
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email"),
    buyerPhone: text("buyer_phone"),
    // bani
    subtotalBani: integer("subtotal_bani").notNull().default(0), // ce se plătește online, înainte de comision
    discountBani: integer("discount_bani").notNull().default(0),
    feeBani: integer("fee_bani").notNull().default(0), // comisionul platformei
    totalBani: integer("total_bani").notNull().default(0), // ce plătește cumpărătorul online acum
    dueAtDoorBani: integer("due_at_door_bani").notNull().default(0), // ce mai are de plătit la intrare
    feeBearer: text("fee_bearer", { enum: ["buyer", "organizer"] })
      .notNull()
      .default("buyer"),
    // proveniență
    promoCodeId: text("promo_code_id"),
    discountId: text("discount_id"), // regula de reducere aplicată (studenți, grup, ofertă pe timp limitat)
    discountNote: text("discount_note"), // ce apare pe bilet și la scanare, ex. „Studenți · arată legitimația”
    prLinkId: text("pr_link_id"),
    source: text("source", { enum: ["direct", "ticketeanu", "pr"] })
      .notNull()
      .default("direct"),
    groupId: text("group_id"),
    // stări
    expiresAt: ts("expires_at"), // pentru comenzile în așteptarea plății
    confirmedAt: ts("confirmed_at"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    marketingConsent: integer("marketing_consent", { mode: "boolean" })
      .notNull()
      .default(false),
    manageToken: text("manage_token").notNull(), // linkul prin care cumpărătorul își vede comanda
    createdAt: createdAt(),
  },
  (t) => [
    index("orders_event_status_idx").on(t.eventId, t.status),
    index("orders_email_idx").on(t.buyerEmail),
    uniqueIndex("orders_manage_token_idx").on(t.manageToken),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    ticketTypeId: text("ticket_type_id")
      .notNull()
      .references(() => ticketTypes.id),
    pricePhaseId: text("price_phase_id"),
    nameSnapshot: text("name_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceBani: integer("unit_price_bani").notNull(), // prețul întreg al locului
    unitPaidNowBani: integer("unit_paid_now_bani").notNull(), // cât se plătește online pe loc
    unitDueAtDoorBani: integer("unit_due_at_door_bani").notNull(), // cât se plătește la intrare pe loc
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// Un bilet = o persoană = un cod QR.
export const tickets = sqliteTable(
  "tickets",
  {
    id: id(),
    code: text("code").notNull().unique(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ticketTypeId: text("ticket_type_id")
      .notNull()
      .references(() => ticketTypes.id),
    holderName: text("holder_name"),
    status: text("status", { enum: ["valid", "used", "cancelled"] })
      .notNull()
      .default("valid"),
    checkedInAt: ts("checked_in_at"),
    checkedInBy: text("checked_in_by"), // eticheta porții / a tokenului de scanare
    createdAt: createdAt(),
  },
  (t) => [
    index("tickets_event_idx").on(t.eventId),
    index("tickets_order_idx").on(t.orderId),
  ],
);

// Gașca: un grup ține N locuri până la un termen; fiecare membru își ia
// locul (și îl plătește) prin linkul grupului.
export const groups = sqliteTable(
  "groups",
  {
    id: id(),
    code: text("code").notNull().unique(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ticketTypeId: text("ticket_type_id")
      .notNull()
      .references(() => ticketTypes.id),
    name: text("name").notNull(), // "Gașca lui Andrei"
    leaderName: text("leader_name").notNull(),
    leaderEmail: text("leader_email"),
    leaderOrderId: text("leader_order_id"),
    holdQuantity: integer("hold_quantity").notNull(), // câte locuri ține grupul, în total (inclusiv liderul)
    holdExpiresAt: ts("hold_expires_at").notNull(),
    status: text("status", { enum: ["open", "closed", "expired"] })
      .notNull()
      .default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("groups_event_idx").on(t.eventId)],
);

// ---------- Bani ----------

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // demo | netopia | stripe ...
    providerRef: text("provider_ref"),
    amountBani: integer("amount_bani").notNull(),
    currency: text("currency").notNull().default("RON"),
    status: text("status", {
      enum: ["created", "paid", "failed", "refunded", "partially_refunded"],
    })
      .notNull()
      .default("created"),
    refundedBani: integer("refunded_bani").notNull().default(0),
    raw: text("raw", { mode: "json" }).$type<Record<string, unknown>>(),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

// Registrul de bani al fiecărui organizator. Suma intrărilor = soldul lui.
// Sumele sunt din perspectiva organizatorului: + îi datorăm, - i-am plătit / reținut.
export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: id(),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    eventId: text("event_id"),
    orderId: text("order_id"),
    paymentId: text("payment_id"),
    type: text("type", {
      enum: [
        "sale", // încasare din bilete (partea organizatorului)
        "platform_fee", // comisionul platformei reținut din partea organizatorului
        "refund", // bani dați înapoi cumpărătorului
        "payout", // bani virați organizatorului
        "pr_commission", // comision datorat unui PR, reținut din încasări
        "promo", // promovare plătită, reținută din încasări
        "adjustment", // corecție manuală
      ],
    }).notNull(),
    amountBani: integer("amount_bani").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_org_idx").on(t.organizerId, t.createdAt)],
);

export const payouts = sqliteTable("payouts", {
  id: id(),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => organizers.id, { onDelete: "cascade" }),
  amountBani: integer("amount_bani").notNull(),
  iban: text("iban"),
  status: text("status", { enum: ["requested", "paid", "cancelled"] })
    .notNull()
    .default("requested"),
  reference: text("reference"),
  note: text("note"),
  paidAt: ts("paid_at"),
  createdAt: createdAt(),
});

// ---------- Promovare și PR ----------

export const promoCodes = sqliteTable(
  "promo_codes",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    type: text("type", { enum: ["percent", "fixed"] }).notNull(),
    value: integer("value").notNull(), // procent (ex. 20) sau bani
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false), // afișat pe pagina evenimentului
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("promo_codes_event_code_idx").on(t.eventId, t.code)],
);

// Reduceri fără cod. Se aplică singure (grup, ofertă pe timp limitat) sau la
// alegerea cumpărătorului (studenți, fete până la o oră), caz în care se
// verifică la intrare. Nu se cumulează: pe o comandă se aplică cea mai mare.
export const discounts = sqliteTable(
  "discounts",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["audience", "group", "timed"] }).notNull(),
    label: text("label").notNull(), // „Studenți”, „Gașca de 5+”, „Happy hour”
    type: text("type", { enum: ["percent", "fixed"] }).notNull(),
    value: integer("value").notNull(), // procent sau bani / loc
    minQuantity: integer("min_quantity"), // group: de la câte locuri
    startsAt: ts("starts_at"), // timed: fereastra ofertei
    endsAt: ts("ends_at"),
    proofHint: text("proof_hint"), // audience: ce se arată la intrare, ex. „legitimația de student”
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("discounts_event_idx").on(t.eventId)],
);

export const prLinks = sqliteTable(
  "pr_links",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    organizerId: text("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // numele PR-ului
    code: text("code").notNull().unique(),
    commissionType: text("commission_type", { enum: ["percent", "fixed"] })
      .notNull()
      .default("percent"),
    commissionValue: integer("commission_value").notNull().default(0), // procent sau bani / bilet
    clicks: integer("clicks").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("pr_links_event_idx").on(t.eventId)],
);

// ---------- Lista de așteptare ----------

export const waitlistEntries = sqliteTable(
  "waitlist_entries",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ticketTypeId: text("ticket_type_id").references(() => ticketTypes.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    quantity: integer("quantity").notNull().default(1),
    status: text("status", {
      enum: ["waiting", "offered", "claimed", "expired", "cancelled"],
    })
      .notNull()
      .default("waiting"),
    offerToken: text("offer_token"),
    offeredAt: ts("offered_at"),
    offerExpiresAt: ts("offer_expires_at"),
    createdAt: createdAt(),
  },
  (t) => [index("waitlist_event_idx").on(t.eventId, t.status)],
);

// ---------- Intrare ----------

// Un link de scanare pe care organizatorul îl dă oamenilor de la intrare.
export const doorTokens = sqliteTable(
  "door_tokens",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "Poarta 1", "Andrei"
    token: text("token").notNull().unique(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("door_tokens_event_idx").on(t.eventId)],
);

// ---------- E-mailuri ----------

export const emails = sqliteTable(
  "emails",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text"),
    status: text("status", { enum: ["queued", "sent", "failed"] })
      .notNull()
      .default("queued"),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    error: text("error"),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [index("emails_created_idx").on(t.createdAt)],
);

// ---------- Tipuri utile ----------

export type User = typeof users.$inferSelect;
export type Organizer = typeof organizers.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Discount = typeof discounts.$inferSelect;
export type TicketType = typeof ticketTypes.$inferSelect;
export type PricePhase = typeof pricePhases.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type PrLink = typeof prLinks.$inferSelect;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type DoorToken = typeof doorTokens.$inferSelect;
export type EmailRow = typeof emails.$inferSelect;
