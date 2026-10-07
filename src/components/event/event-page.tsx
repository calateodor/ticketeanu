import Link from "next/link";
import type { CSSProperties } from "react";
import { formatDay, formatDayShort, formatTime, nowMs } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { formatLei } from "@/lib/money";
import type { PublicEvent } from "@/lib/public-event";
import { Reveals } from "@/components/motion/reveals";
import { SiteHeader } from "@/components/site/site-header";
import { heatOf } from "@/lib/taxonomy";
import { Checkout, type CheckoutRule, type CheckoutType } from "./checkout";
import { CategoryChip, HeatMeter, VibeChip } from "./chips";
import { ShareButtons } from "./share-buttons";
import { StickyCta } from "./sticky-cta";

export function EventPage({ data, preview, source }: { data: PublicEvent; preview: boolean; source: "direct" | "ticketeanu" }) {
  const { event, organizer, venue, types, settings, feeBearer, feeBps, group, offer, prCode, accent, rules, publicPromos, demand } = data;
  const url = siteUrl(`/e/${event.slug}`);
  const visibleTypes = types.filter((t) => !t.type.hidden || (group && group.ticketTypeId === t.type.id) || (offer && offer.ticketTypeId === t.type.id));
  const allSoldOut = visibleTypes.length > 0 && visibleTypes.every((t) => !t.onSale && t.reason === "Epuizat");
  const anyOnSale = visibleTypes.some((t) => t.onSale);
  const minPrice = Math.min(...visibleTypes.filter((t) => t.onSale).map((t) => t.priceBani), Number.POSITIVE_INFINITY);
  // „Ultimele locuri” doar când se apropie de capăt ceva mare, nu pentru o masă de 8.
  const lowSeats = visibleTypes.some((t) => t.onSale && t.remaining != null && t.remaining > 0 && t.remaining <= 10 && (t.type.capacity == null || t.type.capacity >= 20));
  const venueName = venue?.name ?? event.venueName;
  const venueAddress = venue?.address ?? event.venueAddress;
  const city = venue?.city ?? event.city;
  const where = [venueName, venueAddress, city].filter(Boolean).join(", ");
  const mapsUrl = where ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}` : null;
  const isPast = (event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 3_600_000)).getTime() < nowMs();
  const bestPct = Math.max(
    0,
    ...visibleTypes.map((t) => (t.type.compareAtBani && t.type.compareAtBani > t.priceBani ? Math.round(((t.type.compareAtBani - t.priceBani) * 100) / t.type.compareAtBani) : 0)),
    ...rules.filter((r) => r.type === "percent" && r.kind !== "audience").map((r) => r.value),
  );

  const checkoutTypes: CheckoutType[] = visibleTypes.map((t) => ({
    id: t.type.id,
    name: t.type.name,
    description: t.type.description,
    mode: t.type.mode,
    phaseName: t.phase?.name ?? null,
    priceBani: t.priceBani,
    compareAtBani: t.type.compareAtBani,
    paidNowBani: t.paidNowBani,
    dueAtDoorBani: t.dueAtDoorBani,
    remaining: t.remaining,
    onSale: t.onSale,
    reason: t.reason ?? null,
    minPerOrder: t.type.minPerOrder,
    maxPerOrder: t.type.maxPerOrder,
    lowSeatsHint: t.type.capacity == null || t.type.capacity >= 20,
  }));
  const checkoutRules: CheckoutRule[] = rules.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    type: r.type,
    value: r.value,
    minQuantity: r.minQuantity,
    endsAt: r.endsAt?.getTime() ?? null,
    proofHint: r.proofHint,
  }));

  const starts = event.startsAt;

  return (
    <div className="night min-h-dvh" style={{ "--accent": accent } as CSSProperties}>
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-3 md:px-4 pt-3 pb-28 lg:pb-12">
        {/* Anunțurile de stare stau deasupra, pe toată lățimea. */}
        {preview && event.status !== "published" ? (
          <p className="mb-3 rounded-2xl bg-warn-soft text-[#854f0b] text-sm px-4 py-2.5">Doar tu vezi pagina asta. Publică evenimentul din panou ca să poată rezerva și alții.</p>
        ) : null}
        {event.status === "cancelled" ? (
          <p className="mb-3 rounded-2xl bg-danger-soft text-[#a32d2d] text-sm px-4 py-2.5">Evenimentul a fost anulat. Dacă ai plătit online, banii se întorc integral.</p>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[1.05fr_1fr] items-start">
          {/* Afișul: pe desktop stă pe loc cât derulezi rezervarea. */}
          <section className="grain relative overflow-hidden rounded-[1.75rem] aspect-[5/6] sm:aspect-[4/5] lg:aspect-auto lg:h-[calc(100dvh-6.5rem)] lg:min-h-[560px] lg:sticky lg:top-20">
            {event.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="sunset absolute inset-0" aria-hidden="true" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-night via-night/60 to-transparent" />
            <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
              <span className="sticker sticker-white text-base md:text-lg [--tilt:-4deg]">{formatDayShort(starts)}</span>
              {bestPct ? <span className="sticker text-base md:text-lg [--tilt:5deg]">-{bestPct}%</span> : null}
            </div>
            {allSoldOut || lowSeats || demand.heat >= 2 ? (
              <span className="sticker sticker-pink absolute right-4 top-4 text-base md:text-lg [--tilt:6deg]">{allSoldOut ? "Sold out" : lowSeats ? "Ultimele locuri" : heatOf(demand.heat).label}</span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
              <p className="text-sm font-semibold text-white/80">
                <Link href={`/o/${organizer.slug}`} className="underline decoration-white/30 underline-offset-2 hover:text-white">
                  {organizer.name}
                </Link>{" "}
                prezintă
              </p>
              <h1 className="headline mt-2 text-[clamp(2.8rem,11vw,6.2rem)] lg:text-[clamp(3.4rem,5.4vw,6.2rem)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">{event.title}</h1>
              {event.subtitle ? <p className="mt-2 text-lg font-medium text-white/90">{event.subtitle}</p> : null}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <CategoryChip category={event.category} />
                <VibeChip vibe={event.vibe} />
                {demand.heat < 2 ? <HeatMeter level={demand.heat} /> : null}
              </div>
            </div>
          </section>

          <div className="space-y-3 min-w-0">
            {/* Când și unde: două cutii, citite dintr-o privire. */}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-night-2 ring-1 ring-white/10 px-4 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-lime">Când</dt>
                <dd className="mt-0.5 font-bold text-base leading-snug">
                  {formatDay(starts)}, {formatTime(starts)}
                </dd>
                {event.doorsAt ? <dd className="text-white/60">ușile de la {formatTime(event.doorsAt)}</dd> : null}
              </div>
              <div className="rounded-2xl bg-night-2 ring-1 ring-white/10 px-4 py-3 min-w-0">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-lime">Unde</dt>
                <dd className="mt-0.5 font-bold text-base leading-snug truncate">
                  {venueName && venue ? (
                    <Link href={`/loc/${venue.slug}`} className="hover:underline">
                      {venueName}
                    </Link>
                  ) : (
                    (venueName ?? city ?? "Se anunță")
                  )}
                </dd>
                <dd className="text-white/60 truncate">
                  {[venueAddress, venueName ? city : null].filter(Boolean).join(", ")}
                  {mapsUrl ? (
                    <>
                      {" "}
                      <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-white underline decoration-white/30 underline-offset-2">
                        cum ajung
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
              {Number.isFinite(minPrice) || settings.ageMin ? (
                <div className="col-span-2 flex flex-wrap gap-2">
                  {Number.isFinite(minPrice) ? (
                    <span className="rounded-full bg-night-2 ring-1 ring-white/10 px-3 py-1.5 font-semibold">{minPrice > 0 ? `de la ${formatLei(minPrice)}, preț final` : "intrare gratuită"}</span>
                  ) : null}
                  {settings.ageMin ? <span className="rounded-full bg-night-2 ring-1 ring-white/10 px-3 py-1.5 font-semibold">acces {settings.ageMin}+</span> : null}
                </div>
              ) : null}
            </dl>

            {group ? (
              <div className="rounded-2xl bg-lime text-night px-4 py-3">
                <p className="headline text-2xl">{group.name}</p>
                <p className="text-sm font-medium">
                  {group.leaderName} ține {group.holdQuantity} locuri. {group.claimed} luate, {group.free} libere, până {formatDay(group.holdExpiresAt).toLowerCase()} la {formatTime(group.holdExpiresAt)}.
                </p>
              </div>
            ) : null}
            {offer ? (
              <div className="rounded-2xl bg-lime text-night px-4 py-3">
                <p className="headline text-2xl">Ți-am păstrat {offer.quantity === 1 ? "un loc" : `${offer.quantity} locuri`}</p>
                <p className="text-sm font-medium">De pe lista de așteptare. Ia-le până la ora {formatTime(offer.expiresAt)}.</p>
              </div>
            ) : null}

            <section id="bilete" className="scroll-mt-20 rounded-[1.75rem] bg-night-2 ring-1 ring-white/10 p-4 md:p-6">
              {event.status === "published" && !isPast ? (
                <Checkout
                  eventId={event.id}
                  eventSlug={event.slug}
                  types={checkoutTypes}
                  feeBearer={feeBearer}
                  feeBps={feeBps}
                  askPhone={settings.askPhone}
                  groupEnabled={settings.groupEnabled && !group}
                  groupHoldHours={settings.groupHoldHours}
                  waitlistEnabled={settings.waitlistEnabled}
                  group={group ? { code: group.code, ticketTypeId: group.ticketTypeId, free: group.free, name: group.name } : null}
                  offerToken={offer?.token ?? null}
                  prCode={prCode}
                  source={source}
                  organizerName={organizer.name}
                  rules={checkoutRules}
                  publicPromos={publicPromos}
                />
              ) : isPast ? (
                <p className="text-white/80">
                  Evenimentul a avut loc. Vezi ce mai urmează la{" "}
                  <Link href={`/o/${organizer.slug}`} className="underline">
                    {organizer.name}
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-white/80">Rezervările nu sunt deschise încă.</p>
              )}
            </section>

            {event.description ? (
              <section className="rounded-[1.75rem] bg-night-2 ring-1 ring-white/10 p-5 md:p-6" data-reveal>
                <h2 className="headline text-3xl">Despre</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-[15px] text-white/90">{event.description}</p>
              </section>
            ) : null}

            <section className="rounded-[1.75rem] bg-night-2 ring-1 ring-white/10 p-5 md:p-6" data-reveal>
              <p className="text-[11px] font-bold uppercase tracking-wider text-lime">Organizator</p>
              <p className="headline mt-1 text-3xl">{organizer.name}</p>
              {organizer.description ? <p className="mt-1 text-sm text-white/70">{organizer.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                <Link href={`/o/${organizer.slug}`} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">
                  Toate evenimentele
                </Link>
                {organizer.brand?.instagram ? (
                  <a href={`https://instagram.com/${organizer.brand.instagram}`} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">
                    Instagram
                  </a>
                ) : null}
                {organizer.contactEmail ? (
                  <a href={`mailto:${organizer.contactEmail}`} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">
                    Scrie-ne
                  </a>
                ) : null}
              </div>
              <div className="mt-4">
                <ShareButtons url={url} title={event.title} dark />
              </div>
            </section>

            <p className="px-2 text-xs text-night-muted">Rezervările și biletele sunt emise prin Ticketeanu, în numele organizatorului. Prețul afișat este prețul plătit; nu apar taxe la final.</p>
          </div>
        </div>
      </main>
      <Reveals />

      {event.status === "published" && !isPast && (anyOnSale || allSoldOut) ? (
        <StickyCta
          priceLabel={Number.isFinite(minPrice) && minPrice > 0 ? "de la" : "intrare"}
          priceValue={Number.isFinite(minPrice) && minPrice > 0 ? formatLei(minPrice) : allSoldOut ? "sold out" : "gratuită"}
          buttonLabel={allSoldOut ? "Lista de așteptare" : "Rezervă"}
        />
      ) : null}
    </div>
  );
}
