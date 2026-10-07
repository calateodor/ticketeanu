import Link from "next/link";
import QRCode from "qrcode";
import { listCatalogItems } from "@/lib/catalog";
import type { CatalogItem } from "@/lib/catalog-types";
import { TZ, formatDay, formatDayShort, formatTime, nowMs } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { bpsToPercent, formatLei, platformFeeBps } from "@/lib/money";
import { VIBES, heatOf } from "@/lib/taxonomy";
import { EventCard } from "@/components/event/event-card";
import { CategoryChip, HeatMeter, VibeChip } from "@/components/event/chips";
import { Reveals } from "@/components/motion/reveals";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SplitWords } from "@/components/motion/split-words";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Ticket, TicketMachine } from "@/components/ticket/ticket";
import { WhenRail, type WhenTab } from "./when-rail";

// Imaginile: afișele reale ale evenimentelor (încărcate de organizatori; în datele demo, Unsplash).
// Fără ilustrații desenate, fără avatare, fără testimoniale.

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
    { key: "weekend", label: "Weekendul ăsta", items: items.filter((i) => weekendDays.has(day(i.startsAt))) },
    { key: "saptamana", label: "Săptămâna asta", items: items.filter((i) => i.startsAt <= week) },
    { key: "toate", label: "Tot ce urmează", items },
  ];
}

const STEPS = [
  { t: "Alegi seara", d: "Pe hartă, după vibe, zonă sau reduceri. Vezi de la început cât de cerut e un eveniment și cât te costă, cu tot cu comision." },
  { t: "Rezervi, singur sau cu gașca", d: "Douăzeci de secunde, fără cont. Vii cu prietenii? Ținem locuri 48 de ore și fiecare își plătește partea lui." },
  { t: "Intri cu biletul de pe telefon", d: "Biletul se tipărește pe ecran, cu cod QR. Merge și fără internet. Nu-ți mai poți face planul? Renunți dintr-un buton." },
];

