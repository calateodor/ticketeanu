"use client";

import { useEffect, useState } from "react";

// Bara de jos de pe telefon: o pastilă cu prețul și butonul de rezervare. Dispare când secțiunea
// cu bilete e deja pe ecran.
export function StickyCta({ priceLabel, priceValue, buttonLabel }: { priceLabel: string; priceValue: string; buttonLabel: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const target = document.getElementById("bilete");
    if (!target) return;
    const obs = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { rootMargin: "0px 0px -40% 0px" });
    obs.observe(target);
    return () => obs.disconnect();
  }, []);
  if (hidden) return null;
  return (
    <div className="lg:hidden fixed bottom-3 inset-x-3 z-40 rounded-full bg-night/85 backdrop-blur-xl ring-1 ring-white/15 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] pl-5 pr-1.5 py-1.5 flex items-center justify-between gap-3">
      <div className="leading-none">
        <p className="text-[11px] font-semibold text-white/60">{priceLabel}</p>
        <p className="headline text-2xl">{priceValue}</p>
      </div>
      <a href="#bilete" className="inline-flex items-center gap-2 rounded-full pl-5 pr-1.5 py-1.5 font-bold text-white" style={{ background: "var(--accent)" }}>
        {buttonLabel}
        <span className="grid size-8 place-items-center rounded-full bg-night/30" aria-hidden="true">
          →
        </span>
      </a>
    </div>
  );
}
