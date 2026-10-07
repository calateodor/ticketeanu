"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { createOrganizerAction, type OnboardState } from "./actions";

export function OnboardForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState<OnboardState, FormData>(createOrganizerAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5">
      <Field label="Numele organizatorului" htmlFor="name" error={fe.name} hint="Clubul, brandul de petreceri sau numele tău. Apare pe pagina evenimentelor.">
        <Input id="name" name="name" placeholder="ex. Nook, Beat Collective, DJ Ana" autoFocus required />
      </Field>
      <Field label="Orașul" htmlFor="city" error={fe.city}>
        <Input id="city" name="city" placeholder="București" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="E-mail de contact" htmlFor="contactEmail" error={fe.contactEmail} hint="Aici ajung întrebările participanților.">
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaultEmail} />
        </Field>
        <Field label="Telefon (opțional)" htmlFor="contactPhone" error={fe.contactPhone}>
          <Input id="contactPhone" name="contactPhone" type="tel" placeholder="07xx xxx xxx" />
        </Field>
      </div>
      <Field label="Instagram (opțional)" htmlFor="instagram" error={fe.instagram}>
        <Input id="instagram" name="instagram" placeholder="@numele.tau" />
      </Field>
      <label className="flex gap-3 items-start text-sm">
        <input type="checkbox" name="accept" className="mt-1 size-4 accent-stamp" />
        <span>
          Accept{" "}
          <Link href="/termeni-organizatori" className="underline" target="_blank">
            condițiile pentru organizatori
          </Link>
          : Ticketeanu vinde biletele în numele meu, îmi virează încasările după eveniment și reține comisionul afișat public.
        </span>
      </label>
      <ErrorText>{fe.accept ?? state.error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creez contul…" : "Creează contul de organizator"}
      </Button>
    </form>
  );
}
