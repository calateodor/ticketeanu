import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { logoutAction } from "@/app/intra/actions";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { organizer, user } = await requireOrganizer("/panou");
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-line bg-surface">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <Link href="/panou">
              <Logo />
            </Link>
            <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
              <Link href="/panou" className="px-3 py-1.5 rounded-lg hover:bg-paper">
                Evenimente
              </Link>
              <Link href="/panou/bani" className="px-3 py-1.5 rounded-lg hover:bg-paper">
                Bani
              </Link>
              <Link href="/panou/organizator" className="px-3 py-1.5 rounded-lg hover:bg-paper">
                Organizator
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/o/${organizer.slug}`} className="hidden md:inline text-muted hover:text-ink" target="_blank">
              {organizer.name} ↗
            </Link>
            <form action={logoutAction}>
              <button className="text-muted hover:text-ink" title={user.email}>
                Ieși
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:py-8">{children}</main>
      <nav className="sm:hidden sticky bottom-0 border-t border-line bg-surface flex text-sm font-medium">
        <Link href="/panou" className="flex-1 text-center py-3">
          Evenimente
        </Link>
        <Link href="/panou/bani" className="flex-1 text-center py-3">
          Bani
        </Link>
        <Link href="/panou/organizator" className="flex-1 text-center py-3">
          Organizator
        </Link>
      </nav>
    </div>
  );
}
