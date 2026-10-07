import Link from "next/link";
import type { CatalogItem } from "@/lib/catalog-types";
import { formatDayShort, formatTime } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { cx } from "@/components/ui";
import { CategoryChip, DiscountBadge, HeatMeter, VibeChip } from "./chips";

export function EventCard({
  item,
  distanceKm,
  selected = false,
  onHover,
  compact = false,
  reveal = false,
}: {
  item: CatalogItem;
  distanceKm?: number | null;
  selected?: boolean;
  onHover?: (id: string | null) => void;
  compact?: boolean;
  reveal?: boolean; // intră în ecran cu GSAP (doar pe paginile statice, nu în lista filtrată)
}) {
  const starts = new Date(item.startsAt);
  const day = starts.toLocaleDateString("ro-RO", { day: "numeric", timeZone: "Europe/Bucharest" });
  const month = starts.toLocaleDateString("ro-RO", { month: "short", timeZone: "Europe/Bucharest" }).replace(".", "");
  return (
    <Link
      href={`/e/${item.slug}?src=t`}
      data-event={item.id}
      data-reveal={reveal ? "" : undefined}
      onMouseEnter={onHover ? () => onHover(item.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      className={cx(
        "group block rounded-3xl overflow-hidden border bg-night-2 transition-[transform,border-color,box-shadow] duration-200",
        selected ? "border-white/70 shadow-[0_0_0_3px_rgba(255,255,255,0.25)] -translate-y-0.5" : "border-white/10 hover:border-white/30 hover:-translate-y-0.5",
      )}
    >
      <div className={cx("grain relative overflow-hidden", compact ? "aspect-[16/10]" : "aspect-[4/5]")}>
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="sunset absolute inset-0">
            <p className="headline absolute left-4 right-4 bottom-4 text-[clamp(1.6rem,6cqw,2.6rem)] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">{item.title}</p>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
        <div className="absolute top-3 left-3 rounded-xl bg-white/95 text-ink px-2.5 py-1.5 text-center leading-none shadow">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted">{month}</p>
          <p className="font-display font-extrabold text-xl">{day}</p>
        </div>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          <DiscountBadge pct={item.discountPct} />
          {item.heat >= 2 ? <HeatMeter level={item.heat} /> : null}
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <CategoryChip category={item.category} />
          <VibeChip vibe={item.vibe} />
          {item.heat < 2 ? <HeatMeter level={item.heat} withLabel={false} /> : null}
        </div>
        <p className="font-display font-extrabold text-lg leading-tight text-white">{item.title}</p>
        <p className="text-sm mt-1 text-night-muted">
          {formatDayShort(starts)}, {formatTime(starts)}
          {item.venueName ? ` · ${item.venueName}` : ""}
          {distanceKm != null ? ` · la ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1).replace(".", ",")} km`}` : item.city ? `, ${item.city}` : ""}
        </p>
        <p className="text-sm mt-1.5 flex items-center justify-between gap-2">
          <span className="text-night-muted truncate">{item.organizerName}</span>
          <span className="font-bold text-white shrink-0">{item.minPrice == null ? "" : item.minPrice === 0 ? "gratuit" : `de la ${formatLei(item.minPrice)}`}</span>
        </p>
      </div>
    </Link>
  );
}
