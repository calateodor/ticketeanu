"use client";

import { useActionState } from "react";
import type { ResolvedSettings } from "@/lib/orders";
import { Button, Field, Input, Select } from "@/components/ui";
import { updateSettingsAction, type ActionState } from "../../actions";

export function SettingsForm({ eventId, settings, organizerFeeBearer, feePercent }: { eventId: string; settings: ResolvedSettings; organizerFeeBearer: "buyer" | "organizer"; feePercent: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateSettingsAction.bind(null, eventId), {});
  return (
    <form action={action} className="space-y-5">
      <Field label={`Comisionul Ticketeanu (${feePercent}%)`} htmlFor="feeBearer" hint="Cumpărătorul vede oricum prețul final de la primul ecran.">
        <Select name="feeBearer" defaultValue={settings.feeBearer ?? "inherit"}>
          <option value="inherit">Ca la nivel de organizator ({organizerFeeBearer === "buyer" ? "îl plătește cumpărătorul, peste preț" : "îl suport eu, din preț"})</option>
          <option value="buyer">Îl plătește cumpărătorul, peste preț</option>
          <option value="organizer">Îl suport eu, din preț</option>
        </Select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Cât ținem locul până la plată (minute)" htmlFor="holdMinutes">
          <Input name="holdMinutes" inputMode="numeric" defaultValue={settings.holdMinutes} />
        </Field>
        <Field label="Vârsta minimă (opțional)" htmlFor="ageMin">
          <Input name="ageMin" inputMode="numeric" defaultValue={settings.ageMin ?? ""} placeholder="18" />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-sm">Gașca (rezervarea de grup)</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="groupEnabled" defaultChecked={settings.groupEnabled} className="size-4 accent-stamp" />
          Cineva poate ține locuri pentru prietenii lui; fiecare își plătește partea prin linkul grupului.
        </label>
        <Field label="Cât ținem locurile grupului (ore)" htmlFor="groupHoldHours">
          <Input name="groupHoldHours" inputMode="numeric" defaultValue={settings.groupHoldHours} className="w-32" />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-sm">Când e plin</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="waitlistEnabled" defaultChecked={settings.waitlistEnabled} className="size-4 accent-stamp" />
          Listă de așteptare: când se eliberează un loc, îl oferim automat următorului.
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-sm">Participanții</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="askPhone" defaultChecked={settings.askPhone} className="size-4 accent-stamp" />
          Cer și numărul de telefon la rezervare
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="selfCancel" defaultChecked={settings.selfCancelHoursBefore != null} className="size-4 accent-stamp" />
          Pot renunța singuri (cu bani înapoi dacă au plătit) până cu
          <Input name="selfCancelHoursBefore" inputMode="numeric" defaultValue={settings.selfCancelHoursBefore ?? 24} className="w-20 py-1" />
          ore înainte
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="reminder" defaultChecked={settings.reminderHoursBefore != null} className="size-4 accent-stamp" />
          Reminder pe e-mail cu
          <Input name="reminderHoursBefore" inputMode="numeric" defaultValue={settings.reminderHoursBefore ?? 24} className="w-20 py-1" />
          ore înainte
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvez…" : "Salvează regulile"}
        </Button>
        {state.ok ? <span className="text-sm text-ok font-medium">Salvat.</span> : null}
      </div>
    </form>
  );
}
