import Link from "next/link";
import { requireEventAccess } from "@/lib/panel";
import { formatDay, formatTime } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { Badge } from "@/components/ui";
import { EventHeaderActions } from "./header-actions";
import { EventTabs } from "./tabs";

export default async function EventLayout({ children, params }: LayoutProps<"/panou/evenimente/[id]">) {
  const { id } = await params;
  const { event } = await requireEventAccess(id);
  const publicUrl = siteUrl(`/e/${event.slug}`);
  const tone = event.status === "published" ? "ok" : event.status === "cancelled" ? "danger" : "neutral";
  const label = event.status === "published" ? "Publicat" : event.status === "cancelled" ? "Anulat" : event.status === "ended" ? "Încheiat" : "Ciornă";

  return (
    <div>
      <p className="text-sm text-muted mb-2">
        <Link href="/panou" className="hover:underline">
          Evenimente
        </Link>{" "}
        / {event.title}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">{event.title}</h1>
            <Badge tone={tone}>{label}</Badge>
          </div>
          <p className="text-muted mt-1">
            {formatDay(event.startsAt)}, ora {formatTime(event.startsAt)}
            {event.venueName ? ` · ${event.venueName}` : ""}
            {event.city ? `, ${event.city}` : ""}
          </p>
          <p className="text-sm mt-1">
            <a href={publicUrl} target="_blank" className="text-stamp-deep font-medium hover:underline break-all">
              {publicUrl.replace(/^https?:\/\//, "")}
            </a>
          </p>
        </div>
        <EventHeaderActions eventId={event.id} status={event.status} publicUrl={publicUrl} />
      </div>
      <EventTabs eventId={event.id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
