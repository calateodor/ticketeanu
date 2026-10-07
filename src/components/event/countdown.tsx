"use client";

import { useNow } from "@/lib/use-now";

// „se termină în 1h 12m” / „în 04:59”, cu secunde sub un minut… nu: sub o oră.
export function Countdown({ until, className }: { until: number; className?: string }) {
  const now = useNow(1000);
  if (now === 0) return <span className={className}>…</span>;
  const left = Math.max(0, until - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const text = left === 0 ? "s-a terminat" : h >= 24 ? `${Math.floor(h / 24)} zile` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return (
    <span className={className} aria-live="off">
      {text}
    </span>
  );
}
