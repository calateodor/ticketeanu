import { categoryLabel, heatOf, vibeOf, type HeatLevel } from "@/lib/taxonomy";
import { cx } from "@/components/ui";

const chip = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap";

export function CategoryChip({ category, className }: { category: string | null | undefined; className?: string }) {
  return <span className={cx(chip, "bg-white/10 text-white border border-white/15", className)}>{categoryLabel(category)}</span>;
}

export function VibeChip({ vibe, className }: { vibe: string | null | undefined; className?: string }) {
  const v = vibeOf(vibe);
  if (!v) return null;
  return (
    <span className={cx(chip, "border", className)} style={{ color: v.color, borderColor: `${v.color}66`, background: `${v.color}1f` }} title={v.hint}>
      <span className="size-1.5 rounded-full" style={{ background: v.color }} aria-hidden="true" />
      {v.label}
    </span>
  );
}

// Trei bare: câte sunt aprinse spune cât de cerut e evenimentul.
export function HeatMeter({ level, className, withLabel = true }: { level: HeatLevel; className?: string; withLabel?: boolean }) {
  const h = heatOf(level);
  const color = level === 3 ? "#ff2e8a" : level === 2 ? "#ff7a1a" : level === 1 ? "#e9ff4f" : "#b9a9d6";
  return (
    <span className={cx(chip, "bg-black/35 text-white", className)} title={h.hint} aria-label={`Cerere: ${h.label}`}>
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className="w-[3px] rounded-sm" style={{ height: `${4 + i * 3}px`, background: i <= level ? color : "rgba(255,255,255,0.25)" }} />
        ))}
      </span>
      {withLabel ? <span style={{ color: level >= 2 ? color : undefined }}>{h.label}</span> : null}
    </span>
  );
}

export function DiscountBadge({ pct, className }: { pct: number | null | undefined; className?: string }) {
  if (!pct) return null;
  return <span className={cx(chip, "bg-lime text-night font-extrabold -rotate-3", className)}>-{pct}%</span>;
}
