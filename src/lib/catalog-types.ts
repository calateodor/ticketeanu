// Forma serializabilă a unui eveniment din catalog: merge din componentele server
// în cele client (hartă, filtre) fără Date sau obiecte Drizzle.
import type { HeatLevel } from "./taxonomy";

export type CatalogItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  accent: string;
  startsAt: number; // ms
  venueName: string | null;
  venueSlug: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  category: string;
  vibe: string | null;
  heat: HeatLevel;
  discountPct: number | null;
  hasDiscount: boolean;
  minPrice: number | null;
  organizerName: string;
  organizerSlug: string;
};
