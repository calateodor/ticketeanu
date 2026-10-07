// Sumele circulă prin aplicație ca bani (întregi). Formatarea e doar pentru afișare.

const leiFormatter = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatLei(bani: number): string {
  const lei = bani / 100;
  const hasCents = bani % 100 !== 0;
  const s = hasCents
    ? new Intl.NumberFormat("ro-RO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(lei)
    : leiFormatter.format(lei);
  return `${s} lei`;
}

export function parseLeiToBani(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const cleaned = input.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) throw new Error("Sumă invalidă");
  return Math.round(n * 100);
}

export function platformFeeBps(): number {
  const n = Number(process.env.PLATFORM_FEE_BPS ?? 500);
  return Number.isFinite(n) ? n : 500;
}

// Comisionul platformei pe o sumă plătită online. Fără parte fixă.
export function calcFee(subtotalBani: number, feeBps: number): number {
  if (subtotalBani <= 0) return 0;
  return Math.round((subtotalBani * feeBps) / 10_000);
}

export function bpsToPercent(bps: number): string {
  const p = bps / 100;
  return Number.isInteger(p) ? `${p}%` : `${p.toFixed(2).replace(".", ",")}%`;
}
