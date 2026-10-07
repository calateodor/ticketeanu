"use client";

import { useActionState, useRef, useState } from "react";
import type { Venue } from "@/db/schema";
import { formatDayShort, formatTime, fromLocalInputValue } from "@/lib/dates";
import { CATEGORIES, VIBES } from "@/lib/taxonomy";
import { useNow } from "@/lib/use-now";
import { ErrorText, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { Ticket } from "@/components/ticket/ticket";
import type { ActionState } from "./actions";
import { VenuePicker } from "./venue-picker";

type PayMode = "free" | "door" | "online";
type Preview = { title: string; venue: string; city: string; cover: string; ticketCover: boolean };

const PAY: { key: PayMode; label: string; hint: string }[] = [
  { key: "free", label: "Gratuit", hint: "Lumea se pune pe listă." },
  { key: "door", label: "Plată la ușă", hint: "Rezervă acum, plătește la intrare." },
  { key: "online", label: "Online", hint: "Plătește cu cardul la rezervare." },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Zilele rapide: azi, mâine și următoarele vineri și sâmbătă (fără să le repete pe cele de mai sus).
function quickDays(now: number) {
  if (!now) return [];
  const day = (n: number) => new Date(now + n * 86_400_000);
  const out: { label: string; value: string }[] = [
    { label: "Azi", value: ymd(day(0)) },
    { label: "Mâine", value: ymd(day(1)) },
  ];
  for (const [dow, name] of [
    [5, "Vineri"],
    [6, "Sâmbătă"],
  ] as const) {
    const ahead = (dow - day(0).getDay() + 7) % 7 || 7;
    const v = ymd(day(ahead));
    if (!out.some((o) => o.value === v)) out.push({ label: `${name} ${day(ahead).getDate()}`, value: v });
  }
  return out;
}

// Un pas numerotat: secvența e reală (ce, când, unde, intrarea).
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-(--radius-card) bg-surface border border-line shadow-(--shadow-card) p-5 md:p-6">
      <h2 className="flex items-center gap-3 mb-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-white text-sm font-extrabold" aria-hidden="true">
          {n}
        </span>
        <span className="headline text-[1.9rem]">{title}</span>
      </h2>
      {children}
    </section>
  );
}

const chip = "block cursor-pointer rounded-full border border-line-strong px-3.5 py-2 text-sm font-semibold transition-colors peer-checked:border-transparent peer-focus-visible:outline-3 peer-focus-visible:outline-stamp";

