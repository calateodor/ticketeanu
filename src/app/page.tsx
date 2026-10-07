import type { CSSProperties } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { listCatalogItems } from "@/lib/catalog";
import type { CatalogItem } from "@/lib/catalog-types";
import { TZ, formatDay, formatDayShort, formatTime, nowMs } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { bpsToPercent, formatLei, platformFeeBps } from "@/lib/money";
import { CATEGORIES, VIBES, heatOf } from "@/lib/taxonomy";
import { EventCard } from "@/components/event/event-card";
import { HeatMeter } from "@/components/event/chips";
import { DragStickers } from "@/components/fun/drag-stickers";
import { Marquee } from "@/components/fun/marquee";
import { Reveals } from "@/components/motion/reveals";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SplitWords } from "@/components/motion/split-words";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Ticket, TicketMachine } from "@/components/ticket/ticket";
import { cx } from "@/components/ui";
import { WhenRail, type WhenTab } from "./when-rail";

// Compoziția: un perete de slide-uri lipite (ca în Look/Site colors.jpg), cu goluri mici între ele.
// Imaginile sunt afișele reale ale evenimentelor (în datele demo, Unsplash). Fără ilustrații
// desenate, avatare sau testimoniale.

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function whenTabs(items: CatalogItem[], now: number): WhenTab[] {
  const day = (ms: number) => dayKey.format(new Date(ms));
  const today = day(now);
  const tomorrow = day(now + 86_400_000);
  const dow = DOW[weekday.format(new Date(now))] ?? 1;
  // Weekendul: vineri, sâmbătă, duminică din săptămâna asta (inclusiv cel în curs), până duminică.
  const weekendDays = new Set<string>();
  for (let d = 0; d <= 7 - dow; d++) {
    if (dow + d >= 5) weekendDays.add(day(now + d * 86_400_000));
  }
  const week = now + 7 * 86_400_000;
  return [
    { key: "azi", label: "Diseară", items: items.filter((i) => day(i.startsAt) === today) },
    { key: "maine", label: "Mâine", items: items.filter((i) => day(i.startsAt) === tomorrow) },
    { key: "weekend", label: "Weekend", items: items.filter((i) => weekendDays.has(day(i.startsAt))) },
    { key: "saptamana", label: "Săptămâna asta", items: items.filter((i) => i.startsAt <= week) },
    { key: "toate", label: "Tot ce urmează", items },
  ];
}

const STEPS = [
  { t: "Alegi", d: "Pe hartă, după vibe, zonă sau reduceri. Prețul e final de la primul ecran." },
  { t: "Rezervi", d: "Douăzeci de secunde, fără cont. Singur sau cu gașca." },
  { t: "Intri", d: "Biletul e pe telefon, cu cod QR. Nu mai poți? Renunți dintr-un buton." },
];

const TAPE = ["Fără cont", "Douăzeci de secunde", "Prețul de pe ecran e prețul plătit", "Gașca plătește separat", "Renunți dintr-un buton"];

// Culorile pastilelor de categorii, pe rând, din paleta site-ului.
const PILL = ["bg-white text-night", "bg-sun-2 text-night", "bg-lime text-night", "bg-sun-1 text-night", "bg-sun-3 text-white"];

