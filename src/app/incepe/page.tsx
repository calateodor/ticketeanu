import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganizer, requireUser } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { OnboardForm } from "./onboard-form";

export const metadata = { title: "Începe" };

export default async function OnboardPage() {
  const user = await requireUser("/incepe");
  const existing = await getCurrentOrganizer(user);
  if (existing) redirect("/panou");

  return (
    <main className="min-h-dvh">
      <header className="p-5">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <div className="max-w-lg mx-auto px-4 pb-16">
        <h1 className="text-3xl font-extrabold mb-1">Cum te cheamă pe afiș?</h1>
        <p className="text-muted mb-6">
          Două minute și ai pagina de organizator. Datele de firmă le completezi mai târziu, înainte de primul eveniment cu plată.
        </p>
        <OnboardForm defaultEmail={user.email} />
      </div>
    </main>
  );
}
