"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CatalogItem } from "@/lib/catalog-types";
import { formatDayShort, formatTime } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { Ticket, TicketMachine } from "@/components/ticket/ticket";

export type HeroEvent = { item: CatalogItem; qr: string };

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  const s = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
};

// Biletul din hero: un eveniment adevărat, pe care îl apeși ca să rezervi. Săgețile (sau swipe pe
// telefon) trec la alt eveniment, iar imprimanta îl tipărește din nou. Ordinea: cele mai aproape de
// tine dacă ai dat deja voie la locație (nu întrebăm aici), altfel cele mai cerute.
export function HeroTicket({ events }: { events: HeroEvent[] }) {
  const [order, setOrder] = useState(events);
  const [nearMe, setNearMe] = useState(false);
  const [i, setI] = useState(0);
  const [printed, setPrinted] = useState(0); // câte tipăriri: prima are pauza de intrare, restul pornesc imediat
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (!alive || p.state !== "granted") return;
        navigator.geolocation.getCurrentPosition((pos) => {
          if (!alive) return;
          const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const d = (e: HeroEvent) => (e.item.lat != null && e.item.lng != null ? distanceKm(me, { lat: e.item.lat, lng: e.item.lng }) : Infinity);
          setOrder([...events].sort((a, b) => d(a) - d(b)));
          setNearMe(true);
          setI(0);
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [events]);

  const current = order[i];
  if (!current) return null;
  const { item, qr } = current;
  const many = order.length > 1;
  const go = (step: number) => {
    setI((n) => (n + step + order.length) % order.length);
    setPrinted((p) => p + 1);
  };
  const href = `/e/${item.slug}?src=t#bilete`;
  const price = item.minPrice == null ? null : item.minPrice === 0 ? "gratuit" : `de la ${formatLei(item.minPrice)}`;

  return (
    <div
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null || !many) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <Link href={href} aria-label={`${item.title}: rezervă`} className="block rounded-[22px]" style={printed > 0 ? ({ "--print-wait": "0s" } as CSSProperties) : undefined}>
        <TicketMachine key={`${item.id}-${printed}`} label="Printărie" sticker="Gata!">
          <Ticket
            title={item.title}
            subtitle={item.subtitle}
            dayLabel={formatDayShort(new Date(item.startsAt))}
            timeLabel={formatTime(new Date(item.startsAt))}
            venue={item.venueName}
            city={item.city}
            holder="Numele tău"
            typeName="Intrare"
            code="7K3PQ2WX9A"
            orderCode="GATA"
            qrDataUrl={qr}
            coverUrl={item.coverUrl}
            useCover={Boolean(item.coverUrl)}
            motionButton={false}
            animate
          />
        </TicketMachine>
      </Link>

      <div className="mt-1 flex items-center gap-2">
        {many ? (
          <button type="button" onClick={() => go(-1)} aria-label="Evenimentul anterior" className="grid size-11 shrink-0 place-items-center rounded-full bg-night/45 ring-1 ring-white/25 text-lg font-bold hover:bg-night/70 transition-colors">
            ←
          </button>
        ) : null}
        <Link href={href} className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-white text-night pl-4 pr-1.5 py-1.5 font-bold hover:bg-lime transition-colors">
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm">Rezervă</span>
            <span className="block truncate text-[11px] font-semibold text-night/60">
              {nearMe ? "aproape de tine" : many ? `${i + 1} din ${order.length}` : "acum"}
              {price ? ` · ${price}` : ""}
            </span>
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-night text-white transition-transform duration-200 group-hover:-rotate-45" aria-hidden="true">
            →
          </span>
        </Link>
        {many ? (
          <button type="button" onClick={() => go(1)} aria-label="Evenimentul următor" className="grid size-11 shrink-0 place-items-center rounded-full bg-night/45 ring-1 ring-white/25 text-lg font-bold hover:bg-night/70 transition-colors">
            →
          </button>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {item.title}, {formatDayShort(new Date(item.startsAt))}
      </p>
    </div>
  );
}
