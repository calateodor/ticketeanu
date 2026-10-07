import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  loginCodes,
  organizerMembers,
  organizers,
  sessions,
  users,
  type Organizer,
  type User,
} from "@/db/schema";
import { newId, secureToken, sixDigitCode } from "./ids";
import { renderEmail, sendMail } from "./mail";

const SESSION_COOKIE = "tk_session";
const ORG_COOKIE = "tk_org";
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret";
}

function hash(value: string): string {
  return createHash("sha256").update(`${value}:${secret()}`).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------- Cod de login pe e-mail ----------

export async function requestLoginCode(
  emailRaw: string,
): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Scrie o adresă de e-mail validă." };
  }

  const [last] = await db
    .select({ createdAt: loginCodes.createdAt })
    .from(loginCodes)
    .where(eq(loginCodes.email, email))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (last && Date.now() - last.createdAt.getTime() < 30_000) {
    return { ok: false, error: "Ți-am trimis deja un cod. Verifică e-mailul sau încearcă din nou peste 30 de secunde." };
  }

  const code = sixDigitCode();
  // Un cod nou le anulează pe cele vechi.
  await db
    .update(loginCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt)));
  await db.insert(loginCodes).values({
    id: newId(),
    email,
    codeHash: hash(code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
  });

  const mail = renderEmail({
    title: `Codul tău: ${code}`,
    intro: `Scrie codul ${code} în pagina de intrare. E valabil ${CODE_MINUTES} minute.`,
    footer: "Dacă nu tu ai cerut codul, ignoră mesajul. Nimeni nu poate intra fără el.",
  });
  await sendMail({ to: email, subject: `${code} este codul tău Ticketeanu`, ...mail, related: { type: "login", id: email } });

  const isDev = process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY;
  return { ok: true, ...(isDev ? { devCode: code } : {}) };
}

export async function verifyLoginCode(
  emailRaw: string,
  codeRaw: string,
): Promise<{ ok: true; user: User; isNew: boolean } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Codul are 6 cifre." };

  const [row] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, new Date())))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false, error: "Codul a expirat. Cere unul nou." };
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Prea multe încercări. Cere un cod nou." };
  }
  if (row.codeHash !== hash(code)) {
    await db.update(loginCodes).set({ attempts: row.attempts + 1 }).where(eq(loginCodes.id, row.id));
    return { ok: false, error: "Codul nu e bun. Mai verifică o dată." };
  }
  await db.update(loginCodes).set({ usedAt: new Date() }).where(eq(loginCodes.id, row.id));

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let isNew = false;
  if (!user) {
    const id = newId();
    await db.insert(users).values({ id, email });
    [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    isNew = true;
  }
  await createSession(user.id);
  return { ok: true, user, isNew };
}

// ---------- Sesiuni ----------

export async function createSession(userId: string): Promise<void> {
  const token = secureToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: hash(token), userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hash(token)));
  store.delete(SESSION_COOKIE);
  store.delete(ORG_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, hash(token)))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row.user;
}

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/intra${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

// ---------- Organizatorul curent ----------

export type OrganizerContext = {
  user: User;
  organizer: Organizer;
  role: "owner" | "admin";
};

export async function listUserOrganizers(userId: string) {
  return db
    .select({ organizer: organizers, role: organizerMembers.role })
    .from(organizerMembers)
    .innerJoin(organizers, eq(organizers.id, organizerMembers.organizerId))
    .where(eq(organizerMembers.userId, userId))
    .orderBy(organizers.createdAt);
}

export async function getCurrentOrganizer(user: User): Promise<OrganizerContext | null> {
  const memberships = await listUserOrganizers(user.id);
  if (memberships.length === 0) return null;
  const store = await cookies();
  const wanted = store.get(ORG_COOKIE)?.value;
  const picked = memberships.find((m) => m.organizer.id === wanted) ?? memberships[0];
  return { user, organizer: picked.organizer, role: picked.role };
}

export async function requireOrganizer(next?: string): Promise<OrganizerContext> {
  const user = await requireUser(next);
  const ctx = await getCurrentOrganizer(user);
  if (!ctx) redirect("/incepe");
  return ctx;
}

export async function selectOrganizer(organizerId: string): Promise<void> {
  const store = await cookies();
  store.set(ORG_COOKIE, organizerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 86_400,
  });
}
