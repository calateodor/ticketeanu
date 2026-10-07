"use server";

import { redirect } from "next/navigation";
import { createOrder, OrderError } from "@/lib/orders";
import { joinWaitlist } from "@/lib/waitlist";

export type ReserveState = { error?: string };

export async function reserveAction(_prev: ReserveState, formData: FormData): Promise<ReserveState> {
  const eventId = String(formData.get("eventId") ?? "");
  const items: { ticketTypeId: string; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^qty\[(.+)\]$/);
    if (m) items.push({ ticketTypeId: m[1], quantity: Number(value) || 0 });
  }
  const groupSize = Number(formData.get("groupSize") ?? 0) || 0;
  const wantsGroup = formData.get("withGroup") === "on" && groupSize > 0;

  let result;
  try {
    result = await createOrder({
      eventId,
      items,
      buyer: {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      },
      promoCode: String(formData.get("promoCode") ?? "") || null,
      discountId: String(formData.get("discountId") ?? "") || null,
      prCode: String(formData.get("pr") ?? "") || null,
      groupCode: String(formData.get("groupCode") ?? "") || null,
      createGroup: wantsGroup ? { name: String(formData.get("groupName") ?? ""), size: groupSize } : null,
      waitlistToken: String(formData.get("offer") ?? "") || null,
      marketingConsent: formData.get("marketing") === "on",
      source: String(formData.get("source") ?? "direct") === "ticketeanu" ? "ticketeanu" : "direct",
    });
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    console.error(err);
    return { error: "Nu am putut face rezervarea. Încearcă din nou." };
  }
  redirect(result.redirectUrl);
}

export type WaitlistState = { error?: string; ok?: boolean };

export async function waitlistAction(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const res = await joinWaitlist({
    eventId: String(formData.get("eventId") ?? ""),
    ticketTypeId: String(formData.get("ticketTypeId") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    quantity: Number(formData.get("quantity") ?? 1) || 1,
  });
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
