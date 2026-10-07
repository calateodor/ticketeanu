"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogItem } from "@/lib/catalog-types";
import { EventCard } from "@/components/event/event-card";
import { cx } from "@/components/ui";

export type WhenTab = { key: string; label: string; items: CatalogItem[] };

// „Unde ieși”: file după zi, cu un șir de carduri care se derulează pe orizontală.
// Filele goale nu apar; prima filă cu evenimente e cea deschisă.
export function WhenRail({ tabs }: { tabs: WhenTab[] }) {
  const visible = tabs.filter((t) => t.items.length > 0);
  const [active, setActive] = useState(visible[0]?.key ?? "");
  const current = visible.find((t) => t.key === active) ?? visible[0];
  if (!current) return <p className="text-night-muted">Nimic anunțat încă. Revino curând.</p>;

  return (
    <div>
      <div role="tablist" aria-label="Când ieși" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {visible.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={t.key === current.key}
            onClick={() => setActive(t.key)}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap border transition-colors",
              t.key === current.key ? "bg-white text-night border-white" : "border-white/15 text-white/70 hover:text-white hover:border-white/40",
            )}
          >
            {t.label} <span className="opacity-60 font-semibold">{t.items.length}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6 -mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2">
        {current.items.map((i) => (
          <div key={i.id} className="snap-start shrink-0 w-[72vw] max-w-[290px] sm:w-[290px]">
            <EventCard item={i} />
          </div>
        ))}
        <Link
          href="/evenimente"
          className="snap-start shrink-0 w-[60vw] max-w-[220px] rounded-3xl border border-dashed border-white/20 grid place-items-center text-center p-6 text-white/80 hover:text-white hover:border-white/50 transition-colors"
        >
          <span>
            <span className="headline block text-3xl">Toată harta</span>
            <span className="text-sm text-night-muted">cu filtre pe vibe, zonă și reduceri</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
