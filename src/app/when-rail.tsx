"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { CatalogItem } from "@/lib/catalog-types";
import { formatTime } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { cx } from "@/components/ui";

export type WhenTab = { key: string; label: string; items: CatalogItem[] };

const MAX_ROWS = 6;
const dayParts = (ms: number) => {
  const d = new Date(ms);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("ro-RO", { ...o, timeZone: "Europe/Bucharest" }).replace(".", "");
  return { wd: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
};

// „Unde ieși”: file după zi și afișul serii, rând cu rând (data, titlul mare, prețul).
// Pe desktop, afișul evenimentului urmează cursorul peste rând. Filele goale nu apar.
const noop = () => () => {};

export function WhenRail({ tabs }: { tabs: WhenTab[] }) {
  // Afișul plutitor stă direct în <body>, peste toate slide-urile; pe server nu există.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const visible = tabs.filter((t) => t.items.length > 0);
  // Se deschide prima filă cu cel puțin trei evenimente (altfel ultima, „Tot ce urmează”).
  const [active, setActive] = useState((visible.find((t) => t.items.length >= 3) ?? visible.at(-1))?.key ?? "");
  const [peek, setPeek] = useState<string | null>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const current = visible.find((t) => t.key === active) ?? visible[0];

  // Afișul plutitor: urmează cursorul cu întârziere mică și se înclină după viteză.
  useEffect(() => {
    const el = peekRef.current;
    if (!mounted || !el || !window.matchMedia("(pointer: fine)").matches) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX + 24;
      target.y = e.clientY - 140;
    };
    const tick = () => {
      const vx = target.x - cur.x;
      cur.x += vx * 0.22;
      cur.y += (target.y - cur.y) * 0.22;
      const rot = Math.max(-12, Math.min(12, vx * 0.08));
      el.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [mounted]);

  if (!current) return <p className="text-white/80">Nimic anunțat încă. Revino curând.</p>;
  const rows = current.items.slice(0, MAX_ROWS);
  const more = current.items.length - rows.length;
  const peekItem = current.items.find((i) => i.id === peek && i.coverUrl);

  return (
    <div>
      <div role="tablist" aria-label="Când ieși" className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0">
        {visible.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={t.key === current.key}
            onClick={() => setActive(t.key)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-sm font-bold whitespace-nowrap transition-colors",
              t.key === current.key ? "bg-white text-night" : "glass text-white hover:bg-white/20",
            )}
          >
            {t.label} <span className="opacity-60 font-semibold">{t.items.length}</span>
          </button>
        ))}
      </div>

      <ul role="tabpanel" className="mt-4 border-t border-white/25">
        {rows.map((i) => {
          const d = dayParts(i.startsAt);
          return (
            <li key={i.id} className="border-b border-white/25">
              <Link
                href={`/e/${i.slug}?src=t`}
                onPointerEnter={() => setPeek(i.id)}
                onPointerLeave={() => setPeek(null)}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 md:gap-4 py-2.5"
              >
                <span className="glass grid w-[3.25rem] place-items-center rounded-xl py-1.5 leading-none" aria-hidden="true">
                  <span className="text-[10px] font-bold uppercase text-white/75">{d.wd}</span>
                  <span className="headline text-[1.6rem]">{d.day}</span>
                  <span className="text-[10px] font-bold uppercase text-white/75">{d.month}</span>
                </span>
                <span className="min-w-0">
                  <span className="headline block truncate text-[clamp(1.45rem,2.6vw,2.3rem)] transition-colors group-hover:text-lime">{i.title}</span>
                  <span className="block truncate text-sm text-white/80">
                    {formatTime(new Date(i.startsAt))}
                    {i.venueName || i.city ? ` · ${[i.venueName, i.city].filter(Boolean).join(", ")}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {i.discountPct ? <span className="sticker hidden sm:inline-flex text-xs [--tilt:6deg]">-{i.discountPct}%</span> : null}
                  <span className="hidden sm:block text-sm font-bold whitespace-nowrap">{i.minPrice == null ? "" : i.minPrice === 0 ? "gratuit" : formatLei(i.minPrice)}</span>
                  <span className="grid size-9 place-items-center rounded-full bg-white text-night font-bold transition-[transform,background-color] duration-200 group-hover:-rotate-45 group-hover:bg-lime" aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/evenimente" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-white/90 hover:text-white">
        {more > 0 ? `Încă ${more} pe hartă` : "Toată harta, cu filtre"} <span aria-hidden="true">→</span>
      </Link>

      {mounted
        ? createPortal(
            <div ref={peekRef} className={cx("lineup-peek", peekItem && "on")} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {peekItem ? <img src={peekItem.coverUrl!} alt="" className="w-full h-full object-cover" /> : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
