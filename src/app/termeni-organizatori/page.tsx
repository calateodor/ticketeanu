import Link from "next/link";
import { Logo } from "@/components/ui";
import { CONTRACT_VERSION } from "@/lib/contract";

export const metadata = { title: "Condiții pentru organizatori" };

export default function TermsPage() {
  return (
    <main className="min-h-dvh">
      <header className="p-5">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <article className="max-w-2xl mx-auto px-4 pb-16 prose-sm">
        <p className="inline-block rounded-full bg-warn-soft text-[#854f0b] text-xs font-semibold px-3 py-1 mb-4">
          Schiță · versiunea {CONTRACT_VERSION}. Textul final îl verifică un avocat înainte de prima vânzare reală.
        </p>
        <h1 className="text-3xl font-extrabold mb-4">Condiții pentru organizatori</h1>
        <ol className="space-y-3 list-decimal pl-5 text-ink-2">
          <li>Ticketeanu vinde bilete și primește rezervări în numele și pe seama organizatorului. Organizatorul rămâne vânzătorul biletului și răspunde de eveniment.</li>
          <li>Comisionul Ticketeanu este cel afișat public la momentul creării evenimentului și se aplică doar sumelor plătite online. Evenimentele gratuite și rezervările neplătite nu au comision.</li>
          <li>Încasările, mai puțin comisionul și eventualele comisioane de PR sau promovare alese de organizator, se virează organizatorului după eveniment, în contul IBAN declarat. Organizatorul vede în orice moment extrasul de bani din panou.</li>
          <li>Dacă evenimentul se anulează, organizatorul acceptă ca Ticketeanu să ramburseze cumpărătorilor integral sumele plătite, inclusiv comisionul, din încasările evenimentului.</li>
          <li>Obligațiile fiscale legate de bilete (impozitul pe spectacole, timbrele, drepturile de autor, TVA pe bilet) sunt ale organizatorului. Ticketeanu pune la dispoziție situațiile de vânzări necesare.</li>
          <li>Datele participanților sunt prelucrate de organizator în calitate de operator și de Ticketeanu în calitate de persoană împuternicită, doar pentru desfășurarea evenimentului și, cu acordul participantului, pentru comunicări ulterioare.</li>
          <li>Organizatorul își poate închide contul oricând; evenimentele cu bilete vândute se onorează până la final.</li>
        </ol>
      </article>
    </main>
  );
}
