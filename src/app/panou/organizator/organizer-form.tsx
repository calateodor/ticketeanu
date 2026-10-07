"use client";

import { useActionState } from "react";
import type { Organizer } from "@/db/schema";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { updateOrganizerAction, type OrgState } from "./actions";

export function OrganizerForm({ organizer }: { organizer: Organizer }) {
  const [state, action, pending] = useActionState<OrgState, FormData>(updateOrganizerAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-bold text-lg">Cum apari pe pagină</h2>
        <Field label="Nume" htmlFor="name" error={fe.name}>
          <Input name="name" defaultValue={organizer.name} required />
        </Field>
        <Field label="Descriere" htmlFor="description" error={fe.description}>
          <Textarea name="description" defaultValue={organizer.description ?? ""} className="min-h-20" placeholder="Cine ești, ce fel de evenimente faci." />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Oraș" htmlFor="city" error={fe.city}>
            <Input name="city" defaultValue={organizer.city ?? ""} />
          </Field>
          <Field label="Culoarea ta" htmlFor="accent" error={fe.accent}>
            <input name="accent" type="color" defaultValue={organizer.brand?.accent ?? "#5B3FD1"} className="size-11 rounded-lg border border-line-strong bg-surface p-1" />
          </Field>
          <Field label="Instagram" htmlFor="instagram" error={fe.instagram}>
            <Input name="instagram" defaultValue={organizer.brand?.instagram ?? ""} placeholder="@" />
          </Field>
          <Field label="Site" htmlFor="website" error={fe.website}>
            <Input name="website" defaultValue={organizer.brand?.website ?? ""} placeholder="https://" />
          </Field>
          <Field label="Logo (link)" htmlFor="logoUrl" error={fe.logoUrl} className="sm:col-span-2">
            <Input name="logoUrl" defaultValue={organizer.logoUrl ?? ""} placeholder="https://" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold text-lg">Contact pentru participanți</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="E-mail" htmlFor="contactEmail" error={fe.contactEmail}>
            <Input name="contactEmail" type="email" defaultValue={organizer.contactEmail ?? ""} />
          </Field>
          <Field label="Telefon" htmlFor="contactPhone" error={fe.contactPhone}>
            <Input name="contactPhone" defaultValue={organizer.contactPhone ?? ""} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold text-lg">Firma și banii</h2>
        <p className="text-sm text-muted -mt-2">Obligatorii înainte de primul eveniment cu plată online. Viramentele se fac în IBAN-ul de aici.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Denumirea firmei" htmlFor="legalName" error={fe.legalName}>
            <Input name="legalName" defaultValue={organizer.legalName ?? ""} placeholder="SRL / PFA / asociație" />
          </Field>
          <Field label="CUI" htmlFor="cui" error={fe.cui}>
            <Input name="cui" defaultValue={organizer.cui ?? ""} />
          </Field>
          <Field label="Nr. Reg. Com." htmlFor="regCom" error={fe.regCom}>
            <Input name="regCom" defaultValue={organizer.regCom ?? ""} placeholder="J40/…" />
          </Field>
          <Field label="IBAN" htmlFor="iban" error={fe.iban}>
            <Input name="iban" defaultValue={organizer.iban ?? ""} placeholder="RO49AAAA1B31007593840000" className="font-mono" />
          </Field>
          <Field label="Adresa sediului" htmlFor="address" error={fe.address} className="sm:col-span-2">
            <Input name="address" defaultValue={organizer.address ?? ""} />
          </Field>
        </div>
        <Field label="Comisionul Ticketeanu, implicit" htmlFor="feeBearer" hint="Poți schimba la fiecare eveniment. Cumpărătorul vede mereu prețul final de la început.">
          <Select name="feeBearer" defaultValue={organizer.feeBearer}>
            <option value="buyer">Îl plătește cumpărătorul, peste preț</option>
            <option value="organizer">Îl suport eu, din preț</option>
          </Select>
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvez…" : "Salvează"}
        </Button>
        {state.ok ? <span className="text-sm text-ok font-medium">Salvat.</span> : null}
      </div>
    </form>
  );
}
