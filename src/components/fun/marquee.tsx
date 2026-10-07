import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";

// Bandă care curge pe orizontală (CSS, .marquee). Conținutul apare de două ori ca bucla să nu
// aibă cusătură; a doua copie e `inert` (nici cititoarele de ecran, nici Tab nu o văd).
// `repeat` umple banda când sunt puține elemente. Se oprește sub cursor și la focus.
export function Marquee({
  children,
  label,
  reverse = false,
  duration = 40,
  repeat = 1,
  className,
}: {
  children: ReactNode;
  label?: string;
  reverse?: boolean;
  duration?: number;
  repeat?: number;
  className?: string;
}) {
  const half = (hidden: boolean) => (
    <div className="flex shrink-0" aria-hidden={hidden || undefined} inert={hidden || undefined}>
      {Array.from({ length: repeat }, (_, i) => (
        <div key={i} className="flex shrink-0" aria-hidden={i > 0 || undefined} inert={i > 0 || undefined}>
          {children}
        </div>
      ))}
    </div>
  );
  return (
    <div className={cx("marquee", className)} data-dir={reverse ? "rev" : undefined} style={{ "--dur": `${duration}s` } as CSSProperties} role={label ? "region" : undefined} aria-label={label}>
      <div className="marquee-track">
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}
