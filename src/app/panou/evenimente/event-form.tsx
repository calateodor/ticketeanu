"use client";

import { useActionState } from "react";
import type { Event, Venue } from "@/db/schema";
import { toLocalInputValue } from "@/lib/dates";
import { CATEGORIES, VIBES } from "@/lib/taxonomy";
import { Button, ErrorText, Field, Input, Select, Textarea, cx } from "@/components/ui";
import type { ActionState } from "./actions";
import { VenuePicker } from "./venue-picker";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  event?: Event | null;
  venues: Venue[];
  defaultCity?: string | null;
  mode: "create" | "edit";
};

export function EventForm({ action, event, venues, defaultCity, mode }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-4">
        <Field label="Numele evenimentului" htmlFor="title" error={fe.title}>
          <Input id="title" name="title" defaultValue={event?.title ?? ""} placeholder="ex. Carousel Party · Halloween Edition" autoFocus={mode === "create"} required />
        </Field>
        <Field label="Subtitlu (opțional)" htmlFor="subtitle" error={fe.subtitle} hint="Line-up, tema, un cârlig scurt.">
          <Input id="subtitle" name="subtitle" defaultValue={event?.subtitle ?? ""} placeholder="ex. 3 DJ, 2 ringuri, open bar până la 00:00" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Începe" htmlFor="startsAt" error={fe.startsAt}>
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInputValue(event?.startsAt)} required />
          </Field>
          <Field label="Ușile se deschid (opțional)" htmlFor="doorsAt" error={fe.doorsAt}>
            <Input id="doorsAt" name="doorsAt" type="datetime-local" defaultValue={toLocalInputValue(event?.doorsAt)} />
          </Field>
          <Field label="Se termină (opțional)" htmlFor="endsAt" error={fe.endsAt}>
            <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInputValue(event?.endsAt)} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold text-lg">Ce fel de seară e</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Categoria" htmlFor="category" error={fe.category} hint="După ea se filtrează pe hartă.">
            <Select id="category" name="category" defaultValue={event?.category ?? "petrecere"}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset>
            <legend className="block text-sm font-semibold text-ink-2 mb-1.5">Vibe-ul</legend>
            <div className="grid grid-cols-3 gap-2">
              {VIBES.map((v) => (
                <label key={v.key} className="cursor-pointer">
                  <input type="radio" name="vibe" value={v.key} defaultChecked={event?.vibe === v.key} className="peer sr-only" />
                  <span
                    className={cx("block rounded-xl border border-line-strong px-3 py-2 text-sm font-semibold text-center transition-colors peer-checked:bg-(--vc) peer-checked:text-white peer-checked:border-transparent peer-focus-visible:outline-3 peer-focus-visible:outline-stamp")}
                    style={{ ["--vc" as string]: v.color }}
                  >
                    <span className="inline-block size-2 rounded-full mr-1.5 align-middle" style={{ background: v.color }} aria-hidden="true" />
                    {v.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-sm text-muted mt-1.5">Tu spui cum e seara. Cât de cerută e o arată platforma, din rezervări.</p>
          </fieldset>
        </div>
      </section>

      <VenuePicker venues={venues} initial={{ venueId: event?.venueId ?? null, venueName: event?.venueName ?? null, venueAddress: event?.venueAddress ?? null, city: event?.city ?? null }} defaultCity={defaultCity} errors={fe} />

      {mode === "create" ? (
        <section className="space-y-4">
          <h2 className="font-bold text-lg">Primul tip de bilet</h2>
          <p className="text-sm text-muted -mt-2">Poți adăuga oricâte tipuri, valuri de preț sau mese după ce creezi evenimentul.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Preț (lei)" htmlFor="price" hint="Lasă gol pentru intrare gratuită.">
              <Input id="price" name="price" inputMode="decimal" placeholder="ex. 60" />
            </Field>
            <Field label="Cum se plătește" htmlFor="mode">
              <Select id="mode" name="mode" defaultValue="online">
                <option value="online">Online, la rezervare</option>
                <option value="door">La intrare (rezervare fără plată)</option>
              </Select>
            </Field>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-bold text-lg">Cum arată</h2>
        <Field label="Descriere" htmlFor="description" error={fe.description}>
          <Textarea id="description" name="description" defaultValue={event?.description ?? ""} placeholder="Ce se întâmplă, cine cântă, reguli de acces…" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
          <Field label="Afișul (link către imagine)" htmlFor="coverUrl" error={fe.coverUrl} hint="Apare pe pagină, pe hartă și când trimiți linkul pe WhatsApp.">
            <Input id="coverUrl" name="coverUrl" type="url" defaultValue={event?.coverUrl ?? ""} placeholder="https://…" />
          </Field>
          <Field label="Culoarea" htmlFor="accent" error={fe.accent} hint="Din ea ies gradientul paginii și al biletului.">
            <input id="accent" name="accent" type="color" defaultValue={event?.theme?.accent ?? "#8A3DFF"} className="size-11 rounded-lg border border-line-strong bg-surface p-1" />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="ticketCover" defaultChecked={event?.theme?.ticketCover ?? false} className="mt-0.5 size-4 accent-stamp" />
          <span>
            <span className="font-semibold">Afișul pe bilet.</span> Biletul primește afișul pe fundal, în loc de gradient. Merge bine cu afișe închise la culoare.
          </span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Capacitate totală" htmlFor="capacity" error={fe.capacity} hint="Lasă gol dacă nu e limitată.">
            <Input id="capacity" name="capacity" inputMode="numeric" defaultValue={event?.capacity ?? ""} placeholder="ex. 300" />
          </Field>
          <Field label="Vizibilitate" htmlFor="visibility">
            <Select id="visibility" name="visibility" defaultValue={event?.visibility ?? "public"}>
              <option value="public">Public: apare pe hartă și în catalog</option>
              <option value="unlisted">Doar cu link</option>
            </Select>
          </Field>
        </div>
      </section>

      <ErrorText>{state.error ?? fe.form}</ErrorText>
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvez…" : mode === "create" ? "Creează evenimentul" : "Salvează"}
        </Button>
        {state.ok ? <span className="text-sm text-ok font-medium">{state.message ?? "Salvat."}</span> : null}
      </div>
    </form>
  );
}
