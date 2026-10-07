import Link from "next/link";
import type { CSSProperties } from "react";
import { formatDay, formatTime, nowMs } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { formatLei } from "@/lib/money";
import type { PublicEvent } from "@/lib/public-event";
import { Reveals } from "@/components/motion/reveals";
import { SiteHeader } from "@/components/site/site-header";
import { Stamp } from "@/components/ui";
import { Checkout, type CheckoutRule, type CheckoutType } from "./checkout";
import { CategoryChip, DiscountBadge, HeatMeter, VibeChip } from "./chips";
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

  return (
    <div className="night min-h-dvh" style={{ "--accent": accent } as CSSProperties}>
      <SiteHeader />

      <main className="max-w-xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        <p className="eyebrow mb-3">
          <Link href={`/o/${organizer.slug}`} className="hover:text-white">
            {organizer.name}
          </Link>{" "}
          prezintă
        </p>
        {preview && event.status !== "published" ? (
          <p className="mb-4 rounded-xl bg-warn-soft text-[#854f0b] text-sm px-4 py-2.5">
            Doar tu vezi pagina asta. Publică evenimentul din panou ca să poată rezerva și alții.
          </p>
        ) : null}
        {event.status === "cancelled" ? (
          <p className="mb-4 rounded-xl bg-danger-soft text-[#a32d2d] text-sm px-4 py-2.5">Evenimentul a fost anulat. Dacă ai plătit online, banii se întorc integral.</p>
        ) : null}
        {group ? (
          <div className="mb-4 rounded-2xl glass px-4 py-3">
            <p className="font-display font-bold text-lg">{group.name}</p>
            <p className="text-sm text-night-muted">
              {group.leaderName} ține {group.holdQuantity} locuri. {group.claimed} luate, {group.free} libere, până {formatDay(group.holdExpiresAt).toLowerCase()} la {formatTime(group.holdExpiresAt)}.
            </p>
          </div>
        ) : null}
        {offer ? (
          <div className="mb-4 rounded-2xl glass px-4 py-3">
            <p className="font-display font-bold text-lg">Ți-am păstrat {offer.quantity === 1 ? "un loc" : `${offer.quantity} locuri`}</p>
            <p className="text-sm text-night-muted">De pe lista de așteptare. Ia-le până la ora {formatTime(offer.expiresAt)}.</p>
          </div>
        ) : null}

        {/* Afișul */}
        <section className="grain relative rounded-3xl overflow-hidden aspect-[4/5]">
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="sunset absolute inset-0" aria-hidden="true" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-night via-night/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex flex-wrap gap-1.5 mb-3">
              <CategoryChip category={event.category} />
              <VibeChip vibe={event.vibe} />
              <HeatMeter level={demand.heat} />
              <DiscountBadge pct={bestPct || null} />
            </div>
            <h1 className="headline text-[clamp(2.4rem,11vw,4.6rem)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">{event.title}</h1>
            {event.subtitle ? <p className="mt-2 text-white/85 text-lg">{event.subtitle}</p> : null}
          </div>
          {allSoldOut ? (
            <div className="absolute top-5 right-5 text-white text-2xl">
              <Stamp>Sold out</Stamp>
            </div>
          ) : lowSeats ? (
            <div className="absolute top-5 right-5 text-xl text-white">
              <Stamp>Ultimele locuri</Stamp>
            </div>
          ) : null}
        </section>

        <section className="mt-5 flex items-start gap-4">
          <div className="shrink-0 text-center rounded-2xl glass px-3 py-2 min-w-16">
            <p className="text-[11px] uppercase tracking-widest text-night-muted font-semibold">{event.startsAt.toLocaleDateString("ro-RO", { month: "short", timeZone: "Europe/Bucharest" }).replace(".", "")}</p>
            <p className="font-display font-extrabold text-3xl leading-none">{event.startsAt.toLocaleDateString("ro-RO", { day: "numeric", timeZone: "Europe/Bucharest" })}</p>
          </div>
          <dl className="grid gap-1.5 text-[15px] min-w-0">
            <div className="flex gap-3">
              <dt className="w-12 shrink-0 text-night-muted">Când</dt>
              <dd>
                {formatDay(event.startsAt)}, ora {formatTime(event.startsAt)}
                {event.doorsAt ? <span className="text-night-muted"> · ușile de la {formatTime(event.doorsAt)}</span> : null}
              </dd>
            </div>
            {where ? (
              <div className="flex gap-3">
                <dt className="w-12 shrink-0 text-night-muted">Unde</dt>
                <dd className="min-w-0">
                  {venueName ? (
                    venue ? (
                      <Link href={`/loc/${venue.slug}`} className="font-semibold underline decoration-white/30 hover:decoration-white">
                        {venueName}
                      </Link>
                    ) : (
                      <span className="font-semibold">{venueName}</span>
                    )
                  ) : null}
                  {venueName && (venueAddress || city) ? ", " : ""}
                  {[venueAddress, city].filter(Boolean).join(", ")}
                  {mapsUrl ? (
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="ml-2 text-sm underline text-night-muted hover:text-white">
                      cum ajung
                    </a>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {settings.ageMin ? (
              <div className="flex gap-3">
                <dt className="w-12 shrink-0 text-night-muted">Acces</dt>
                <dd>{settings.ageMin}+</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section id="bilete" className="mt-8 scroll-mt-4">
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
            <p className="text-night-muted">
              Evenimentul a avut loc. Vezi ce mai urmează la{" "}
              <Link href={`/o/${organizer.slug}`} className="underline">
                {organizer.name}
              </Link>
              .
            </p>
          ) : null}
        </section>

        {event.description ? (
          <section className="mt-10" data-reveal>
            <h2 className="eyebrow mb-2">Despre</h2>
            <p className="whitespace-pre-line leading-relaxed text-[15px] text-white/90">{event.description}</p>
          </section>
        ) : null}

        <section className="mt-10 rounded-3xl glass p-5" data-reveal>
          <p className="eyebrow">Organizator</p>
          <p className="font-display font-bold text-xl mt-1">{organizer.name}</p>
          {organizer.description ? <p className="text-sm text-night-muted mt-1">{organizer.description}</p> : null}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href={`/o/${organizer.slug}`} className="underline">
              Toate evenimentele
            </Link>
            {organizer.brand?.instagram ? (
              <a href={`https://instagram.com/${organizer.brand.instagram}`} target="_blank" rel="noreferrer" className="underline">
                Instagram
              </a>
            ) : null}
            {organizer.contactEmail ? (
              <a href={`mailto:${organizer.contactEmail}`} className="underline">
                Scrie-ne
              </a>
            ) : null}
          </div>
        </section>

        <section className="mt-6">
          <ShareButtons url={url} title={event.title} dark />
        </section>

        <footer className="mt-10 text-xs text-night-muted">
          Rezervările și biletele sunt emise prin Ticketeanu, în numele organizatorului. Prețul afișat este prețul plătit; nu apar taxe la final.
        </footer>
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
