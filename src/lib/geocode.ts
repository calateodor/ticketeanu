import "server-only";

// Căutare de adrese prin Nominatim (OpenStreetMap). Gratuit, cu limită de un
// apel pe secundă și cu User-Agent obligatoriu. Îl folosește doar organizatorul,
// o dată, când își salvează un loc; nu rulează pe paginile publice.

export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
  city: string | null;
  address: string | null;
};

type NominatimRow = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string | undefined>;
};

export async function searchAddress(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "ro");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url, {
    headers: {
      "User-Agent": `Ticketeanu/0.1 (${process.env.GEOCODE_CONTACT ?? "contact@ticketeanu.ro"})`,
      "Accept-Language": "ro",
    },
    // Rezultatele nu se schimbă de la un minut la altul; nu lovim serviciul de două ori pentru aceeași căutare.
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as NominatimRow[];
  return rows.map((r) => {
    const a = r.address ?? {};
    const street = [a.road, a.house_number].filter(Boolean).join(" ");
    return {
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null,
      address: street || null,
    };
  });
}
