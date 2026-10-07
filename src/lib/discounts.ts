// Reducerile fără cod: grup (de la N locuri), ofertă pe timp limitat și
// categorii de oameni (studenți etc., verificate la intrare).
// Logica e pură ca să ruleze la fel în checkout (client) și la crearea comenzii (server).

import type { Discount } from "@/db/schema";

export type DiscountLine = { paidNowBani: number; dueAtDoorBani: number; quantity: number };

// Ce are nevoie logica dintr-o regulă; pe client vine fără eventId/createdAt.
export type DiscountRule = Pick<Discount, "id" | "kind" | "label" | "type" | "value" | "minQuantity" | "startsAt" | "endsAt" | "proofHint" | "active">;

export type AppliedDiscount = {
  rule: DiscountRule;
  onlineBani: number; // cât scade din ce se plătește online
  doorBani: number; // cât scade din ce se plătește la intrare
  note: string; // apare pe bilet și la scanare
};

export function isTimedLive(rule: Pick<Discount, "startsAt" | "endsAt">, now: Date): boolean {
  if (rule.startsAt && rule.startsAt.getTime() > now.getTime()) return false;
  if (rule.endsAt && rule.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

// Se aplică regula pe comanda asta? (fără să socotim încă suma)
export function ruleApplies(rule: DiscountRule, opts: { seats: number; chosenAudienceId: string | null; now: Date }): boolean {
  if (!rule.active) return false;
  if (!isTimedLive(rule, opts.now)) return false;
  switch (rule.kind) {
    case "group":
      return opts.seats >= (rule.minQuantity ?? 2);
    case "timed":
      return true;
    case "audience":
      return opts.chosenAudienceId === rule.id;
  }
}

export function discountNote(rule: Pick<Discount, "label" | "kind" | "proofHint">): string {
  return rule.kind === "audience" && rule.proofHint ? `${rule.label} · arată ${rule.proofHint}` : rule.label;
}

export function discountValueLabel(rule: Pick<Discount, "type" | "value">): string {
  return rule.type === "percent" ? `-${rule.value}%` : `-${rule.value % 100 === 0 ? rule.value / 100 : (rule.value / 100).toFixed(2).replace(".", ",")} lei`;
}

function amountsFor(rule: DiscountRule, lines: DiscountLine[]): { onlineBani: number; doorBani: number } {
  let online = 0;
  let door = 0;
  let seats = 0;
  for (const l of lines) {
    online += l.paidNowBani * l.quantity;
    door += l.dueAtDoorBani * l.quantity;
    seats += l.quantity;
  }
  if (rule.type === "percent") {
    const p = Math.min(100, Math.max(0, rule.value));
    return { onlineBani: Math.round((online * p) / 100), doorBani: Math.round((door * p) / 100) };
  }
  // Sumă fixă pe loc: întâi din ce se plătește online, restul din ce se plătește la intrare.
  const total = rule.value * seats;
  const onlineBani = Math.min(online, total);
  const doorBani = Math.min(door, total - onlineBani);
  return { onlineBani, doorBani };
}

// Alege cea mai mare reducere care se aplică. Reducerile nu se cumulează.
export function pickDiscount(input: { rules: DiscountRule[]; lines: DiscountLine[]; chosenAudienceId: string | null; now: Date }): AppliedDiscount | null {
  const seats = input.lines.reduce((s, l) => s + l.quantity, 0);
  if (seats === 0) return null;
  let best: AppliedDiscount | null = null;
  for (const rule of input.rules) {
    if (!ruleApplies(rule, { seats, chosenAudienceId: input.chosenAudienceId, now: input.now })) continue;
    const { onlineBani, doorBani } = amountsFor(rule, input.lines);
    if (onlineBani + doorBani <= 0) continue;
    if (!best || onlineBani + doorBani > best.onlineBani + best.doorBani) {
      best = { rule, onlineBani, doorBani, note: discountNote(rule) };
    }
  }
  return best;
}

// Procentul „-X%” afișat pe card când prețul de acum e sub prețul întreg.
export function compareAtPercent(priceBani: number, compareAtBani: number | null | undefined): number | null {
  if (!compareAtBani || compareAtBani <= priceBani) return null;
  return Math.round(((compareAtBani - priceBani) * 100) / compareAtBani);
}
