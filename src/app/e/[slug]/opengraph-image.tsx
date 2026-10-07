import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, images, organizers } from "@/db/schema";
import { formatDay, formatTime } from "@/lib/dates";

export const alt = "Eveniment pe Ticketeanu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db
    .select({ event: events, organizer: organizers })
    .from(events)
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(eq(events.slug, slug))
    .limit(1);
  const event = row?.event;
  const accent = event?.theme?.accent ?? row?.organizer.brand?.accent ?? "#5B3FD1";
  const title = event?.title ?? "Ticketeanu";
  const when = event ? `${formatDay(event.startsAt)}, ora ${formatTime(event.startsAt)}` : "";
  const where = event ? [event.venueName, event.city].filter(Boolean).join(", ") : "";
  // Afișul urcat la noi se citește direct din bază (fără drum prin rețea până la /img).
  let cover = event?.coverUrl ?? null;
  const own = cover?.match(/^\/img\/([A-Za-z0-9_-]+)$/);
  if (own) {
    const [img] = await db.select({ contentType: images.contentType, data: images.data }).from(images).where(eq(images.id, own[1])).limit(1);
    cover = img ? `data:${img.contentType};base64,${Buffer.from(img.data).toString("base64")}` : null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#120A1F",
          color: "#fff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Paleta site-ului (docs/directie-vizuala.md); accentul organizatorului apare doar pe ștampila T. */}
        <div style={{ position: "absolute", left: -200, top: -250, width: 800, height: 800, borderRadius: 9999, background: "#FF2E8A", opacity: 0.5, filter: "blur(10px)" }} />
        <div style={{ position: "absolute", right: -250, bottom: -300, width: 700, height: 700, borderRadius: 9999, background: "#7B2FE0", opacity: 0.45 }} />
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={420} height={525} style={{ position: "absolute", right: 60, top: 52, width: 420, height: 525, objectFit: "cover", borderRadius: 28 }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 64, width: cover ? 700 : 1100, height: "100%" }}>
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: "uppercase", opacity: 0.8, display: "flex" }}>{row?.organizer.name ?? ""}</div>
          <div style={{ fontSize: title.length > 40 ? 56 : 76, fontWeight: 800, lineHeight: 1.05, marginTop: 12, display: "flex" }}>{title}</div>
          <div style={{ fontSize: 30, marginTop: 20, opacity: 0.9, display: "flex" }}>{when}</div>
          {where ? <div style={{ fontSize: 30, opacity: 0.7, display: "flex" }}>{where}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 36, fontSize: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, border: `4px solid ${accent}`, borderRadius: 10, color: accent, fontWeight: 900, transform: "rotate(-6deg)" }}>
              T
            </div>
            <span>Rezervă pe Ticketeanu</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
