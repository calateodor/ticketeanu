"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { Venue } from "@/db/schema";
import { Button, Field, Hint, Input, Select } from "@/components/ui";

type Mode = "saved" | "new" | "none";
type Hit = { label: string; lat: number; lng: number; city: string | null; address: string | null };

const BUCHAREST = { lat: 44.4325, lng: 26.1039 };

export function VenuePicker({
  venues,
  initial,
  defaultCity,
  errors,
}: {
  venues: Venue[];
  initial: { venueId: string | null; venueName: string | null; venueAddress: string | null; city: string | null };
  defaultCity?: string | null;
  errors: Record<string, string>;
}) {
  const [mode, setMode] = useState<Mode>(initial.venueId ? "saved" : initial.venueName || venues.length === 0 ? "new" : "saved");
  const [venueId, setVenueId] = useState(initial.venueId ?? venues[0]?.id ?? "");
  const [name, setName] = useState(initial.venueName ?? "");
  const [address, setAddress] = useState(initial.venueAddress ?? "");
  const [city, setCity] = useState(initial.city ?? defaultCity ?? "");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const saved = venues.find((v) => v.id === venueId) ?? null;

  const search = async () => {
    // Nominatim vrea adresa, nu numele localului: numele intră doar când nu avem adresă.
    const q = address.trim() ? [address, city].filter(Boolean).join(", ") : [name, city].filter(Boolean).join(", ");
    if (q.length < 3) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { hits: Hit[]; error?: string };
      setHits(data.hits ?? []);
      if (data.error) setSearchError(data.error);
      else if ((data.hits ?? []).length === 0) setSearchError("Nu am găsit adresa. Încearcă doar strada și orașul, sau pune pinul pe hartă.");
      if (data.hits?.[0]) setPos({ lat: data.hits[0].lat, lng: data.hits[0].lng });
    } catch {
      setSearchError("Căutarea nu a mers. Pune pinul pe hartă.");
    } finally {
      setSearching(false);
    }
  };

  const pick = (h: Hit) => {
    setPos({ lat: h.lat, lng: h.lng });
    if (!address && h.address) setAddress(h.address);
    if (!city && h.city) setCity(h.city);
    setHits([]);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-bold text-lg">Unde</h2>
      </div>
      <input type="hidden" name="venueMode" value={mode} />
      <input type="hidden" name="venueId" value={mode === "saved" ? venueId : ""} />
      <input type="hidden" name="lat" value={mode === "new" && pos ? String(pos.lat) : ""} />
      <input type="hidden" name="lng" value={mode === "new" && pos ? String(pos.lng) : ""} />

      <Field label="Locul" htmlFor="venueMode" hint="Un loc salvat apare pe hartă și are pagina lui, cu tot ce urmează acolo.">
        <Select
          id="venueMode"
          value={mode === "saved" ? `saved:${venueId}` : mode}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("saved:")) {
              setMode("saved");
              setVenueId(v.slice(6));
            } else setMode(v as Mode);
          }}
        >
          {venues.map((v) => (
            <option key={v.id} value={`saved:${v.id}`}>
              {v.name}
              {v.city ? ` · ${v.city}` : ""}
            </option>
          ))}
          <option value="new">Loc nou (îl pun pe hartă)</option>
          <option value="none">Fără loc deocamdată</option>
        </Select>
      </Field>

      {mode === "saved" && saved ? (
        <div className="rounded-(--radius-card) border border-line bg-surface p-4 flex items-center gap-4">
          <PinMap lat={saved.lat} lng={saved.lng} className="h-24 w-32 rounded-xl overflow-hidden shrink-0" />
          <div className="text-sm">
            <p className="font-bold">{saved.name}</p>
            <p className="text-muted">{[saved.address, saved.city].filter(Boolean).join(", ")}</p>
            <a href={`/loc/${saved.slug}`} target="_blank" className="text-stamp-deep font-medium hover:underline">
              Pagina locului
            </a>
          </div>
        </div>
      ) : null}

      {mode === "new" ? (
        <div className="space-y-4 rounded-(--radius-card) border border-line bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Numele locului" htmlFor="venueName" error={errors.venueName}>
              <Input id="venueName" name="venueName" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Nook, Expirat, Arenele Romane" />
            </Field>
            <Field label="Orașul" htmlFor="city" error={errors.city}>
              <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="București" />
            </Field>
          </div>
          <Field label="Adresa" htmlFor="venueAddress" error={errors.venueAddress}>
            <div className="flex gap-2">
              <Input id="venueAddress" name="venueAddress" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Strada, numărul" />
              <Button type="button" variant="secondary" onClick={search} disabled={searching} className="shrink-0">
                {searching ? "Caut…" : "Caută pe hartă"}
              </Button>
            </div>
          </Field>
          {searchError ? <p className="text-sm text-warn">{searchError}</p> : null}
          {hits.length > 1 ? (
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {hits.map((h, i) => (
                <li key={i}>
                  <button type="button" onClick={() => pick(h)} className="w-full text-left px-3 py-2 hover:bg-paper">
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <DragMap pos={pos ?? BUCHAREST} placed={pos != null} onChange={setPos} className="h-56 rounded-xl overflow-hidden border border-line" />
          <Hint>{pos ? "Trage pinul dacă nu e exact. Coordonatele se salvează odată cu evenimentul." : "Caută adresa sau apasă pe hartă ca să pui pinul. Fără pin, locul rămâne doar text și nu apare pe hartă."}</Hint>
        </div>
      ) : null}

      {mode === "none" ? (
        <>
          <input type="hidden" name="venueName" value="" />
          <input type="hidden" name="venueAddress" value="" />
          <Field label="Orașul" htmlFor="city" error={errors.city} hint="Ca evenimentul să apară la orașul potrivit, chiar și fără loc.">
            <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="București" />
          </Field>
        </>
      ) : null}
      {mode === "saved" ? <input type="hidden" name="city" value={saved?.city ?? city} /> : null}
    </section>
  );
}

// Hartă mică, fixă, cu un pin.
function PinMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { center: [lat, lng], zoom: 15, zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, attributionControl: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.marker([lat, lng], { icon: L.divIcon({ html: '<div class="pin" style="--pin:#5b3fd1"></div>', className: "leaflet-div-icon", iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);
  return <div ref={el} className={className} aria-hidden="true" />;
}

// Hartă cu pin care se trage; click pune pinul.
function DragMap({ pos, placed, onChange, className }: { pos: { lat: number; lng: number }; placed: boolean; onChange: (p: { lat: number; lng: number }) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      const map = L.map(el.current, { center: [pos.lat, pos.lng], zoom: placed ? 16 : 12 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Se creează o dată; pinul și centrul se actualizează mai jos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;
      if (!placed) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }
      if (!markerRef.current) {
        const m = L.marker([pos.lat, pos.lng], {
          draggable: true,
          icon: L.divIcon({ html: '<div class="pin" style="--pin:#5b3fd1;width:22px;height:22px"></div>', className: "leaflet-div-icon", iconSize: [22, 22], iconAnchor: [11, 11] }),
        }).addTo(map);
        m.on("dragend", () => {
          const ll = m.getLatLng();
          onChangeRef.current({ lat: ll.lat, lng: ll.lng });
        });
        markerRef.current = m;
        map.setView([pos.lat, pos.lng], 16);
      } else {
        markerRef.current.setLatLng([pos.lat, pos.lng]);
        if (!map.getBounds().contains([pos.lat, pos.lng])) map.panTo([pos.lat, pos.lng]);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pos, placed]);

  return <div ref={el} className={className} role="application" aria-label="Harta: pune pinul pe loc" />;
}
