import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizers } from "@/db/schema";
import { listCatalogItems } from "@/lib/catalog";
import { EventCard } from "@/components/event/event-card";
import { Reveals } from "@/components/motion/reveals";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export async function generateMetadata({ params }: PageProps<"/o/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [org] = await db.select().from(organizers).where(eq(organizers.slug, slug)).limit(1);
  return { title: org?.name ?? "Organizator", description: org?.description ?? undefined };
}

export default async function OrganizerPublicPage({ params }: PageProps<"/o/[slug]">) {
  const { slug } = await params;
  const [org] = await db.select().from(organizers).where(eq(organizers.slug, slug)).limit(1);
  if (!org) notFound();
  const items = await listCatalogItems({ organizerId: org.id });

  return (
    <div className="night min-h-dvh">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 pb-4">
        <section className="slide grain relative p-6 md:p-10 mt-6 text-white">
          <div className="flex items-center gap-5 relative z-10">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="size-20 rounded-2xl object-cover bg-black/20" />
            ) : (
              <div className="size-20 rounded-2xl grid place-items-center font-display font-extrabold text-3xl bg-white text-night">{org.name.slice(0, 1).toUpperCase()}</div>
            )}
            <div className="min-w-0">
              <p className="eyebrow text-white/75">Organizator</p>
              <h1 className="headline text-[clamp(2rem,7vw,4.5rem)] drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">{org.name}</h1>
            </div>
          </div>
          {org.description ? <p className="mt-4 max-w-xl relative z-10 font-medium text-white/90">{org.description}</p> : null}
          <div className="mt-4 flex gap-2 text-sm relative z-10">
            {org.brand?.instagram ? (
              <a href={`https://instagram.com/${org.brand.instagram}`} target="_blank" rel="noreferrer" className="rounded-full bg-white text-night px-4 py-2 font-bold">
                Instagram
              </a>
            ) : null}
            {org.brand?.website ? (
              <a href={org.brand.website} target="_blank" rel="noreferrer" className="rounded-full bg-white text-night px-4 py-2 font-bold">
                Site
              </a>
            ) : null}
          </div>
        </section>
        <h2 className="eyebrow mt-10 mb-4" data-reveal>
          Urmează
        </h2>
        {items.length === 0 ? (
          <p className="text-night-muted">Niciun eveniment anunțat încă.</p>
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
