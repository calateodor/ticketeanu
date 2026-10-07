import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventPage } from "@/components/event/event-page";
import { getCurrentUser, listUserOrganizers } from "@/lib/auth";
import { formatDay, formatTime } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { loadPublicEvent } from "@/lib/public-event";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicEvent({ slug });
  if (!data) return { title: "Eveniment" };
  const { event, organizer } = data;
  const when = `${formatDay(event.startsAt)}, ${formatTime(event.startsAt)}`;
  const where = [event.venueName, event.city].filter(Boolean).join(", ");
  const description = [event.subtitle, when, where, `Organizat de ${organizer.name}`].filter(Boolean).join(" · ");
  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      url: siteUrl(`/e/${event.slug}`),
      images: [{ url: siteUrl(`/e/${event.slug}/opengraph-image`), width: 1200, height: 630 }],
      locale: "ro_RO",
      siteName: "Ticketeanu",
    },
    twitter: { card: "summary_large_image", title: event.title, description },
  };
}

export default async function PublicEventPage({ params, searchParams }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await loadPublicEvent({
    slug,
    prCode: typeof sp.pr === "string" ? sp.pr : null,
    offerToken: typeof sp.oferta === "string" ? sp.oferta : null,
  });
  if (!data) notFound();

  // Ciornele se văd doar de organizatorul lor.
  let canPreview = false;
  if (data.event.status !== "published") {
    const user = await getCurrentUser();
    if (user) {
      const mine = await listUserOrganizers(user.id);
      canPreview = mine.some((m) => m.organizer.id === data.organizer.id);
    }
    if (!canPreview && data.event.status === "draft") notFound();
  }

  return <EventPage data={data} preview={canPreview} source={typeof sp.src === "string" && sp.src === "t" ? "ticketeanu" : "direct"} />;
}
