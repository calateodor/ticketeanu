import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { bpsToPercent, platformFeeBps } from "@/lib/money";
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
  { k: "Lista", t: "Lista, nu doar biletul", d: "Gratuit, cu plata la intrare, cu avans sau plătit integral: toate pe același link. Locul neplătit la timp se eliberează singur și ajunge la următorul de pe lista de așteptare." },
  { k: "Gașca", t: "Gașca plătește separat", d: "Cineva ține locuri pentru prieteni și trimite linkul în grup. Tu vezi toți oamenii, nu doar pe cel care a plătit pentru toți." },
  { k: "Harta", t: "Ești pe hartă din prima zi", d: "Evenimentul apare pe harta Ticketeanu, filtrat după vibe și zonă. Tu spui vibe-ul; cererea reală arată cât de tare se încinge." },
  { k: "Reduceri", t: "Reduceri care se văd", d: "Preț tăiat, oferte pe timp limitat cu numărătoare inversă, reduceri pentru studenți sau grupuri, coduri publice. Fără să umbli după cineva să le pună." },
  { k: "PR", t: "Comision calculat singur", d: "Fiecare PR are linkul lui. Vezi câte bilete a vândut, iar comisionul se reține din încasări. Fără Excel, fără certuri." },
  { k: "Intrarea", t: "Scanare fără aplicație", d: "Dai omului de la ușă un link. Scanează, caută după nume, vede ce mai e de încasat și ce reducere trebuie verificată." },
];

export default async function OrganizersPage() {
  const user = await getCurrentUser();
  const feeBps = platformFeeBps();
  const start = user ? "/panou/evenimente/nou" : "/intra";

  return (
    <div className="night min-h-dvh overflow-x-clip">
      <SiteHeader />
      <main>
        <section data-hero-root className="px-3 md:px-4 pt-4">
          <div className="slide-deep grain relative max-w-7xl mx-auto min-h-[min(78vh,760px)] px-6 md:px-12 py-12 md:py-16 flex flex-col justify-end">
            <p data-hero className="eyebrow mb-6">
              Pentru organizatori · cluburi, promoteri, săli
            </p>
            <h1 data-split className="headline text-[clamp(3.6rem,11vw,9.5rem)]">
              <SplitWords text={"Casa de bilete\nfără oameni."} />
            </h1>
            <p data-hero className="mt-6 max-w-xl text-lg md:text-xl text-white/85">
              Îți faci singur pagina evenimentului în câteva minute. Lumea rezervă de pe telefon, singură sau cu gașca, iar tu vezi banii și lista în timp real.
            </p>
            <div data-hero className="mt-8 flex flex-wrap gap-3">
              <Link href={start} className="rounded-full bg-white text-night px-6 py-3.5 font-bold hover:bg-lime transition-colors">
                Fă primul eveniment
              </Link>
              <a href="#bani" className="rounded-full glass px-6 py-3.5 font-bold hover:bg-white/15 transition-colors">
                Cât costă
              </a>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 pt-20 md:pt-28">
          <h2 data-split className="headline text-[clamp(2.8rem,8vw,6.5rem)] mb-10">
            <SplitWords text="Cum merge" />
          </h2>
          <ol className="grid md:grid-cols-3 gap-3 md:gap-4">
            {STEPS.map((s, i) => (
              <li key={s.t} data-reveal className="rounded-[1.75rem] border border-white/10 p-6 md:p-8">
                <span className="headline block text-[6rem] leading-none text-sunset" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display font-extrabold text-2xl">{s.t}</h3>
                <p className="mt-2 text-white/75">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="max-w-7xl mx-auto px-4 pt-20 md:pt-28">
          <h2 data-split className="headline text-[clamp(2.8rem,8vw,6.5rem)] mb-10">
            <SplitWords text="Ce primești" />
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {FEATURES.map((f) => (
              <div key={f.k} data-reveal className="rounded-[1.75rem] border border-white/10 p-6">
                <p className="eyebrow">{f.k}</p>
                <h3 className="font-display font-extrabold text-2xl mt-2">{f.t}</h3>
                <p className="mt-2 text-white/75">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="bani" className="px-3 md:px-4 pt-20 md:pt-28 scroll-mt-24">
          <div className="slide grain relative max-w-7xl mx-auto grid md:grid-cols-2 gap-10 p-6 md:p-12 items-start">
            <div className="relative z-10">
              <h2 data-split className="headline text-[clamp(2.8rem,7vw,5.6rem)]">
                <SplitWords text={"Prețul,\nla vedere."} />
              </h2>
              <p className="mt-5 text-white/90 text-lg" data-reveal>
                Un singur comision, {bpsToPercent(feeBps)} din ce se plătește online, fără parte fixă pe bilet. Tu alegi dacă îl plătește cumpărătorul peste preț sau îl suporți din preț. Cumpărătorul vede oricum prețul final de la primul ecran.
              </p>
              <ul className="mt-5 space-y-2 text-white/90" data-reveal>
                <li>· Evenimente gratuite și rezervări cu plata la ușă: 0 lei.</li>
                <li>· Scanare de pe orice telefon, fără aplicație.</li>
                <li>· Lista participanților e a ta, cu export oricând.</li>
                <li>· Anulare = banii înapoi integral, cu comision cu tot.</li>
              </ul>
            </div>
            <div className="relative z-10" data-reveal>
              <FeeCalculator feeBps={feeBps} />
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 pt-24 md:pt-32 text-center">
          <h2 data-split className="headline text-[clamp(3.2rem,10vw,8rem)]">
            <SplitWords text={"Primul eveniment,\nîn două minute."} wordClassName="text-sunset" />
          </h2>
          <div className="mt-8" data-reveal>
            <Link href={start} className="inline-flex rounded-full bg-white text-night px-7 py-4 font-bold hover:bg-lime transition-colors">
              {user ? "Fă un eveniment nou" : "Intră și începe"}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Reveals />
      <SmoothScroll />
    </div>
  );
}
