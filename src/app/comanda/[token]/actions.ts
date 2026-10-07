"use server";

import { refresh } from "next/cache";
import { hoursUntil } from "@/lib/dates";
import { cancelOrder, effectiveSettings, getOrderByManageToken, OrderError, restartPayment } from "@/lib/orders";
import { redirect } from "next/navigation";

export type CancelState = { error?: string; ok?: boolean };

export async function buyerCancelAction(token: string): Promise<CancelState> {
  const data = await getOrderByManageToken(token);
  if (!data) return { error: "Comanda nu există." };
  const { order, event } = data;
  if (order.status !== "confirmed" && order.status !== "pending") return { error: "Rezervarea nu mai e activă." };
  const hours = hoursUntil(event.startsAt);
  if (hours <= 0) return { error: "Evenimentul a început deja." };

  const settings = effectiveSettings(event);
  const paid = order.totalBani > 0 && order.status === "confirmed";
  if (paid) {
    if (settings.selfCancelHoursBefore == null) {
      return { error: "Pentru rezervările plătite, scrie organizatorului; el poate anula și rambursa." };
    }
    if (hours < settings.selfCancelHoursBefore) {
      return { error: `Poți renunța singur doar cu cel puțin ${settings.selfCancelHoursBefore} ore înainte. Scrie organizatorului.` };
    }
  }
  try {
    await cancelOrder(order.id, { by: "buyer", reason: "Participantul a renunțat", refund: paid });
  } catch (err) {
    return { error: err instanceof OrderError ? err.message : "Nu am putut anula. Încearcă din nou." };
  }
  refresh();
  return { ok: true };
}

export async function retryPaymentAction(token: string) {
  const data = await getOrderByManageToken(token);
  if (!data) return;
  let url: string;
  try {
    url = await restartPayment(data.order.id);
  } catch {
    return;
  }
  redirect(url);
}
