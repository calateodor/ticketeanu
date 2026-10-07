import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventPage } from "@/components/event/event-page";
import { loadPublicEvent } from "@/lib/public-event";

export async function generateMetadata({ params }: PageProps<"/g/[code]">): Promise<Metadata> {
  const { code } = await params;
  const data = await loadPublicEvent({ groupCode: code });
  if (!data || !data.group) return { title: "Gașca" };
  return {
    title: `${data.group.name} · ${data.event.title}`,
    description: `${data.group.leaderName} ține ${data.group.holdQuantity} locuri la ${data.event.title}. Ia-ți locul până nu se eliberează.`,
    openGraph: { title: `${data.group.name} · ${data.event.title}`, images: [{ url: `/e/${data.event.slug}/opengraph-image` }] },
  };
}

export default async function GroupPage({ params }: PageProps<"/g/[code]">) {
  const { code } = await params;
  const data = await loadPublicEvent({ groupCode: code });
  if (!data || !data.group) notFound();
  if (data.event.status !== "published") notFound();
  return <EventPage data={data} preview={false} source="direct" />;
}
