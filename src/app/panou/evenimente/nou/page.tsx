import QRCode from "qrcode";
import { requireOrganizer } from "@/lib/auth";
import { listOrganizerVenues } from "@/lib/catalog";
import { siteUrl } from "@/lib/mail";
import { createEventAction } from "../actions";
import { CreateEventForm } from "../create-form";

export const metadata = { title: "Eveniment nou" };

export default async function NewEventPage() {
  const { organizer } = await requireOrganizer();
  const venues = await listOrganizerVenues(organizer.id);
  // Un cod QR de probă pentru biletul din previzualizare (duce spre pagina organizatorului).
  const sampleQr = await QRCode.toDataURL(siteUrl(`/o/${organizer.slug}`), { margin: 1, width: 200, color: { dark: "#15102A", light: "#FFFFFF" } });
  return (
    <div>
      <div className="mb-5">
        <h1 className="headline text-[clamp(2.6rem,7vw,4rem)]">Eveniment nou</h1>
        <p className="text-muted mt-1">Patru pași, două minute. Publici direct sau îl lași ciornă.</p>
      </div>
      <CreateEventForm action={createEventAction} venues={venues} defaultCity={organizer.city} organizerName={organizer.name} sampleQr={sampleQr} />
    </div>
  );
}