export default async function Home() {
  const items = await listCatalogItems({ limit: 60 });
  const now = nowMs();
  const tabs = whenTabs(items, now);
  const hottest = [...items].sort((a, b) => b.heat - a.heat || a.startsAt - b.startsAt)[0];
  const cities = [...new Set(items.map((i) => i.city).filter((c): c is string => Boolean(c)))];
  const discounted = items.filter((i) => i.hasDiscount);
  const maxDiscount = Math.max(0, ...discounted.map((i) => i.discountPct ?? 0));
  const categories = CATEGORIES.map((c) => ({ ...c, count: items.filter((i) => i.category === c.key).length })).filter((c) => c.count > 0);
  const byVibe = VIBES.map((v) => {
    const list = items.filter((i) => i.vibe === v.key);
    return { ...v, count: list.length, cover: list.find((i) => i.coverUrl)?.coverUrl ?? null };
  });
  const feeBps = platformFeeBps();
  const ticketQr = await QRCode.toDataURL(siteUrl(hottest ? `/e/${hottest.slug}` : "/evenimente"), { margin: 1, width: 240, color: { dark: "#15102A", light: "#FFFFFF" } });

  return (
    <div className="night min-h-dvh overflow-x-clip">
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-3 md:px-4 pt-3 space-y-3">
        {/* 1. Hero: titlul și imprimanta care tipărește biletul celui mai cerut eveniment. */}
        <section data-hero-root className="slide grain relative grid md:grid-cols-[1fr_minmax(290px,370px)] gap-8 md:gap-10 px-5 md:px-12 pt-6 pb-8 md:py-10">
          <div className="relative z-10 flex flex-col">
            <p data-hero className="inline-flex w-fit items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-bold text-lime">
              <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
              {items.length} {items.length === 1 ? "eveniment" : "evenimente"} în {cities.length} {cities.length === 1 ? "oraș" : "orașe"}, cu bilete acum
            </p>

            <div className="relative mt-auto w-fit pt-12 md:pt-16">
              <h1 data-split className="headline text-[clamp(4.6rem,25vw,8.5rem)] md:text-[clamp(6rem,14vw,13.5rem)] text-white drop-shadow-[0_6px_30px_rgba(60,0,80,0.35)]">
                <SplitWords text={"Gata\nbiletul."} />
              </h1>
              {/* Stickere de mutat cu degetul: decor, informația e și în text. */}
              <span data-drag aria-hidden="true" className="sticker sticker-in absolute left-[60%] top-[22%] md:left-[64%] md:top-[24%] text-[clamp(1rem,2.2vw,1.6rem)] [--tilt:8deg] [--delay:0.75s]">
                Fără cont
              </span>
              <span data-drag aria-hidden="true" className="sticker sticker-white sticker-in absolute -left-1 -bottom-8 md:left-[10%] md:-bottom-8 text-[clamp(0.95rem,2vw,1.4rem)] [--tilt:-6deg] [--delay:0.9s]">
                20 de secunde
              </span>
            </div>

            <div data-hero className="mt-14 flex flex-wrap items-end gap-x-8 gap-y-5">
              <div className="flex flex-wrap gap-2">
                <a href="#unde" className="rounded-full bg-white text-night px-5 md:px-6 py-3.5 font-bold hover:bg-lime transition-colors">
                  Alege evenimentul
                </a>
                <Link href="/evenimente" className="rounded-full glass px-5 md:px-6 py-3.5 font-bold text-white hover:bg-white/20 transition-colors">
                  <span className="sm:hidden">Harta</span>
                  <span className="hidden sm:inline">Deschide harta</span>
                </Link>
              </div>
              <ul className="rail max-w-xs space-y-1 text-sm font-semibold text-white/90">
                <li>Petreceri, concerte, stand-up, seri chill</li>
                <li>Singur sau cu gașca, fiecare plătește partea lui</li>
              </ul>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-[330px] md:max-w-[370px] mx-auto md:mx-0 md:justify-self-end md:self-center">
            {hottest ? (
              <TicketMachine label="Printărie" sticker="Gata!">
                <Ticket
                  title={hottest.title}
                  subtitle={hottest.subtitle}
                  dayLabel={formatDayShort(new Date(hottest.startsAt))}
                  timeLabel={formatTime(new Date(hottest.startsAt))}
                  venue={hottest.venueName}
                  city={hottest.city}
                  holder="Numele tău"
                  typeName="Intrare"
                  code="7K3PQ2WX9A"
                  orderCode="GATA"
                  qrDataUrl={ticketQr}
                  coverUrl={hottest.coverUrl}
                  useCover={Boolean(hottest.coverUrl)}
                  motionButton={false}
                  animate
                />
              </TicketMachine>
            ) : null}
          </div>
        </section>

        {/* 2. Fierbe acum + Unde ieși, alăturate. */}
        <div className="grid gap-3 md:grid-cols-12">
          {hottest ? (
            <Link href={`/e/${hottest.slug}?src=t`} aria-label={`${hottest.title}: prinde loc`} className="slide-deep grain group relative flex flex-col justify-end min-h-[520px] md:col-span-7 p-5 md:p-9">
              {hottest.coverUrl ? (
                // Afișul se topește în gradient, ca subiecții din referință.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hottest.coverUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-y-0 right-0 h-full w-full md:w-[78%] object-cover transition-transform duration-700 group-hover:scale-[1.04] [mask-image:linear-gradient(180deg,#000_30%,transparent_85%)] md:[mask-image:linear-gradient(90deg,transparent_0%,#000_45%)]"
                />
              ) : null}
              <div className="relative z-10 max-w-md">
                <p className="inline-flex items-center gap-2 rounded-full bg-uv px-3 py-1.5 text-xs font-extrabold text-night">
                  <span className="size-1.5 rounded-full bg-night animate-pulse" aria-hidden="true" />
                  Fierbe acum · {heatOf(hottest.heat).hint}
                </p>
                <h2 className="headline mt-4 text-[clamp(3rem,6.5vw,5.6rem)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]">{hottest.title}</h2>
                {hottest.subtitle ? <p className="mt-2 text-lg font-medium text-white/90">{hottest.subtitle}</p> : null}
                <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
                  <div className="glass rounded-2xl px-3.5 py-2.5">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-lime">Când</dt>
                    <dd className="font-bold">
                      {formatDay(new Date(hottest.startsAt))}, {formatTime(new Date(hottest.startsAt))}
                    </dd>
                  </div>
                  <div className="glass rounded-2xl px-3.5 py-2.5">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-lime">Unde</dt>
                    <dd className="font-bold truncate">{[hottest.venueName, hottest.city].filter(Boolean).join(", ") || "Se anunță"}</dd>
                  </div>
                  <div className="glass rounded-2xl px-3.5 py-2.5">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-lime">Cât</dt>
                    <dd className="font-bold">{hottest.minPrice == null ? "—" : hottest.minPrice === 0 ? "Gratuit" : `de la ${formatLei(hottest.minPrice)}`}</dd>
                  </div>
                  <div className="glass rounded-2xl px-3.5 py-2.5">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-lime">Cerere</dt>
                    <dd className="mt-1">
                      <HeatMeter level={hottest.heat} />
                    </dd>
                  </div>
                </dl>
                <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white text-night pl-5 pr-1.5 py-1.5 font-bold transition-colors group-hover:bg-lime">
                  Prinde loc
                  <span className="grid size-8 place-items-center rounded-full bg-night text-white transition-transform duration-200 group-hover:-rotate-45" aria-hidden="true">
                    →
                  </span>
                </span>
              </div>
            </Link>
          ) : null}

          <section id="unde" className={cx("slide-warm grain relative p-5 md:p-8 scroll-mt-20", hottest ? "md:col-span-5" : "md:col-span-12")}>
            <div className="relative z-10">
              <div className="flex items-end justify-between gap-3 mb-4">
                <h2 className="headline text-[clamp(2.8rem,5.5vw,4.4rem)]">Unde ieși</h2>
                <Link href="/evenimente" className="mb-1 shrink-0 text-sm font-bold text-white/90 hover:text-white">
                  Harta →
                </Link>
              </div>
              <WhenRail tabs={tabs} />
            </div>
          </section>
        </div>
      </main>

      {/* 3. Categorii și vibe-uri, pe două benzi care curg în sensuri opuse. */}
      <nav aria-label="Categorii, vibe-uri și orașe" className="mt-3 space-y-2">
        {categories.length > 0 ? (
          <Marquee duration={36} repeat={categories.length < 5 ? 3 : 2}>
            {categories.map((c, i) => (
              <Link
                key={c.key}
                href={`/evenimente?categorie=${c.key}`}
                className={cx("headline mr-2 inline-flex items-start gap-1.5 rounded-[1.4rem] px-6 py-3 text-[clamp(2.2rem,5.5vw,4.4rem)] transition-transform duration-200 hover:-rotate-2 hover:scale-[1.03]", PILL[i % PILL.length])}
              >
                {c.label}
                <span className="mt-1 text-[0.32em] tracking-normal opacity-70">{c.count}</span>
              </Link>
            ))}
          </Marquee>
        ) : null}
        <Marquee duration={44} reverse repeat={3}>
          {byVibe.map((v) => (
            <Link
              key={v.key}
              href={`/evenimente?vibe=${v.key}`}
              className="group/v headline mr-2 inline-flex items-center gap-3 rounded-[1.4rem] border-2 border-(--v) px-6 py-3 text-[clamp(2.2rem,5.5vw,4.4rem)] text-white transition-colors hover:bg-(--v) hover:text-night"
              style={{ "--v": v.color } as CSSProperties}
            >
              <span className="size-[0.35em] rounded-full bg-(--v) group-hover/v:bg-night" aria-hidden="true" />
              {v.label}
            </Link>
          ))}
          <Link href="/evenimente?reduceri=1" className="headline mr-2 inline-flex items-center rounded-[1.4rem] bg-lime px-6 py-3 text-[clamp(2.2rem,5.5vw,4.4rem)] text-night transition-transform duration-200 hover:-rotate-2">
            Cu reducere
          </Link>
          {cities.map((c) => (
            <Link key={c} href={`/evenimente?oras=${encodeURIComponent(c)}`} className="headline mr-2 inline-flex items-center rounded-[1.4rem] glass px-6 py-3 text-[clamp(2.2rem,5.5vw,4.4rem)] text-white transition-colors hover:bg-white/20">
              {c}
            </Link>
          ))}
        </Marquee>
      </nav>

      <div className="max-w-7xl mx-auto px-3 md:px-4 pt-3 space-y-3">
        {/* 4. Ce vibe ai: titlul și trei uși, pe un rând. */}
        <div className="grid grid-cols-3 md:grid-cols-12 gap-3">
          <div className="col-span-3 md:col-span-3 rounded-[1.75rem] glass p-5 md:p-6 flex flex-col justify-between gap-4" data-reveal>
            <h2 className="headline text-[clamp(2.6rem,4.4vw,3.8rem)]">Ce vibe ai?</h2>
            <p className="text-white/80 text-sm">Vibe-ul îl spune organizatorul. Cât de cerută e seara arătăm noi, din rezervări.</p>
          </div>
          {byVibe.map((v) => (
            <Link
              key={v.key}
              href={`/evenimente?vibe=${v.key}`}
              data-reveal
              className="group relative block aspect-[3/4] md:aspect-auto md:min-h-[300px] md:col-span-3 rounded-[1.75rem] overflow-hidden bg-night-2"
            >
              {v.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.cover} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-75 transition-[transform,opacity] duration-500 group-hover:scale-[1.06] group-hover:opacity-95" />
              ) : null}
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 25%, ${v.color}e6 100%)` }} />
              <div className="absolute inset-x-0 bottom-0 p-3 md:p-5">
                <p className="headline text-[clamp(1.9rem,5vw,4.4rem)]">{v.label}</p>
                <p className="hidden md:block mt-1 text-sm font-medium text-white/90">{v.hint}</p>
                <p className="mt-2 inline-flex whitespace-nowrap rounded-full bg-black/35 px-2 md:px-2.5 py-1 text-[10px] md:text-[11px] font-bold">
                  {v.count} {v.count === 1 ? "eveniment" : "evenimente"}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* 5. Reduceri: biletele cu preț mai mic. */}
        {discounted.length > 0 ? (
          <section className="slide grain relative grid md:grid-cols-[0.75fr_2fr] gap-6 p-5 md:p-8 items-center">
            <div className="relative z-10">
              <span className="sticker text-lg [--tilt:-6deg]">-{maxDiscount}%</span>
              <h2 className="headline mt-4 text-[clamp(2.8rem,5vw,4.4rem)]">Mai ieftin, la vedere</h2>
              <p className="mt-3 text-white/90">Prețuri tăiate, oferte cu ceas, reduceri pentru studenți și grupuri. Se aplică singure la plată.</p>
              <Link href="/evenimente?reduceri=1" className="mt-5 inline-flex rounded-full bg-lime text-night px-5 py-3 font-extrabold hover:bg-white transition-colors">
                Toate reducerile
              </Link>
            </div>
            {/* Pe telefon, un șir care se derulează; de la tabletă, trei pe rând. */}
            <div className="relative z-10 -mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible [--stub-bg:rgba(18,10,31,0.72)]">
              {discounted.slice(0, 3).map((i) => (
                <div key={i.id} className="snap-start shrink-0 w-[64vw] max-w-[260px] md:w-auto md:max-w-none">
                  <EventCard item={i} reveal />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* 6. Gașca + cei trei pași. */}
        <div className="grid gap-3 md:grid-cols-2">
          <section className="slide-deep grain relative flex flex-col gap-6 p-6 md:p-9 overflow-hidden">
            <span className="sticker sticker-pink absolute right-5 top-5 text-2xl md:text-3xl [--tilt:7deg]" aria-hidden="true">
              48 h
            </span>
            <div className="relative z-10 max-w-md">
              <h2 className="headline text-[clamp(2.8rem,5.5vw,4.6rem)]">Vii cu gașca?</h2>
              <p className="mt-3 text-lg text-white/90">
                Bifezi „Vin cu gașca”, spui câți sunteți și trimiți linkul pe grup. Locurile stau ținute 48 de ore, iar fiecare își plătește singur locul. Fără „îți dau banii mâine”.
              </p>
            </div>
            {/* Schema unei găști de cinci: două locuri plătite, trei ținute până intră ceilalți pe link. */}
            <figure className="relative z-10 mt-auto">
              <div className="flex gap-2" aria-hidden="true">
                {[true, true, false, false, false].map((paid, i) => (
                  <span
                    key={i}
                    className={cx(
                      "grid h-16 flex-1 place-items-center rounded-xl text-xs font-extrabold uppercase",
                      paid ? "bg-lime text-night -rotate-2" : "border-2 border-dashed border-white/40 text-white/70",
                    )}
                  >
                    {paid ? "Plătit" : "Ținut"}
                  </span>
                ))}
              </div>
              <figcaption className="mt-2 text-sm text-white/70">O gașcă de cinci: doi au plătit, trei locuri te așteaptă pe link.</figcaption>
            </figure>
          </section>
          <section className="rounded-[1.75rem] glass p-6 md:p-9">
            <h2 className="headline text-[clamp(2.8rem,5.5vw,4.6rem)]">Trei pași</h2>
            <ol className="rail mt-5 space-y-4">
              {STEPS.map((s) => (
                <li key={s.t}>
                  <p className="font-display font-extrabold text-xl leading-tight">{s.t}</p>
                  <p className="text-white/75">{s.d}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {/* 7. Bandă lipită strâmb peste pagină. */}
      <div className="tape bg-lime text-night my-8 -mx-4 py-3">
        <p className="sr-only">{TAPE.join(". ")}.</p>
        <div aria-hidden="true">
          <Marquee duration={30} repeat={2}>
            {TAPE.map((t) => (
              <span key={t} className="headline mr-6 inline-flex items-center gap-6 text-[clamp(1.6rem,3.2vw,2.6rem)]">
                {t}
                <span>✶</span>
              </span>
            ))}
          </Marquee>
        </div>
      </div>

      {/* 8. Final + organizatori. */}
      <div className="max-w-7xl mx-auto px-3 md:px-4 grid gap-3 md:grid-cols-12">
        <section className="slide grain relative md:col-span-8 p-6 md:p-10 flex flex-col justify-between gap-8 min-h-[320px]">
          <h2 data-split className="headline relative z-10 text-[clamp(3.2rem,8vw,7rem)]">
            <SplitWords text={"Alegi. Rezervi.\nGata biletul."} />
          </h2>
          <div className="relative z-10 flex flex-wrap gap-2">
            <Link href="/evenimente" className="rounded-full bg-white text-night px-6 py-3.5 font-bold hover:bg-lime transition-colors">
              Deschide harta
            </Link>
            <Link href="/evenimente?vibe=hot" className="rounded-full glass px-6 py-3.5 font-bold hover:bg-white/20 transition-colors">
              Doar ce e hot
            </Link>
          </div>
        </section>
        <Link href="/organizatori" className="slide-deep grain group relative md:col-span-4 p-6 md:p-8 flex flex-col justify-between gap-6">
          <div className="relative z-10">
            <p className="eyebrow">Organizezi ceva?</p>
            <p className="headline mt-3 text-[clamp(2.2rem,3.6vw,3.2rem)]">Pagina ta de bilete, în două minute</p>
            <p className="mt-3 text-sm text-white/75">Fără contract, fără om de vânzări. Comision {bpsToPercent(feeBps)} doar la ce se plătește online.</p>
          </div>
          <span className="relative z-10 inline-flex w-fit items-center gap-2 rounded-full bg-white text-night pl-5 pr-1.5 py-1.5 font-bold transition-colors group-hover:bg-lime">
            Pentru organizatori
            <span className="grid size-8 place-items-center rounded-full bg-night text-white transition-transform duration-200 group-hover:-rotate-45" aria-hidden="true">
              →
            </span>
          </span>
        </Link>
      </div>

      <SiteFooter />
      <DragStickers />
      <Reveals />
      <SmoothScroll />
    </div>
  );
}
