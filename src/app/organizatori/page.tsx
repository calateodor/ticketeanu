import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { bpsToPercent, platformFeeBps } from "@/lib/money";
import { DragStickers } from "@/components/fun/drag-stickers";
import { Reveals } from "@/components/motion/reveals";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SplitWords } from "@/components/motion/split-words";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { FeeCalculator } from "../fee-calculator";

export const metadata = {
  title: "Pentru organizatori",
  description: "Fă-ți singur pagina de bilete în două minute: rezervări, gașca plătește separat, PR-i cu comision calculat, scanare de pe orice telefon.",
};

const STEPS = [
  { t: "Îți faci pagina", d: "Nume, dată, loc pe hartă, prețuri. Două minute, de pe telefon. Fără contract, fără om de vânzări." },
  { t: "Trimiți linkul", d: "Pe WhatsApp, pe Instagram, PR-ilor. Lumea se pune pe listă singură sau cu gașca; fiecare își plătește locul lui." },
  { t: "Scanezi la intrare", d: "Omul tău de la ușă deschide un link și scanează QR-uri de pe orice telefon. Vezi cine a venit, în timp real." },
];

const FEATURES = [
  { k: "Lista", t: "Lista, nu doar biletul", d: "Gratuit, cu plata la intrare, cu avans sau plătit integral, pe același link. Locul neplătit la timp ajunge singur la următorul de pe lista de așteptare." },
  { k: "Gașca", t: "Gașca plătește separat", d: "Cineva ține locuri pentru prieteni și trimite linkul în grup. Tu vezi toți oamenii, nu doar pe cel care a plătit pentru toți." },
  { k: "Harta", t: "Ești pe hartă din prima zi", d: "Evenimentul apare pe harta Ticketeanu, după vibe și zonă. Tu spui vibe-ul; cererea reală arată cât se încinge." },
  { k: "Reduceri", t: "Reduceri care se văd", d: "Preț tăiat, oferte cu numărătoare inversă, reduceri pentru studenți sau grupuri, coduri publice." },
  { k: "PR", t: "Comision calculat singur", d: "Fiecare PR are linkul lui. Vezi câte bilete a vândut; comisionul se reține din încasări. Fără Excel." },
  { k: "Intrarea", t: "Scanare fără aplicație", d: "Omul de la ușă scanează, caută după nume, vede ce mai e de încasat și ce reducere trebuie verificată." },
];

// Aceeași compoziție ca prima pagină: slide-uri lipite, goluri mici.
export default async function OrganizersPage() {
  const user = await getCurrentUser();
  const feeBps = platformFeeBps();
  const start = user ? "/panou/evenimente/nou" : "/intra";

  return (
    <div className="night min-h-dvh overflow-x-clip">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-3 md:px-4 pt-3 space-y-3">
        <section data-hero-root className="slide-deep grain relative grid md:grid-cols-[1.4fr_1fr] gap-8 px-5 md:px-12 py-8 md:py-12 items-end">
          <div className="relative z-10">
            <p data-hero className="eyebrow text-white/75 mb-6">
              Pentru organizatori · cluburi, promoteri, săli
            </p>
            <div className="relative w-fit">
              <h1 data-split className="headline text-[clamp(3.6rem,15vw,6rem)] md:text-[clamp(4.5rem,9vw,8.5rem)]">
                <SplitWords text={"Casa de bilete\nfără oameni."} />
              </h1>
              <span data-drag aria-hidden="true" className="sticker sticker-in absolute right-0 -bottom-9 md:-right-8 md:bottom-[4%] text-[clamp(1rem,2vw,1.5rem)] [--tilt:8deg] [--delay:0.7s]">
                Comision {bpsToPercent(feeBps)}
              </span>
            </div>
            <div data-hero className="mt-8 flex flex-wrap gap-2">
              <Link href={start} className="rounded-full bg-white text-night px-6 py-3.5 font-bold hover:bg-lime transition-colors">
                Fă primul eveniment
              </Link>
              <a href="#bani" className="rounded-full glass px-6 py-3.5 font-bold hover:bg-white/15 transition-colors">
                Cât costă
              </a>
            </div>
          </div>
          <p data-hero className="relative z-10 text-lg md:text-xl text-white/85 md:pb-2">
            Îți faci singur pagina evenimentului în câteva minute. Lumea rezervă de pe telefon, singură sau cu gașca, iar tu vezi banii și lista în timp real.
          </p>
        </section>

        <div className="grid gap-3 md:grid-cols-12">
          <section className="slide-warm grain relative md:col-span-5 p-6 md:p-9">
            <div className="relative z-10">
              <h2 className="headline text-[clamp(2.8rem,5vw,4.4rem)]">Cum merge</h2>
              <ol className="rail mt-6 space-y-5">
                {STEPS.map((s) => (
                  <li key={s.t}>
                    <p className="font-display font-extrabold text-xl leading-tight">{s.t}</p>
                    <p className="text-white/90">{s.d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <section className="md:col-span-7 grid sm:grid-cols-2 gap-3" aria-label="Ce primești">
            {FEATURES.map((f) => (
              <div key={f.k} data-reveal className="rounded-[1.5rem] glass p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-lime">{f.k}</p>
                <h3 className="mt-1.5 font-display font-extrabold text-xl leading-tight">{f.t}</h3>
                <p className="mt-1.5 text-sm text-white/75">{f.d}</p>
              </div>
            ))}
          </section>
        </div>

        <section id="bani" className="slide grain relative grid md:grid-cols-2 gap-8 p-6 md:p-10 items-start scroll-mt-24">
          <div className="relative z-10">
            <h2 data-split className="headline text-[clamp(2.8rem,6vw,5.2rem)]">
              <SplitWords text={"Prețul,\nla vedere."} />
            </h2>
            <p className="mt-4 text-white/90 text-lg">
              Un singur comision, {bpsToPercent(feeBps)} din ce se plătește online, fără parte fixă pe bilet. Tu alegi dacă îl plătește cumpărătorul peste preț sau îl suporți din preț. Cumpărătorul vede oricum prețul final de la primul ecran.
            </p>
            <ul className="rail mt-5 space-y-2 text-white/90">
              <li>Evenimente gratuite și rezervări cu plata la ușă: 0 lei.</li>
              <li>Scanare de pe orice telefon, fără aplicație.</li>
              <li>Lista participanților e a ta, cu export oricând.</li>
              <li>Anulare = banii înapoi integral, cu comision cu tot.</li>
            </ul>
          </div>
          <div className="relative z-10" data-reveal>
            <FeeCalculator feeBps={feeBps} />
          </div>
        </section>

        <section className="slide-deep grain relative flex flex-wrap items-end justify-between gap-6 p-6 md:p-10">
          <h2 data-split className="headline relative z-10 text-[clamp(3rem,8vw,6.5rem)]">
            <SplitWords text={"Primul eveniment,\nîn două minute."} />
          </h2>
          <Link href={start} className="relative z-10 group inline-flex items-center gap-2 rounded-full bg-white text-night pl-6 pr-1.5 py-1.5 font-bold hover:bg-lime transition-colors">
            {user ? "Fă un eveniment nou" : "Intră și începe"}
            <span className="grid size-9 place-items-center rounded-full bg-night text-white transition-transform duration-200 group-hover:-rotate-45" aria-hidden="true">
              →
            </span>
          </Link>
        </section>
      </main>
      <SiteFooter />
      <DragStickers />
      <Reveals />
      <SmoothScroll />
    </div>
  );
}
