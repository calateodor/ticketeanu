import { listCatalogItems, listCities } from "@/lib/catalog";
import { isCategory, isVibe } from "@/lib/taxonomy";
import { Reveals } from "@/components/motion/reveals";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Catalog } from "./catalog";

export const metadata = { title: "Evenimente lângă tine", description: "Harta petrecerilor, concertelor și evenimentelor cu rezervare pe Ticketeanu: ce e hot, ce e chill, ce are reduceri." };

export default async function CatalogPage({ searchParams }: PageProps<"/evenimente">) {
  const sp = await searchParams;
  const category = isCategory(sp.categorie) ? sp.categorie : null;
  const vibe = isVibe(sp.vibe) ? sp.vibe : null;
  const city = typeof sp.oras === "string" ? sp.oras : null;
  const [items, cities] = await Promise.all([listCatalogItems(), listCities()]);

  return (
    <div className="night min-h-dvh">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-4 pb-4 pt-8">
        <Catalog items={items} cities={cities} initial={{ category, vibe, discounted: sp.reduceri === "1", city, map: sp.harta === "1", q: typeof sp.q === "string" ? sp.q : null }} />
      </main>
      <SiteFooter />
      <Reveals />
    </div>
  );
}
