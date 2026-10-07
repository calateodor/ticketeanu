"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/lib/catalog-types";
import { LAUNCH_CENTER } from "@/lib/launch";
import { CATEGORIES, VIBES } from "@/lib/taxonomy";
import { EventCard } from "@/components/event/event-card";
import { EventMap } from "@/components/event/event-map";
import { cx } from "@/components/ui";

type Pos = { lat: number; lng: number };


const NEAR_KM = 30; // „în zona ta”
const GEO_OPTS: PositionOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 };
const LIME = "#e9ff4f";

// Căutarea ignoră diacriticele și majusculele: „sala” găsește „Sală”.
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function distanceKm(a: Pos, b: Pos): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function Catalog({ items, cities, initial }: { items: CatalogItem[]; cities: { city: string; count: number }[]; initial: { category?: string | null; vibe?: string | null; discounted?: boolean; city?: string | null; map?: boolean; q?: string | null } }) {
  const [q, setQ] = useState(initial.q ?? "");
  const [category, setCategory] = useState<string | null>(initial.category ?? null);
  const [vibe, setVibe] = useState<string | null>(initial.vibe ?? null);
  const [discounted, setDiscounted] = useState(Boolean(initial.discounted));
  const [city, setCity] = useState<string | null>(initial.city ?? null);
  const [userPos, setUserPos] = useState<Pos | null>(null);
  // Locația se cere singură la deschidere (browserul întreabă o dată și ține minte răspunsul).
  const [geo, setGeo] = useState<"idle" | "asking" | "denied">("asking");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">(initial.map ? "map" : "list");

  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const hay = (i: CatalogItem) => norm([i.title, i.subtitle, i.venueName, i.city, i.organizerName].filter(Boolean).join(" "));
    let list = items.filter(
      (i) => (!category || i.category === category) && (!vibe || i.vibe === vibe) && (!discounted || i.hasDiscount) && (!city || i.city === city) && words.every((w) => hay(i).includes(w)),
    );
    if (userPos) {
      list = [...list].sort((a, b) => {
        const da = a.lat != null && a.lng != null ? distanceKm(userPos, { lat: a.lat, lng: a.lng }) : Infinity;
        const db = b.lat != null && b.lng != null ? distanceKm(userPos, { lat: b.lat, lng: b.lng }) : Infinity;
        return da - db || a.startsAt - b.startsAt;
      });
    }
    return list;
  }, [items, category, vibe, discounted, city, userPos, q]);

  const points = useMemo(
    () => filtered.filter((i) => i.lat != null && i.lng != null).map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, vibe: i.vibe, heat: i.heat, title: i.title })),
    [filtered],
  );

  const center = useMemo<Pos>(() => {
    if (userPos) return userPos;
    if (points.length === 0) return LAUNCH_CENTER;
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return { lat, lng };
  }, [userPos, points]);

  const onPos = useCallback((pos: GeolocationPosition) => {
    setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setGeo("idle");
  }, []);
  const onNoPos = useCallback(() => setGeo("denied"), []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setGeo("denied");
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(onPos, onNoPos, GEO_OPTS);
  }, [onPos, onNoPos]);

  useEffect(() => {
    if (!navigator.geolocation) {
      void Promise.resolve().then(onNoPos);
      return;
    }
    navigator.geolocation.getCurrentPosition(onPos, onNoPos, GEO_OPTS);
  }, [onPos, onNoPos]);

  // Ce e în zona ta: pinurile la cel mult NEAR_KM, cele mai apropiate întâi. Harta se încadrează pe
  // tine și pe ele; dacă nu e nimic aproape, pe tine și pe cel mai apropiat eveniment.
  const nearby = useMemo(() => {
    if (!userPos) return [];
    return points.map((p) => ({ p, km: distanceKm(userPos, p) })).sort((a, b) => a.km - b.km);
  }, [userPos, points]);
  const inArea = nearby.filter((n) => n.km <= NEAR_KM);
  const frame = useMemo(() => {
    if (!userPos) return null;
    const close = nearby.filter((n) => n.km <= NEAR_KM).slice(0, 6);
    return [userPos, ...(close.length ? close : nearby.slice(0, 1)).map((n) => ({ lat: n.p.lat, lng: n.p.lng }))];
  }, [userPos, nearby]);
  const km = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${Math.round(d)} km`);

  // Pinul selectat pe hartă aduce cardul în vedere.
  useEffect(() => {
    if (!selected) return;
    document.querySelector<HTMLElement>(`[data-event="${selected}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  // Adresa paginii ține filtrele, ca să poată fi trimise mai departe.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (category) sp.set("categorie", category);
    if (vibe) sp.set("vibe", vibe);
    if (discounted) sp.set("reduceri", "1");
    if (city) sp.set("oras", city);
    if (view === "map") sp.set("harta", "1");
    if (q.trim()) sp.set("q", q.trim());
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/evenimente?${qs}` : "/evenimente");
  }, [category, vibe, discounted, city, view, q]);

  const chipCls = (active: boolean) =>
    cx("rounded-full px-3 py-1.5 text-sm font-semibold border whitespace-nowrap transition-colors", active ? "bg-white text-night border-white" : "border-white/15 text-night-muted hover:text-white hover:border-white/40");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4" data-hero>
        <div>
          <p className="eyebrow mb-2">Harta</p>
          <h1 className="headline text-[clamp(2.6rem,9vw,6rem)]">
            Ce se întâmplă
            <br />
            <span className="text-sunset">{userPos ? "lângă tine" : city ? `în ${city}` : "în oraș"}</span>
          </h1>
        </div>
        <button type="button" onClick={locate} disabled={geo === "asking"} className="glass rounded-full px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-60 transition-colors">
          {geo === "asking" ? "Te caut…" : userPos ? "Lângă mine ✓" : "Lângă mine"}
        </button>
      </div>
      {geo === "denied" ? <p className="mt-2 text-sm text-night-muted">Nu am primit poziția, așa că îți arăt tot. Alege orașul mai jos sau apasă „Lângă mine”.</p> : null}
      {userPos ? (
        <p className="mt-2 text-sm font-semibold text-white/90" role="status">
          {inArea.length > 0
            ? `${inArea.length} ${inArea.length === 1 ? "eveniment" : "evenimente"} la mai puțin de ${NEAR_KM} km de tine. Cel mai aproape: ${inArea[0].p.title}, la ${km(inArea[0].km)}.`
            : nearby[0]
              ? `Nimic la mai puțin de ${NEAR_KM} km de tine. Cel mai aproape: ${nearby[0].p.title}, la ${km(nearby[0].km)}.`
              : "Nu e niciun eveniment pe hartă cu filtrele astea."}
        </p>
      ) : null}

      <div className="mt-5">
        <label htmlFor="cq" className="sr-only">
          Caută
        </label>
        <input id="cq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută: petrecere, club, artist, oraș…" className="field rounded-full! px-5!" />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          <button type="button" onClick={() => setCategory(null)} className={chipCls(!category)}>
            Toate
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" onClick={() => setCategory(category === c.key ? null : c.key)} className={chipCls(category === c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {VIBES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVibe(vibe === v.key ? null : v.key)}
              className={cx(chipCls(vibe === v.key), "inline-flex items-center gap-1.5")}
              style={vibe === v.key ? { background: v.color, borderColor: v.color, color: "#120a1f" } : undefined}
            >
              <span className="size-2 rounded-full" style={{ background: vibe === v.key ? "#120a1f" : v.color }} aria-hidden="true" />
              {v.label}
            </button>
          ))}
          <button type="button" onClick={() => setDiscounted((d) => !d)} className={chipCls(discounted)} style={discounted ? { background: LIME, borderColor: LIME, color: "#120a1f" } : undefined}>
            Reduceri
          </button>
          {cities.length > 1 ? <span className="w-px bg-white/15 my-1" aria-hidden="true" /> : null}
          {cities.length > 1
            ? cities.map((c) => (
                <button key={c.city} type="button" onClick={() => setCity(city === c.city ? null : c.city)} className={chipCls(city === c.city)}>
                  {c.city} <span className="opacity-60">{c.count}</span>
                </button>
              ))
            : null}
        </div>
      </div>

      <div className="mt-4 flex md:hidden rounded-full glass p-1 w-fit">
        {(["list", "map"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={cx("rounded-full px-4 py-1.5 text-sm font-bold", view === v ? "bg-white text-night" : "text-white")}>
            {v === "list" ? "Listă" : "Hartă"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid md:grid-cols-[1fr_minmax(320px,42%)] gap-5 items-start">
        <div className={cx(view === "map" && "hidden md:block")}>
          {filtered.length === 0 ? (
            <p className="text-night-muted py-10">Nimic aici cu filtrele astea. Scoate un filtru sau alt oraș.</p>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {filtered.map((i) => (
                <EventCard
                  key={i.id}
                  item={i}
                  distanceKm={userPos && i.lat != null && i.lng != null ? distanceKm(userPos, { lat: i.lat, lng: i.lng }) : null}
                  selected={selected === i.id}
                  onHover={setHovered}
                />
              ))}
            </div>
          )}
        </div>
        <div className={cx("md:sticky md:top-20", view === "list" && "hidden md:block")}>
          <EventMap
            points={points}
            center={center}
            zoom={userPos ? 13 : 12}
            fitAll={!userPos}
            frame={frame}
            userPos={userPos}
            selectedId={hovered ?? selected}
            onSelect={(id) => {
              setSelected(id);
              setView("list");
            }}
            className="h-[70dvh] md:h-[calc(100dvh-6rem)] rounded-3xl overflow-hidden border border-white/10"
          />
          <p className="mt-2 eyebrow normal-case tracking-normal">Pinul pulsează când evenimentul se încinge. Culoarea e vibe-ul: {VIBES.map((v) => v.label.toLowerCase()).join(", ")}.</p>
        </div>
      </div>
    </div>
  );
}
