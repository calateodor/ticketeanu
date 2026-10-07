"use server";

import { checkIn, doorStats, getDoorContext, searchTickets, undoCheckIn, type CheckInResult, type TicketView } from "@/lib/checkin";

export async function scanAction(token: string, code: string): Promise<{ result: CheckInResult; stats: { expected: number; arrived: number } }> {
  const result = await checkIn(token, code);
  const ctx = await getDoorContext(token);
  const stats = ctx ? await doorStats(ctx.event.id) : { expected: 0, arrived: 0 };
  return { result, stats };
}

export async function searchAction(token: string, query: string): Promise<TicketView[]> {
  const ctx = await getDoorContext(token);
  if (!ctx) return [];
  return searchTickets(ctx.event.id, query);
}

export async function undoAction(token: string, ticketId: string): Promise<boolean> {
  return undoCheckIn(token, ticketId);
}
