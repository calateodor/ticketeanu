import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { doorTokens } from "@/db/schema";
import { doorStats } from "@/lib/checkin";
import { formatDateTime } from "@/lib/dates";
import { siteUrl } from "@/lib/mail";
import { requireEventAccess } from "@/lib/panel";
import { Stat } from "@/components/ui";
import { DoorCreateForm, DoorTokenActions } from "./door-forms";

export default async function DoorPage({ params }: PageProps<"/panou/evenimente/[id]/intrare">) {
  const { id } = await params;
  const { event } = await requireEventAccess(id);
  const [tokens, stats] = await Promise.all([
    db.select().from(doorTokens).where(eq(doorTokens.eventId, event.id)).orderBy(desc(doorTokens.createdAt)),
    doorStats(event.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Stat label="Au intrat" value={stats.arrived} />
        <Stat label="Așteptați" value={stats.expected} hint="bilete valide" />
      </div>

      <section>
        <h2 className="text-lg font-bold">Linkuri de scanare</h2>
        <p className="text-sm text-muted mb-4">
          Fă câte un link pentru fiecare om de la intrare și trimite-i-l pe WhatsApp. Deschide linkul pe telefon, pornește camera și scanează codurile QR. Nu are nevoie de cont sau de aplicație. Dacă semnalul e slab, caută după nume.
        </p>
        <DoorCreateForm eventId={event.id} />
        {tokens.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-(--radius-card) border border-line bg-surface">
            {tokens.map((t) => {
              const url = siteUrl(`/scan/${t.token}`);
              return (
                <li key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {t.label}
                      {t.revokedAt ? <span className="text-xs ml-2 text-danger">oprit</span> : null}
                    </p>
                    <p className="text-xs text-muted break-all">{t.revokedAt ? "—" : url}</p>
                    {t.lastUsedAt ? <p className="text-xs text-muted">Ultima scanare: {formatDateTime(t.lastUsedAt)}</p> : null}
                  </div>
                  {!t.revokedAt ? <DoorTokenActions eventId={event.id} tokenId={t.id} url={url} /> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
