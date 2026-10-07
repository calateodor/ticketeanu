import Link from "next/link";
import type { CatalogItem } from "@/lib/catalog-types";
import { formatDayShort, formatTime } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { categoryLabel, heatOf, vibeOf } from "@/lib/taxonomy";
import { cx } from "@/components/ui";

// Cardul de eveniment e un bilet: sus afișul și titlul, jos cotorul cu prețul, despărțite de linia
// de rupere cu crestături (.stub-top / .stub-bot). Stickerele spun ziua, reducerea și cât fierbe.
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
  const vibe = vibeOf(item.vibe);
  const where = distanceKm != null ? `la ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1).replace(".", ",")} km`}` : [item.venueName, item.city].filter(Boolean).join(", ");
  return (
    <Link
      href={`/e/${item.slug}?src=t`}
      data-event={item.id}
      data-reveal={reveal ? "" : undefined}
      onMouseEnter={onHover ? () => onHover(item.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      className="group block @container rounded-[20px]"
    >
      <div className={cx("transition-transform duration-200 ease-out", selected ? "stub-selected -translate-y-1" : "group-hover:-translate-y-1 group-hover:-rotate-1")}>
        <div className="stub-top p-2 pb-3">
          <div className={cx("grain relative overflow-hidden rounded-[14px]", compact ? "aspect-[16/10]" : "aspect-[4/3]")}>
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
            ) : (
              <div className="sunset absolute inset-0" />
            )}
            <span className="sticker sticker-white absolute top-2 left-2 text-[13px] [--tilt:-4deg]">{formatDayShort(starts)}</span>
            <span className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
              {item.discountPct ? <span className="sticker text-[13px] [--tilt:5deg]">-{item.discountPct}%</span> : null}
              {item.heat >= 2 ? <span className="sticker sticker-pink text-[12px] [--tilt:-3deg]">{heatOf(item.heat).label}</span> : null}
            </span>
          </div>
          <div className="px-1.5 pt-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-night-muted">
              {vibe ? <span className="size-1.5 shrink-0 rounded-full" style={{ background: vibe.color }} aria-hidden="true" /> : null}
              <span className="truncate">
                {categoryLabel(item.category)}
                {vibe ? ` · ${vibe.label}` : ""}
              </span>
            </p>
            <p className="headline mt-1 text-[clamp(1.35rem,10cqw,2.1rem)] line-clamp-2 text-white">{item.title}</p>
            <p className="mt-1.5 text-[13px] text-white/70 truncate">
              {formatTime(starts)}
              {where ? ` · ${where}` : ""}
            </p>
          </div>
        </div>
        <div className="stub-bot relative flex items-center justify-between gap-2 px-3.5 pt-3 pb-3.5">
          <span className="absolute left-4 right-4 top-0 border-t-2 border-dashed border-white/20" aria-hidden="true" />
          <p className="min-w-0 leading-none">
            {item.minPrice ? <span className="block text-[10px] font-semibold uppercase tracking-wider text-night-muted">de la</span> : null}
            <span className="headline text-[1.6rem] text-white">{item.minPrice == null ? "—" : item.minPrice === 0 ? "Gratuit" : formatLei(item.minPrice)}</span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white text-night pl-1 @[200px]:pl-3 pr-1 py-1 text-xs font-extrabold transition-colors group-hover:bg-lime">
            <span className="hidden @[200px]:inline">Ia bilet</span>
            <span className="grid size-6 place-items-center rounded-full bg-night text-white transition-transform duration-200 group-hover:-rotate-45" aria-hidden="true">
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