// Evenimentul nou, în patru pași scurți, cu biletul care se completează alături cât scrii.
// Restul (subtitlu, uși, sfârșit, descriere, culoare, capacitate, vizibilitate) stă sub „Mai multe”,
// cu valori bune din start. Se poate publica direct din formular.
export function CreateEventForm({
  action,
  venues,
  defaultCity,
  organizerName,
  sampleQr,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  venues: Venue[];
  defaultCity?: string | null;
  organizerName: string;
  sampleQr: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const now = useNow(60_000);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("21:00");
  const [pay, setPay] = useState<PayMode>("online");
  const [pv, setPv] = useState<Preview>({ title: "", venue: "", city: defaultCity ?? "", cover: "", ticketCover: true });
  const formRef = useRef<HTMLFormElement>(null);
  const startsAt = date && time ? `${date}T${time}` : "";

  // Biletul de alături citește formularul după fiecare schimbare (după randare, ca să prindă și
  // câmpurile ascunse pe care le scrie alegerea locului).
  const sync = () =>
    requestAnimationFrame(() => {
      const f = formRef.current;
      if (!f) return;
      const fd = new FormData(f);
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      const saved = venues.find((v) => v.id === get("venueId"));
      setPv({
        title: get("title"),
        venue: saved?.name ?? get("venueName"),
        city: saved?.city ?? get("city") ?? "",
        cover: get("coverUrl"),
        ticketCover: fd.get("ticketCover") === "on",
      });
    });

  const when = fromLocalInputValue(startsAt);

  return (
    <form ref={formRef} action={formAction} onInput={sync} onChange={sync} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-4 min-w-0">
        <Step n={1} title="Ce">
          <label htmlFor="title" className="sr-only">
            Numele evenimentului
          </label>
          <input
            id="title"
            name="title"
            required
            autoFocus
            placeholder="Numele evenimentului"
            className="w-full border-0 border-b-2 border-line-strong bg-transparent pb-2 font-display font-extrabold text-2xl md:text-3xl outline-none placeholder:text-faint focus:border-stamp"
          />
          {fe.title ? <ErrorText>{fe.title}</ErrorText> : null}

          <p className="mt-5 mb-2 text-sm font-semibold text-ink-2">Ce fel de eveniment</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Categoria">
            {CATEGORIES.map((c) => (
              <label key={c.key} className="shrink-0">
                <input type="radio" name="category" value={c.key} defaultChecked={c.key === "petrecere"} className="peer sr-only" />
                <span className={cx(chip, "peer-checked:bg-ink peer-checked:text-white hover:border-ink")}>{c.label}</span>
              </label>
            ))}
          </div>

          <p className="mt-5 mb-2 text-sm font-semibold text-ink-2">Vibe-ul</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Vibe-ul">
            {VIBES.map((v) => (
              <label key={v.key} title={v.hint}>
                <input type="radio" name="vibe" value={v.key} className="peer sr-only" />
                <span className={cx(chip, "rounded-xl text-center peer-checked:bg-(--vc) peer-checked:text-white")} style={{ ["--vc" as string]: v.color }}>
                  <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: v.color }} aria-hidden="true" />
                  {v.label}
                </span>
              </label>
            ))}
          </div>
        </Step>

        <Step n={2} title="Când">
          <input type="hidden" name="startsAt" value={startsAt} />
          <div className="flex flex-wrap gap-2 mb-3">
            {quickDays(now).map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => {
                  setDate(d.value);
                  sync();
                }}
                className={cx("rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors", date === d.value ? "bg-ink text-white border-ink" : "border-line-strong hover:border-ink")}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" htmlFor="date">
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Ora" htmlFor="time">
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </Field>
          </div>
          {fe.startsAt ? <ErrorText>{fe.startsAt}</ErrorText> : null}
        </Step>

        <Step n={3} title="Unde">
          <VenuePicker venues={venues} initial={{ venueId: null, venueName: null, venueAddress: null, city: null }} defaultCity={defaultCity} errors={fe} bare />
        </Step>

        <Step n={4} title="Intrarea">
          <input type="hidden" name="mode" value={pay === "door" ? "door" : "online"} />
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cum se plătește">
            {PAY.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={pay === p.key}
                onClick={() => setPay(p.key)}
                className={cx("rounded-xl border px-3 py-2.5 text-left transition-colors", pay === p.key ? "bg-ink text-white border-ink" : "border-line-strong hover:border-ink")}
              >
                <span className="block font-bold text-sm">{p.label}</span>
                <span className={cx("block text-xs leading-snug mt-0.5", pay === p.key ? "text-white/70" : "text-muted")}>{p.hint}</span>
              </button>
            ))}
          </div>
          {pay !== "free" ? (
            <Field label="Prețul biletului" htmlFor="price" className="mt-4" hint="Prețul final pentru cumpărător. Mai adaugi tipuri, valuri sau mese după.">
              <div className="relative max-w-48">
                <Input id="price" name="price" inputMode="decimal" placeholder="60" required className="pr-12 text-lg font-bold" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted font-semibold">lei</span>
              </div>
            </Field>
          ) : (
            <p className="mt-3 text-sm text-muted">Intrare liberă, pe listă. Vezi cine vine și scanezi la ușă.</p>
          )}
        </Step>

        <details className="group rounded-(--radius-card) bg-surface border border-line p-5 md:p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-lg">
            Mai multe detalii
            <span className="text-sm font-semibold text-muted group-open:hidden">afiș, descriere, capacitate…</span>
          </summary>
          <div className="mt-5 space-y-4">
            <Field label="Afișul (link către imagine)" htmlFor="coverUrl" error={fe.coverUrl} hint="Apare pe pagină, pe bilet și când trimiți linkul pe WhatsApp.">
              <Input id="coverUrl" name="coverUrl" type="url" placeholder="https://…" />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="ticketCover" defaultChecked className="mt-0.5 size-4 accent-stamp" />
              <span>
                <span className="font-semibold">Afișul pe bilet.</span> Fără bifă, biletul are gradientul Ticketeanu.
              </span>
            </label>
            <Field label="Subtitlu" htmlFor="subtitle" error={fe.subtitle} hint="Line-up, tema, un cârlig scurt.">
              <Input id="subtitle" name="subtitle" placeholder="ex. 3 DJ, 2 ringuri, open bar până la 00:00" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ușile se deschid" htmlFor="doorsAt" error={fe.doorsAt}>
                <Input id="doorsAt" name="doorsAt" type="datetime-local" />
              </Field>
              <Field label="Se termină" htmlFor="endsAt" error={fe.endsAt}>
                <Input id="endsAt" name="endsAt" type="datetime-local" />
              </Field>
            </div>
            <Field label="Descriere" htmlFor="description" error={fe.description}>
              <Textarea id="description" name="description" placeholder="Ce se întâmplă, cine cântă, reguli de acces…" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4">
              <Field label="Capacitate" htmlFor="capacity" error={fe.capacity} hint="Gol = nelimitat.">
                <Input id="capacity" name="capacity" inputMode="numeric" placeholder="ex. 300" />
              </Field>
              <Field label="Cine îl vede" htmlFor="visibility">
                <Select id="visibility" name="visibility" defaultValue="public">
                  <option value="public">Toată lumea, pe hartă</option>
                  <option value="unlisted">Doar cine are linkul</option>
                </Select>
              </Field>
              <Field label="Culoarea" htmlFor="accent" error={fe.accent}>
                <input id="accent" name="accent" type="color" defaultValue="#8A3DFF" className="size-11 rounded-lg border border-line-strong bg-surface p-1" />
              </Field>
            </div>
          </div>
        </details>

        {/* Butoanele stau lipite jos pe telefon, deasupra meniului panoului. */}
        <div className="sticky bottom-14 sm:bottom-3 z-20 rounded-(--radius-card) bg-surface/95 backdrop-blur border border-line shadow-(--shadow-pop) p-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending}
            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink text-white pl-6 pr-2 py-2 font-bold hover:bg-stamp-deep disabled:opacity-60 transition-colors"
          >
            {pending ? "Se publică…" : "Publică acum"}
            <span className="grid size-8 place-items-center rounded-full bg-lime text-ink" aria-hidden="true">
              →
            </span>
          </button>
          <button type="submit" name="intent" value="draft" disabled={pending} className="whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold text-muted hover:text-ink disabled:opacity-60">
            Salvează ca ciornă
          </button>
          <ErrorText>{state.error ?? fe.form}</ErrorText>
        </div>
      </div>

      {/* Biletul, completat în timp real. */}
      <aside className="lg:sticky lg:top-6 rounded-[1.75rem] bg-night p-5 text-white" aria-label="Previzualizarea biletului">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-lime">Așa arată biletul</p>
        <div className="mx-auto max-w-[280px]">
          <Ticket
            title={pv.title || "Numele evenimentului"}
            subtitle={null}
            dayLabel={when ? formatDayShort(when) : "Data"}
            timeLabel={when ? formatTime(when) : "--:--"}
            venue={pv.venue || null}
            city={pv.city || null}
            holder="Numele cumpărătorului"
            typeName={pay === "free" ? "Pe listă" : pay === "door" ? "Plata la ușă" : "Intrare"}
            code="7K3PQ2WX9A"
            orderCode={organizerName}
            qrDataUrl={sampleQr}
            coverUrl={pv.cover || null}
            useCover={pv.ticketCover && Boolean(pv.cover)}
            motionButton={false}
          />
        </div>
        <p className="mt-3 text-center text-xs text-white/60">Cumpărătorii îl primesc pe telefon și pe e-mail, cu cod QR.</p>
      </aside>
    </form>
  );
}
