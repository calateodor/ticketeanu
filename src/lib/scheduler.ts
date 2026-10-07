import "server-only";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { emails, events, orders } from "@/db/schema";
import { formatDay, formatTime } from "./dates";
import { renderEmail, sendMail, siteUrl } from "./mail";
import { effectiveSettings, expireStale } from "./orders";
import { expireOffers } from "./waitlist";

// Tot ce trebuie să se întâmple „de la sine”: expirări, oferte, remindere.
export async function runScheduledTasks(): Promise<{ expired: number; reminders: number }> {
  const expired = await expireStale();
  await expireOffers();
  const reminders = await sendReminders();
  return { expired, reminders };
}

// Reminder pe e-mail cu N ore înainte (setare per eveniment). Evidența trimiterii
// e chiar în tabela de e-mailuri: relatedType = "reminder", relatedId = comanda.
async function sendReminders(): Promise<number> {
  const now = Date.now();
  const upcoming = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "published"), gt(events.startsAt, new Date(now)), lt(events.startsAt, new Date(now + 72 * 3_600_000))));
  let sent = 0;
  for (const event of upcoming) {
    const settings = effectiveSettings(event);
    if (!settings.reminderHoursBefore) continue;
    const dueAt = event.startsAt.getTime() - settings.reminderHoursBefore * 3_600_000;
    if (now < dueAt) continue;
    const rows = await db
      .select({ order: orders })
      .from(orders)
      .leftJoin(emails, and(eq(emails.relatedType, "reminder"), eq(emails.relatedId, orders.id)))
      .where(and(eq(orders.eventId, event.id), eq(orders.status, "confirmed"), isNull(emails.id), sql`${orders.buyerEmail} is not null`));
    for (const { order } of rows) {
      if (!order.buyerEmail) continue;
      const mail = renderEmail({
        title: `Se apropie: ${event.title}`,
        intro: `Salut, ${order.buyerName.split(" ")[0]}! Îți amintim că ai loc la ${event.title}, ${formatDay(event.startsAt).toLowerCase()}, ora ${formatTime(event.startsAt)}.`,
        lines: [
          event.venueName ? `<strong>Unde:</strong> ${[event.venueName, event.venueAddress, event.city].filter(Boolean).join(", ")}` : "",
          order.dueAtDoorBani > 0 ? `<strong>De plătit la intrare:</strong> ${(order.dueAtDoorBani / 100).toLocaleString("ro-RO")} lei` : "",
        ].filter(Boolean),
        cta: { label: "Vezi biletele", url: siteUrl(`/comanda/${order.manageToken}`) },
        footer: "Nu mai poți veni? Deschide linkul și apasă „Nu mai pot veni”: locul ajunge la altcineva.",
      });
      await sendMail({ to: order.buyerEmail, subject: `Reminder: ${event.title}`, ...mail, related: { type: "reminder", id: order.id } });
      sent++;
    }
  }
  return sent;
}