export default async function Home() {
  const items = await listCatalogItems({ limit: 60 });
  const now = nowMs();
  const tabs = whenTabs(items, now);
  const hottest = [...items].sort((a, b) => b.heat - a.heat || a.startsAt - b.startsAt)[0];
  const cities = new Set(items.map((i) => i.city).filter(Boolean));
  const discounted = items.filter((i) => i.hasDiscount);
  const byVibe = VIBES.map((v) => {
    const list = items.filter((i) => i.vibe === v.key);
    return { ...v, count: list.length, cover: list.find((i) => i.coverUrl)?.coverUrl ?? null };
  });
  const feeBps = platformFeeBps();
  const ticketQr = await QRCode.toDataURL(siteUrl(hottest ? `/e/${hottest.slug}` : "/evenimente"), { margin: 1, width: 240, color: { dark: "#15102A", light: "#FFFFFF" } });

  return (
    <div className="night min-h-dvh overflow-x-clip">
      <SiteHeader />

      <main>
        {/* Hero: titlul și imprimanta care tipărește biletul celui mai cerut eveniment. */}
        <section data-hero-root className="px-3 md:px-4 pt-4">
          <div className="slide grain relative max-w-7xl mx-auto min-h-[min(86vh,880px)] px-6 md:px-12 pt-10 md:pt-14 pb-10 grid md:grid-cols-[1.15fr_0.85fr] gap-10 items-end">
            <div className="relative z-10 self-stretch flex flex-col">
              <p data-hero className="inline-flex w-fit items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-bold text-lime">
                <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
                {items.length} {items.length === 1 ? "eveniment" : "evenimente"} în {cities.size} {cities.size === 1 ? "oraș" : "orașe"}, cu bilete acum
              </p>
              <h1 data-split className="headline mt-auto pt-10 text-[clamp(4.2rem,13.5vw,11.5rem)] text-white drop-shadow-[0_6px_30px_rgba(60,0,80,0.35)]">
                <SplitWords text={"Gata\nbiletul."} />
              </h1>
              <p data-hero className="mt-6 max-w-md text-lg md:text-xl text-white/90 font-medium">
                Petreceri, concerte, stand-up și seri chill. Alegi, rezervi în douăzeci de secunde, singur sau cu gașca, și biletul ți se tipărește pe telefon.
              </p>
              <div data-hero className="mt-7 flex flex-wrap gap-3">
                <Link href="/evenimente" className="rounded-full bg-white text-night px-6 py-3.5 font-bold hover:bg-lime transition-colors">
                  Alege evenimentul
                </Link>
                <Link href="/evenimente?vibe=hot" className="rounded-full glass px-6 py-3.5 font-bold text-white hover:bg-white/20 transition-colors">
                  Doar ce e hot
                </Link>
              </div>
            </div>

            <div className="relative z-10 w-full max-w-[360px] mx-auto md:mx-0 md:justify-self-end">
              {hottest ? (
                <>
                  <TicketMachine label="Se tipărește acum">
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
                  <p className="eyebrow text-white/70 text-center -mt-2">Așa iese biletul tău când rezervi</p>
                </>
              ) : null}
            </div>
          </div>
        </section>

        {/* Unde ieși: file după zi. */}
        <section className="max-w-7xl mx-auto px-4 pt-20 md:pt-28">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <p className="eyebrow mb-3" data-reveal>
                Calendarul tău
              </p>
              <h2 data-split className="headline text-[clamp(2.8rem,8vw,6.5rem)]">
                <SplitWords text="Unde ieși" />
              </h2>
            </div>
            <Link href="/evenimente" data-reveal className="rounded-full glass px-4 py-2 text-sm font-bold hover:bg-white/15 transition-colors">
              Deschide harta
            </Link>
          </div>
          <div data-reveal>
            <WhenRail tabs={tabs} />
          </div>
        </section>

        {/* Fierbe acum: cel mai cerut eveniment, în prim-plan. */}
        {hottest ? (
          <section className="px-3 md:px-4 pt-20 md:pt-28">
            <div className="slide-deep grain relative max-w-7xl mx-auto grid md:grid-cols-[1fr_0.9fr] gap-8 md:gap-12 p-6 md:p-12 items-center">
              <div className="relative z-10">
                <p className="inline-flex items-center gap-2 rounded-full bg-uv/20 border border-uv/40 px-3 py-1.5 text-xs font-bold text-white" data-reveal>
                  <span className="size-1.5 rounded-full bg-uv animate-pulse" aria-hidden="true" />
                  Fierbe acum · {heatOf(hottest.heat).hint}
                </p>
                <h2 data-split className="headline mt-6 text-[clamp(2.8rem,7.5vw,6.2rem)]">
                  <SplitWords text={hottest.title} />
                </h2>
                {hottest.subtitle ? (
                  <p className="mt-4 text-lg text-white/80" data-reveal>
                    {hottest.subtitle}
                  </p>
                ) : null}
                <dl className="mt-8 grid grid-cols-2 gap-3 max-w-md" data-reveal>
                  <div className="glass rounded-2xl p-4">
                    <dt className="eyebrow">Când</dt>
                    <dd className="mt-1 font-bold">
                      {formatDay(new Date(hottest.startsAt))}, {formatTime(new Date(hottest.startsAt))}
                    </dd>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <dt className="eyebrow">Unde</dt>
                    <dd className="mt-1 font-bold">{[hottest.venueName, hottest.city].filter(Boolean).join(", ") || "Se anunță"}</dd>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <dt className="eyebrow">Cât</dt>
                    <dd className="mt-1 font-bold">{hottest.minPrice == null ? "—" : hottest.minPrice === 0 ? "Gratuit" : `de la ${formatLei(hottest.minPrice)}`}</dd>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <dt className="eyebrow">Cerere</dt>
                    <dd className="mt-1.5">
                      <HeatMeter level={hottest.heat} />
                    </dd>
                  </div>
                </dl>
                <div className="mt-8 flex flex-wrap items-center gap-3" data-reveal>
                  <Link href={`/e/${hottest.slug}?src=t`} className="rounded-full bg-white text-night px-6 py-3.5 font-bold hover:bg-lime transition-colors">
                    Prinde loc
                  </Link>
                  <CategoryChip category={hottest.category} />
                  <VibeChip vibe={hottest.vibe} />
                </div>
              </div>
              <Link href={`/e/${hottest.slug}?src=t`} className="group relative z-10 block aspect-[4/5] rounded-[1.75rem] overflow-hidden" data-reveal aria-label={`${hottest.title}: vezi evenimentul`}>
                {hottest.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hottest.coverUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                ) : (
                  <div className="slide absolute inset-0" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </Link>
            </div>
          </section>
        ) : null}

        {/* Ce vibe ai: trei uși spre hartă. */}
        <section className="max-w-7xl mx-auto px-4 pt-20 md:pt-28">
          <p className="eyebrow mb-3" data-reveal>
            Tu alegi cum e seara
          </p>
          <h2 data-split className="headline text-[clamp(2.8rem,8vw,6.5rem)] mb-8">
            <SplitWords text="Ce vibe ai?" />
          </h2>
          <div className="grid md:grid-cols-3 gap-3 md:gap-4">
            {byVibe.map((v) => (
              <Link
                key={v.key}
                href={`/evenimente?vibe=${v.key}`}
                data-reveal
                className="group relative block aspect-[4/5] md:aspect-[3/4] rounded-[1.75rem] overflow-hidden bg-night-2"
                style={{ boxShadow: `inset 0 0 0 1px ${v.color}40` }}
              >
                {v.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.cover} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-70 transition-[transform,opacity] duration-700 group-hover:scale-[1.05] group-hover:opacity-90" />
                ) : null}
                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${v.color}cc 100%)` }} />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="headline text-[clamp(3.5rem,8vw,6rem)] text-white">{v.label}</p>
                  <p className="mt-1 text-white/90 font-medium">{v.hint}</p>
                  <p className="mt-3 inline-flex rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-white">
                    {v.count} {v.count === 1 ? "eveniment" : "evenimente"} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Reduceri: doar dacă există. */}
        {discounted.length > 0 ? (
          <section className="max-w-7xl mx-auto px-4 pt-20 md:pt-28">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <p className="eyebrow mb-3" data-reveal>
                  Prețuri tăiate, oferte pe timp limitat, coduri la vedere
                </p>
                <h2 data-split className="headline text-[clamp(2.8rem,8vw,6.5rem)]">
                  <SplitWords text="Mai ieftin, la vedere" />
                </h2>
              </div>
              <Link href="/evenimente?reduceri=1" data-reveal className="rounded-full bg-lime text-night px-4 py-2 text-sm font-extrabold hover:bg-white transition-colors">
                Toate reducerile
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {discounted.slice(0, 4).map((i) => (
                <EventCard key={i.id} item={i} reveal />
              ))}
            </div>
          </section>
        ) : null}

        {/* Cum merge, pentru tine: o secvență reală, de aceea numerotată. */}
        <section className="max-w-7xl mx-auto px-4 pt-20 md:pt-28">
          <p className="eyebrow mb-3" data-reveal>
            De la „ce facem?” la intrare
          </p>
          <h2 data-split className="headline text-[clamp(2.8rem,8vw,6.5rem)] mb-10">
            <SplitWords text="Trei pași" />
          </h2>
          <ol className="grid md:grid-cols-3 gap-3 md:gap-4">
            {STEPS.map((s, i) => (
              <li key={s.t} data-reveal className="relative rounded-[1.75rem] border border-white/10 p-6 md:p-8 overflow-hidden">
                <span className="headline block text-[7rem] leading-none text-sunset opacity-90" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display font-extrabold text-2xl">{s.t}</h3>
                <p className="mt-2 text-white/75">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Gașca: cum arată locurile ținute pentru prieteni. */}
        <section className="px-3 md:px-4 pt-20 md:pt-28">
          <div className="slide grain relative max-w-7xl mx-auto grid md:grid-cols-2 gap-10 p-6 md:p-12 items-center">
            <div className="relative z-10">
              <p className="eyebrow text-white/75 mb-3" data-reveal>
                Vii cu prietenii
              </p>
              <h2 data-split className="headline text-[clamp(2.8rem,7.5vw,6rem)]">
                <SplitWords text={"Ții locuri.\nFiecare plătește\npartea lui."} />
              </h2>
              <p className="mt-6 max-w-md text-lg text-white/90" data-reveal>
                Bifezi „Vin cu gașca”, spui câți sunteți și primești un link pentru grupul de WhatsApp. Locurile stau ținute 48 de ore; cine intră pe link își ia locul și îl plătește singur. Fără „îți dau banii mâine”.
              </p>
            </div>
            <div className="relative z-10 glass-strong rounded-[1.75rem] p-5 md:p-6 max-w-md w-full md:justify-self-end" data-reveal aria-label="Exemplu: o gașcă de cinci, cu locuri ținute">
              <div className="flex items-center justify-between">
                <p className="font-display font-extrabold text-xl">Gașca lui Andrei</p>
                <p className="eyebrow text-white/75">5 locuri · 47 h</p>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  { n: "Andrei", s: "plătit", ok: true },
                  { n: "Ioana", s: "plătit", ok: true },
                  { n: "Mihai", s: "plătit", ok: true },
                  { n: "Loc ținut", s: "așteaptă pe cineva din grup", ok: false },
                  { n: "Loc ținut", s: "așteaptă pe cineva din grup", ok: false },
                ].map((r, i) => (
                  <li key={i} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${r.ok ? "bg-white/15" : "border border-dashed border-white/30"}`}>
                    <span className="font-semibold">{r.n}</span>
                    <span className={r.ok ? "text-lime font-bold" : "text-white/70"}>{r.s}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-white/70">Exemplu de cum arată pagina găștii, nu date reale.</p>
            </div>
          </div>
        </section>

        {/* Final */}
        <section className="max-w-7xl mx-auto px-4 pt-24 md:pt-32 text-center">
          <h2 data-split className="headline text-[clamp(3.6rem,12vw,10rem)]">
            <SplitWords text={"Alegi. Rezervi.\nGata biletul."} wordClassName="text-sunset" />
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3" data-reveal>
            <Link href="/evenimente" className="rounded-full bg-white text-night px-7 py-4 font-bold hover:bg-lime transition-colors">
              Deschide harta
            </Link>
            <Link href="/evenimente?reduceri=1" className="rounded-full glass px-7 py-4 font-bold hover:bg-white/15 transition-colors">
              Vezi reducerile
            </Link>
          </div>
        </section>

        {/* Pentru organizatori: o bandă, nu o pagină. */}
        <section className="px-3 md:px-4 pt-24">
          <Link href="/organizatori" className="slide-deep grain group relative max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6 p-6 md:p-10" data-reveal>
            <div className="relative z-10">
              <p className="eyebrow mb-2">Organizezi ceva?</p>
              <p className="headline text-[clamp(2rem,5vw,3.6rem)]">Fă-ți pagina de bilete în două minute</p>
              <p className="mt-2 text-white/75">Fără contract, fără om de vânzări. Comision {bpsToPercent(feeBps)} doar la ce se plătește online.</p>
            </div>
            <span className="relative z-10 rounded-full bg-white text-night px-6 py-3.5 font-bold group-hover:bg-lime transition-colors">Pentru organizatori →</span>
          </Link>
        </section>
      </main>

      <SiteFooter />
      <Reveals />
      <SmoothScroll />
    </div>
  );
}
