import Link from "next/link";
import { Logo } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="max-w-7xl mx-auto px-4 pt-16 pb-10">
      <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr] border-t border-white/10 pt-10">
        <div>
          <Logo dark />
          <p className="mt-3 text-sm text-night-muted max-w-xs">Bilete și rezervări pentru petreceri, concerte și seri în oraș. Prețul de pe ecran e prețul plătit.</p>
        </div>
        <nav aria-label="Pentru cine iese în oraș" className="text-sm">
          <p className="eyebrow mb-3">Ieși în oraș</p>
          <ul className="space-y-2 text-white/80">
            <li>
              <Link href="/evenimente" className="hover:text-white">
                Harta evenimentelor
              </Link>
            </li>
            <li>
              <Link href="/evenimente?vibe=hot" className="hover:text-white">
                Ce e hot
              </Link>
            </li>
            <li>
              <Link href="/evenimente?vibe=chill" className="hover:text-white">
                Ce e chill
              </Link>
            </li>
            <li>
              <Link href="/evenimente?reduceri=1" className="hover:text-white">
                Reduceri
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Pentru organizatori" className="text-sm">
          <p className="eyebrow mb-3">Organizezi</p>
          <ul className="space-y-2 text-white/80">
            <li>
              <Link href="/organizatori" className="hover:text-white">
                Fă-ți pagina de bilete
              </Link>
            </li>
            <li>
              <Link href="/intra" className="hover:text-white">
                Intră în panou
              </Link>
            </li>
            <li>
              <Link href="/termeni-organizatori" className="hover:text-white">
                Condiții pentru organizatori
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mt-10 text-xs text-night-muted">© {new Date().getFullYear()} Ticketeanu</p>
    </footer>
  );
}
