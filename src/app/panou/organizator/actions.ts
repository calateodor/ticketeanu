"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { organizers } from "@/db/schema";
import { requireOrganizer } from "@/lib/auth";

export type OrgState = { ok?: boolean; fieldErrors?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(2, "Numele e prea scurt.").max(80),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  contactEmail: z.string().trim().toLowerCase().email("E-mailul nu arată bine.").optional().or(z.literal("")),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  instagram: z.string().trim().max(80).optional().or(z.literal("")),
  website: z.string().trim().url("Linkul nu arată bine.").optional().or(z.literal("")),
  logoUrl: z.string().trim().url("Linkul nu arată bine.").optional().or(z.literal("")),
  accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  legalName: z.string().trim().max(120).optional().or(z.literal("")),
  cui: z.string().trim().max(20).optional().or(z.literal("")),
  regCom: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  iban: z
    .string()
    .transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^(RO[0-9]{2}[A-Z0-9]{20})?$/, "IBAN-ul românesc are 24 de caractere și începe cu RO.")),
  feeBearer: z.enum(["buyer", "organizer"]),
});

export async function updateOrganizerAction(_prev: OrgState, formData: FormData): Promise<OrgState> {
  const { organizer } = await requireOrganizer();
  const get = (k: string) => String(formData.get(k) ?? "");
  const parsed = schema.safeParse({
    name: get("name"),
    description: get("description"),
    city: get("city"),
    contactEmail: get("contactEmail"),
    contactPhone: get("contactPhone"),
    instagram: get("instagram"),
    website: get("website"),
    logoUrl: get("logoUrl"),
    accent: get("accent"),
    legalName: get("legalName"),
    cui: get("cui"),
    regCom: get("regCom"),
    address: get("address"),
    iban: get("iban"),
    feeBearer: get("feeBearer") || "buyer",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }
  const d = parsed.data;
  await db
    .update(organizers)
    .set({
      name: d.name,
      description: d.description || null,
      city: d.city || null,
      contactEmail: d.contactEmail || null,
      contactPhone: d.contactPhone || null,
      logoUrl: d.logoUrl || null,
      brand: {
        ...(organizer.brand ?? {}),
        instagram: d.instagram ? d.instagram.replace(/^@/, "") : undefined,
        website: d.website || undefined,
        accent: d.accent ? d.accent.toUpperCase() : undefined,
      },
      legalName: d.legalName || null,
      cui: d.cui || null,
      regCom: d.regCom || null,
      address: d.address || null,
      iban: d.iban || null,
      feeBearer: d.feeBearer,
    })
    .where(eq(organizers.id, organizer.id));
  refresh();
  return { ok: true };
}
