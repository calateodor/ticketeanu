import "server-only";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireOrganizer, type OrganizerContext } from "./auth";

// Evenimentul cerut există și e al organizatorului curent; altfel 404.
export async function requireEventAccess(eventId: string): Promise<OrganizerContext & { event: typeof events.$inferSelect }> {
  const ctx = await requireOrganizer();
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizerId, ctx.organizer.id)))
    .limit(1);
  if (!event) notFound();
  return { ...ctx, event };
}
