import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueBySlug, listCatalogItems } from "@/lib/catalog";
import { EventCard } from "@/components/event/event-card";
import { EventMap } from "@/components/event/event-map";
import { Reveals } from "@/components/motion/reveals";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export async function generateMetadata({ params }: PageProps<"/loc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const v = await getVenueBySlug(slug);
  return { title: v ? `${v.name} · evenimente` : "Loc", description: v ? `Ce urmează la ${v.name}${v.city ? `, ${v.city}` : ""}.` : undefined };
}

export default async function VenuePage({ params }: PageProps<"/loc/[slug]">) {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();
  const items = await listCatalogItems({ venueId: venue.id });
  const where = [venue.address, venue.city].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${where}`)}`;

  return (
    <div className="night min-h-dvh">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 pb-4">
        <section className="grid md:grid-cols-[1fr_minmax(280px,40%)] gap-6 items-start mt-10">
          <div>
            <p className="eyebrow">Loc</p>
            <h1 className="headline text-[clamp(2.4rem,8vw,5rem)] mt-1">{venue.name}</h1>
            {where ? <p className="mt-3 text-night-muted">{where}</p> : null}
            {venue.description ? <p className="mt-2 max-w-xl text-white/85">{venue.description}</p> : null}
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block glass rounded-full px-4 py-2 text-sm font-bold hover:bg-white/15">
              Cum ajung
            </a>
          </div>
          <EventMap points={[{ id: venue.id, lat: venue.lat, lng: venue.lng, vibe: null, heat: 0, title: venue.name }]} center={{ lat: venue.lat, lng: venue.lng }} zoom={15} interactive={false} className="h-56 md:h-64 rounded-3xl overflow-hidden border border-white/10" />
        </section>

        <h2 className="eyebrow mt-10 mb-4" data-reveal>
          Urmează aici
        </h2>
        {items.length === 0 ? (
          <p className="text-night-muted">Nimic anunțat încă.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((i) => (
              <EventCard key={i.id} item={i} reveal />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
      <Reveals />
    </div>
  );
}
