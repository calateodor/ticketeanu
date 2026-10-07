import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/ui";

// Antetul paginilor publice: o pastilă de sticlă, plutitoare. Site-ul e pentru cei care ies în oraș;
// organizatorii au un link discret și pagina lor (/organizatori).
export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-3 z-50 px-3 md:px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 rounded-full glass-strong bg-night/60 pl-4 pr-1.5 py-1.5 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.9)]">
        <Link href="/" aria-label="Ticketeanu, prima pagină" className="shrink-0">
          <Logo dark />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm font-semibold">
          <Link href="/evenimente" className="hidden sm:inline-flex rounded-full px-3.5 py-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            Evenimente
          </Link>
          <Link href="/evenimente?reduceri=1" className="hidden md:inline-flex rounded-full px-3.5 py-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors">
            Reduceri
          </Link>
          <Link href={user ? "/panou" : "/organizatori"} className="hidden sm:inline-flex rounded-full px-3.5 py-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            {user ? "Panoul meu" : "Organizatori"}
          </Link>
          <Link href="/evenimente" className="inline-flex items-center rounded-full bg-white text-night px-4 py-2 font-bold hover:bg-lime transition-colors">
            Vezi evenimente
          </Link>
        </nav>
      </div>
    </header>
  );
}
