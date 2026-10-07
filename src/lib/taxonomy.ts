// Categorii, vibe și „căldură”: vocabularul comun al hărții, al catalogului și al panoului.
// Fără "server-only": se folosește și în componente client și în seed.

export const CATEGORIES = [
  { key: "petrecere", label: "Petrecere" },
  { key: "concert", label: "Concert" },
  { key: "festival", label: "Festival" },
  { key: "standup", label: "Stand-up" },
  { key: "teatru", label: "Teatru" },
  { key: "sport", label: "Sport" },
  { key: "workshop", label: "Workshop" },
  { key: "conferinta", label: "Conferință" },
  { key: "familie", label: "Copii & familie" },
  { key: "altceva", label: "Altceva" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]];

export function categoryLabel(key: string | null | undefined): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? "Altceva";
}

export function isCategory(key: unknown): key is CategoryKey {
  return typeof key === "string" && CATEGORY_KEYS.includes(key as CategoryKey);
}

// Vibe-ul îl alege organizatorul. Spune cum e seara, nu cât de cerută e.
export const VIBES = [
  { key: "hot", label: "Hot", hint: "Tare, aglomerat, se dansează.", color: "#FF4D6D" },
  { key: "chill", label: "Chill", hint: "Relaxat, se stă, se vorbește.", color: "#3DD6FF" },
  { key: "mixt", label: "Mixt", hint: "Începe chill, se încinge pe parcurs.", color: "#8A3DFF" },
] as const;

export type VibeKey = (typeof VIBES)[number]["key"];
export const VIBE_KEYS = VIBES.map((v) => v.key) as [VibeKey, ...VibeKey[]];

export function vibeOf(key: string | null | undefined) {
  return VIBES.find((v) => v.key === key) ?? null;
}

export function isVibe(key: unknown): key is VibeKey {
  return typeof key === "string" && VIBE_KEYS.includes(key as VibeKey);
}

// Căldura o calculează platforma din cerere: locuri luate în ultimele 48 de ore
// și cât din capacitate e ocupat. Organizatorul nu o poate seta.
export type HeatLevel = 0 | 1 | 2 | 3;

export const HEAT = [
  { level: 0, label: "Liniște", hint: "Se rezervă în ritm normal." },
  { level: 1, label: "Se mișcă", hint: "Au început rezervările." },
  { level: 2, label: "Se încinge", hint: "Multe rezervări în ultimele două zile." },
  { level: 3, label: "Fierbe", hint: "Se umple repede; nu lăsa pe mâine." },
] as const;

export function heatLevel(seats48h: number, occupancy: number | null): HeatLevel {
  const occ = occupancy ?? 0;
  if (seats48h >= 40 || occ >= 0.85) return 3;
  if (seats48h >= 12 || occ >= 0.6) return 2;
  if (seats48h >= 3 || occ >= 0.3) return 1;
  return 0;
}

export function heatOf(level: HeatLevel) {
  return HEAT[level];
}
