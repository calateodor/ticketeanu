"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const tabs = [
  { href: "", label: "Vânzări" },
  { href: "/bilete", label: "Bilete" },
  { href: "/participanti", label: "Participanți" },
  { href: "/reduceri", label: "Reduceri" },
  { href: "/promovare", label: "Promovare" },
  { href: "/intrare", label: "Intrare" },
  { href: "/setari", label: "Setări" },
];

export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/panou/evenimente/${eventId}`;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line -mx-4 px-4">
      {tabs.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            className={cx(
              "px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
              active ? "border-stamp text-stamp-deep" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
