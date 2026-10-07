import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Intră" };

export default async function LoginPage(props: PageProps<"/intra">) {
  const { next } = await props.searchParams;
  const user = await getCurrentUser();
  if (user) redirect(typeof next === "string" && next.startsWith("/") ? next : "/panou");

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="p-5">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <div className="flex-1 grid place-items-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-extrabold mb-1">Intră în cont</h1>
          <p className="text-muted mb-6">Fără parolă. Îți trimitem un cod pe e-mail.</p>
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </div>
    </main>
  );
}
