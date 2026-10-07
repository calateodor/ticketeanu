"use client";

import { useEffect, useState } from "react";

// Bara de jos de pe telefon: dispare când secțiunea cu bilete e deja pe ecran.
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
    <div className="md:hidden fixed bottom-0 inset-x-0 border-t border-night-line bg-night/90 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-night-muted">{priceLabel}</p>
        <p className="font-display font-extrabold text-xl leading-none">{priceValue}</p>
      </div>
      <a href="#bilete" className="rounded-xl px-6 py-3 font-bold text-white" style={{ background: "var(--accent)" }}>
        {buttonLabel}
      </a>
    </div>
  );
}
