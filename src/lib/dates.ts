export const TZ = "Europe/Bucharest";

const dayFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const dayShortFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const fullFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDay(d: Date): string {
  return cap(dayFmt.format(d));
}

export function formatDayShort(d: Date): string {
  return cap(dayShortFmt.format(d)).replace(/\./g, "");
}

export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

export function formatDateTime(d: Date): string {
  return fullFmt.format(d);
}

// Valoare pentru <input type="datetime-local">, în ora României.
export function toLocalInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Inversul: textul din <input type="datetime-local"> (ora României) -> Date.
export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // Ghicim offsetul: construim data ca UTC, apoi corectăm cu offsetul fusului la acel moment.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMinutes(new Date(guess));
  const corrected = guess - offset * 60_000;
  const offset2 = tzOffsetMinutes(new Date(corrected));
  return new Date(guess - offset2 * 60_000);
}

function tzOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

// Ora curentă, într-un singur loc (componentele server o citesc de aici).
export function nowMs(): number {
  return Date.now();
}

export function hoursUntil(d: Date, now = new Date()): number {
  return (d.getTime() - now.getTime()) / 3_600_000;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}
