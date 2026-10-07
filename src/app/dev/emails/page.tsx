import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Outbox e-mail (dev)" };

export default async function DevEmailsPage({ searchParams }: PageProps<"/dev/emails">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const rows = await db.select().from(emails).orderBy(desc(emails.createdAt)).limit(50);
  const open = typeof sp.id === "string" ? rows.find((r) => r.id === sp.id) : rows[0];

  return (
    <div className="min-h-dvh grid grid-cols-1 md:grid-cols-[360px_1fr]">
      <aside className="border-r border-line bg-surface overflow-y-auto">
        <p className="px-4 py-3 text-xs uppercase tracking-wider text-muted font-semibold border-b border-line">Outbox e-mail · doar în dezvoltare</p>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <a href={`/dev/emails?id=${r.id}`} className={`block px-4 py-3 hover:bg-paper ${open?.id === r.id ? "bg-stamp-soft" : ""}`}>
                <p className="font-semibold text-sm truncate">{r.subject}</p>
                <p className="text-xs text-muted truncate">
                  {r.toEmail} · {formatDateTime(r.createdAt)} · {r.status}
                </p>
              </a>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-4 py-6 text-sm text-muted">Niciun e-mail încă.</li> : null}
        </ul>
      </aside>
      <main className="p-4">
        {open ? (
          <>
            <p className="text-sm text-muted mb-2">
              Către {open.toEmail} · {open.subject}
            </p>
            <iframe title="email" srcDoc={open.html} className="w-full h-[85vh] rounded-xl border border-line bg-white" />
          </>
        ) : null}
      </main>
    </div>
  );
}
