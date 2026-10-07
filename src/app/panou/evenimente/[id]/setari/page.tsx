import { listOrganizerVenues } from "@/lib/catalog";
import { requireEventAccess } from "@/lib/panel";
import { effectiveSettings } from "@/lib/orders";
import { updateEventAction } from "../../actions";
import { EventForm } from "../../event-form";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ params }: PageProps<"/panou/evenimente/[id]/setari">) {
  const { id } = await params;
  const { event, organizer } = await requireEventAccess(id);
  const settings = effectiveSettings(event);
  const venues = await listOrganizerVenues(organizer.id);
  return (
    <div className="space-y-10 max-w-2xl">
      <section>
        <h2 className="text-lg font-bold mb-4">Detaliile evenimentului</h2>
        <EventForm action={updateEventAction.bind(null, event.id)} event={event} venues={venues} mode="edit" />
      </section>
      <section>
        <h2 className="text-lg font-bold mb-1">Cum funcționează lista</h2>
        <p className="text-sm text-muted mb-4">Reguli pentru rezervări, grupuri, lista de așteptare și comision.</p>
        <SettingsForm eventId={event.id} settings={settings} organizerFeeBearer={organizer.feeBearer} feePercent={organizer.feeBps / 100} />
      </section>
    </div>
  );
}
