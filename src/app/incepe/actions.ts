"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { organizerMembers, organizers } from "@/db/schema";
import { requireUser, selectOrganizer } from "@/lib/auth";
import { CONTRACT_VERSION } from "@/lib/contract";
import { newId, shortCode, slugify } from "@/lib/ids";

const schema = z.object({
  name: z.string().trim().min(2, "Scrie numele sub care te cunoaște lumea.").max(80),
  city: z.string().trim().max(60).optional(),
  contactEmail: z.string().trim().toLowerCase().email("E-mailul de contact nu arată bine.").optional().or(z.literal("")),
  contactPhone: z.string().trim().max(30).optional(),
  instagram: z.string().trim().max(80).optional(),
  accept: z.literal("on", { message: "Trebuie să accepți condițiile ca să poți vinde." }),
});

export type OnboardState = { error?: string; fieldErrors?: Record<string, string> };

export async function createOrganizerAction(_prev: OnboardState, formData: FormData): Promise<OnboardState> {
  const user = await requireUser("/incepe");
  const parsed = schema.safeParse({
    name: formData.get("name"),
    city: formData.get("city") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    instagram: formData.get("instagram") ?? "",
    accept: formData.get("accept") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }
  const d = parsed.data;

  let slug = slugify(d.name, 40);
  const [taken] = await db.select({ id: organizers.id }).from(organizers).where(eq(organizers.slug, slug)).limit(1);
  if (taken) slug = `${slug}-${shortCode(4).toLowerCase()}`;

  const id = newId();
  await db.insert(organizers).values({
    id,
    slug,
    name: d.name,
    city: d.city || null,
    contactEmail: d.contactEmail || user.email,
    contactPhone: d.contactPhone || null,
    brand: d.instagram ? { instagram: d.instagram.replace(/^@/, "") } : null,
    contractVersion: CONTRACT_VERSION,
    contractAcceptedAt: new Date(),
  });
  await db.insert(organizerMembers).values({ organizerId: id, userId: user.id, role: "owner" });
  await selectOrganizer(id);
  redirect("/panou?bun-venit=1");
}
