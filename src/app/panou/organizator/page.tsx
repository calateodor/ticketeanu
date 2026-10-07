import { requireOrganizer } from "@/lib/auth";
import { bpsToPercent } from "@/lib/money";
import { PageTitle } from "@/components/ui";
import { OrganizerForm } from "./organizer-form";

export const metadata = { title: "Organizator" };

export default async function OrganizerPage() {
  const { organizer } = await requireOrganizer("/panou/organizator");
  return (
    <div className="max-w-2xl">
      <PageTitle sub={`Comisionul tău: ${bpsToPercent(organizer.feeBps)} din ce se plătește online. Zero la gratuite și la rezervările neplătite.`}>Organizator</PageTitle>
      <OrganizerForm organizer={organizer} />
    </div>
  );
}
