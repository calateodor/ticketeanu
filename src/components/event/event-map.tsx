"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { vibeOf, type HeatLevel } from "@/lib/taxonomy";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  vibe: string | null;
  heat: HeatLevel;
  title: string;
};

type Props = {
  points: MapPoint[];
  center: { lat: number; lng: number };
  zoom?: number;
  fitAll?: boolean; // încadrează toate pinurile (când nu știm unde e omul)
  frame?: { lat: number; lng: number }[] | null; // încadrează exact punctele astea (omul + ce e aproape de el)
  userPos?: { lat: number; lng: number } | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  interactive?: boolean;
};

type Leaflet = typeof import("leaflet");
type LatLng = { lat: number; lng: number };
type View = { points: MapPoint[]; center: LatLng; zoom: number; fitAll: boolean; frame: LatLng[] | null; userPos: LatLng | null; selectedId: string | null };

// Dalele standard OpenStreetMap: fără cheie. Se întunecă din CSS (.map-dark) pe paginile de noapte.
// În producție, la trafic mare, se trece pe un furnizor cu cheie (MapTiler, Stadia) sau pe dale proprii.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Harta e doar pe client (Leaflet are nevoie de window): se încarcă în efect, asincron.
// Starea dorită stă într-un ref și se aplică și imediat după ce harta există, și la fiecare schimbare.
export function EventMap({ points, center, zoom = 12, fitAll = false, frame = null, userPos, selectedId, onSelect, className, interactive = true }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const userRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const viewRef = useRef<View>({ points, center, zoom, fitAll, frame, userPos: userPos ?? null, selectedId: selectedId ?? null });
  const framedRef = useRef<string>(""); // ultimul cadru aplicat, ca să nu re-încadrăm la fiecare randare
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Pinurile: adaugă, actualizează, scoate.
  const syncMarkers = (L: Leaflet, map: LeafletMap, v: View) => {
    const seen = new Set<string>();
    for (const p of v.points) {
      seen.add(p.id);
      const color = vibeOf(p.vibe)?.color ?? "#8a3dff";
      const html = `<div class="pin ${p.heat >= 2 ? "pin-hot" : ""} ${p.id === v.selectedId ? "pin-selected" : ""}" style="--pin:${color}"></div>`;
      const icon = L.divIcon({ html, className: "leaflet-div-icon", iconSize: [18, 18], iconAnchor: [9, 9] });
      let m = markersRef.current.get(p.id);
      if (!m) {
        m = L.marker([p.lat, p.lng], { icon, title: p.title, keyboard: true }).addTo(map);
        m.on("click", () => onSelectRef.current?.(p.id));
        markersRef.current.set(p.id, m);
      } else {
        m.setIcon(icon);
        m.setLatLng([p.lat, p.lng]);
      }
      m.setZIndexOffset(p.id === v.selectedId ? 1000 : 0);
    }
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
    if (v.userPos) {
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:999px;background:#fff;border:3px solid #3dd6ff;box-shadow:0 0 0 6px rgba(61,214,255,.25)"></div>`,
        className: "leaflet-div-icon",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      if (!userRef.current) userRef.current = L.marker([v.userPos.lat, v.userPos.lng], { icon, interactive: false }).addTo(map);
      else userRef.current.setLatLng([v.userPos.lat, v.userPos.lng]);
    } else if (userRef.current) {
      userRef.current.remove();
      userRef.current = null;
    }
  };

  // Cadrul: punctele cerute (omul + ce e lângă el), toate pinurile sau centrul cerut.
  const syncView = (map: LeafletMap, v: View) => {
    const list = (pts: LatLng[]) => pts.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
    const key = v.frame?.length ? `frame:${list(v.frame)}` : v.fitAll ? `fit:${list(v.points)}` : `center:${list([v.center])},${v.zoom}`;
    if (key === framedRef.current) return;
    framedRef.current = key;
    const coords = (v.frame?.length ? v.frame : v.fitAll ? v.points : []).map((p) => [p.lat, p.lng] as [number, number]);
    if (coords.length > 1) map.fitBounds(coords, { padding: [48, 48], maxZoom: 14 });
    else if (coords.length === 1) map.setView(coords[0], 13);
    else map.flyTo([v.center.lat, v.center.lng], v.zoom, { duration: 0.6 });
  };

  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;
    import("leaflet").then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      const v = viewRef.current;
      const map = L.map(elRef.current, {
        center: [v.center.lat, v.center.lng],
        zoom: v.zoom,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        attributionControl: true,
      });
      L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      syncMarkers(L, map, v);
      syncView(map, v);
      // Pe telefon harta se creează ascunsă (fila „Listă”), cu mărimea zero. Când apare sau își
      // schimbă mărimea, Leaflet o remăsoară; dacă era ascunsă, cadrul se aplică din nou.
      const ro = new ResizeObserver(() => {
        const was = map.getSize();
        map.invalidateSize();
        if (was.x === 0 || was.y === 0) {
          framedRef.current = "";
          syncView(map, viewRef.current);
        }
      });
      ro.observe(elRef.current);
      roRef.current = ro;
    });
    return () => {
      cancelled = true;
      roRef.current?.disconnect();
      roRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
      userRef.current = null;
    };
    // Harta se creează o dată; schimbările ulterioare trec prin efectul de mai jos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v: View = { points, center, zoom, fitAll, frame, userPos: userPos ?? null, selectedId: selectedId ?? null };
    viewRef.current = v;
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    syncMarkers(L, map, v);
    syncView(map, v);
  }, [points, center, zoom, fitAll, frame, userPos, selectedId]);

  return <div ref={elRef} className={`map-dark ${className ?? ""}`} role="region" aria-label="Harta evenimentelor" />;
}
