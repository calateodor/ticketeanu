import { requireOrganizer } from "@/lib/auth";
import { listOrganizerVenues } from "@/lib/catalog";
import { PageTitle } from "@/components/ui";
import { createEventAction } from "../actions";
import { EventForm } from "../event-form";

export const metadata = { title: "Eveniment nou" };

export default async function NewEventPage() {
  const { organizer } = await requireOrganizer();
  const venues = await listOrganizerVenues(organizer.id);
  return (
    <div className="max-w-2xl">
      <PageTitle sub="Nume, dată, loc, preț. Pagina e gata imediat; o publici când vrei.">Eveniment nou</PageTitle>
      <EventForm action={createEventAction} mode="create" venues={venues} defaultCity={organizer.city} />
    </div>
  );
}
