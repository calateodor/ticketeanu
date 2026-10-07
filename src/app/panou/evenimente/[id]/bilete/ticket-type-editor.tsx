"use client";

import { useActionState, useState, useTransition } from "react";
import type { PricePhase, TicketType } from "@/db/schema";
import { toLocalInputValue } from "@/lib/dates";
import { formatLei } from "@/lib/money";
import { Badge, Button, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";
import { addPhaseAction, deletePhaseAction, deleteTicketTypeAction, upsertTicketTypeAction, type ActionState } from "../../actions";

const modeLabel: Record<TicketType["mode"], string> = {
  free: "Gratuit",
  door: "Plata la intrare",
  deposit: "Avans online, restul la intrare",
  online: "Plată online",
};

export function TicketTypeEditor({
  eventId,
  types,
  phases,
  takenByType,
  soldByPhase,
}: {
  eventId: string;
  types: TicketType[];
  phases: PricePhase[];
  takenByType: Record<string, number>;
  soldByPhase: Record<string, number>;
}) {
  const [adding, setAdding] = useState(types.length === 0);
  return (
    <div className="space-y-4">
      {types.map((t) => (
        <TypeCard key={t.id} eventId={eventId} type={t} phases={phases.filter((p) => p.ticketTypeId === t.id)} taken={takenByType[t.id] ?? 0} soldByPhase={soldByPhase} />
      ))}
      {adding ? (
        <div className="rounded-(--radius-card) border-2 border-dashed border-stamp/40 bg-stamp-soft/30 p-5">
          <h3 className="font-bold mb-3">Tip de bilet nou</h3>
          <TypeForm eventId={eventId} type={null} onDone={() => setAdding(false)} />
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Adaugă un tip de bilet
        </Button>
      )}
    </div>
  );
}

function TypeCard({ eventId, type, phases, taken, soldByPhase }: { eventId: string; type: TicketType; phases: PricePhase[]; taken: number; soldByPhase: Record<string, number> }) {
  const [editing, setEditing] = useState(false);
  const [showPhases, setShowPhases] = useState(phases.length > 0);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-(--radius-card) border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg">{type.name}</h3>
            <Badge tone={type.mode === "free" ? "neutral" : type.mode === "online" ? "stamp" : "warn"}>{modeLabel[type.mode]}</Badge>
            {type.hidden ? <Badge>Ascuns</Badge> : null}
          </div>
          <p className="text-sm text-muted mt-0.5">
            {type.mode === "free" ? "0 lei" : formatLei(type.priceBani)}
            {type.compareAtBani && type.compareAtBani > type.priceBani ? (
              <>
                {" "}
                <s>{formatLei(type.compareAtBani)}</s> <span className="font-bold text-ink">-{Math.round(((type.compareAtBani - type.priceBani) * 100) / type.compareAtBani)}%</span>
              </>
            ) : null}
            {type.mode === "deposit" ? ` · avans ${formatLei(type.depositBani)}` : ""}
            {" · "}
            {taken} {type.capacity ? `din ${type.capacity}` : ""} ocupate · max {type.maxPerOrder}/comandă
          </p>
          {type.description ? <p className="text-sm mt-1">{type.description}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowPhases((v) => !v)}>
            Valuri de preț{phases.length ? ` (${phases.length})` : ""}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Închide" : "Editează"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (confirm(`Ștergi „${type.name}”? Dacă are deja rezervări, va fi doar ascuns.`)) start(() => deleteTicketTypeAction(eventId, type.id));
            }}
          >
            Șterge
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 border-t border-line pt-4">
          <TypeForm eventId={eventId} type={type} onDone={() => setEditing(false)} />
        </div>
      ) : null}

      {showPhases ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-muted mb-3">
            Valurile înlocuiesc prețul de bază: Early Bird până se vând N bilete sau până la o dată, apoi Val 1, Val 2… Când se termină toate, biletul apare „Epuizat”.
          </p>
          {phases.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line mb-3">
              {phases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <span className="font-semibold">{p.name}</span> · {formatLei(p.priceBani)}
                    {p.quantity != null ? ` · ${soldByPhase[p.id] ?? 0}/${p.quantity} vândute` : ""}
                    {p.endsAt ? ` · până la ${toLocalInputValue(p.endsAt).replace("T", " ")}` : ""}
                  </div>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => deletePhaseAction(eventId, p.id))}>
                    Șterge
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <PhaseForm eventId={eventId} typeId={type.id} />
        </div>
      ) : null}
    </div>
  );
}

function TypeForm({ eventId, type, onDone }: { eventId: string; type: TicketType | null; onDone: () => void }) {
  const bound = upsertTicketTypeAction.bind(null, eventId, type?.id ?? null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const r = await bound(prev, fd);
      if (r.ok) onDone();
      return r;
    },
    {},
  );
  const [mode, setMode] = useState<TicketType["mode"]>(type?.mode ?? "online");
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Nume" htmlFor={`name-${type?.id ?? "new"}`} error={fe.name}>
        <Input id={`name-${type?.id ?? "new"}`} name="name" defaultValue={type?.name ?? ""} placeholder="ex. Intrare, VIP, Masă de 6" required />
      </Field>
      <Field label="Cum se ocupă locul" htmlFor="mode">
        <Select name="mode" value={mode} onChange={(e) => setMode(e.target.value as TicketType["mode"])}>
          <option value="online">Plată online, integral</option>
          <option value="deposit">Avans online, restul la intrare</option>
          <option value="door">Rezervare, plata integrală la intrare</option>
          <option value="free">Gratuit (listă)</option>
        </Select>
      </Field>
      {mode !== "free" ? (
        <Field label="Preț (lei)" htmlFor="price" error={fe.price}>
          <Input name="price" inputMode="decimal" defaultValue={type && type.priceBani ? (type.priceBani / 100).toString() : ""} placeholder="60" />
        </Field>
      ) : null}
      {mode !== "free" ? (
        <Field label="Preț întreg (opțional)" htmlFor="compareAt" error={fe.compareAt} hint="Apare tăiat lângă prețul de acum, cu „-X%”, iar evenimentul intră la „Reduceri”.">
          <Input name="compareAt" inputMode="decimal" defaultValue={type?.compareAtBani ? (type.compareAtBani / 100).toString() : ""} placeholder="80" />
        </Field>
      ) : null}
      {mode === "deposit" ? (
        <Field label="Avans (lei)" htmlFor="deposit" error={fe.deposit} hint="Se plătește online acum; restul la intrare.">
          <Input name="deposit" inputMode="decimal" defaultValue={type && type.depositBani ? (type.depositBani / 100).toString() : ""} placeholder="20" />
        </Field>
      ) : null}
      <Field label="Locuri disponibile" htmlFor="capacity" error={fe.capacity} hint="Gol = limitat doar de capacitatea evenimentului.">
        <Input name="capacity" inputMode="numeric" defaultValue={type?.capacity ?? ""} placeholder="ex. 100" />
      </Field>
      <Field label="Maxim pe comandă" htmlFor="maxPerOrder" error={fe.maxPerOrder}>
        <Input name="maxPerOrder" inputMode="numeric" defaultValue={type?.maxPerOrder ?? 10} />
      </Field>
      <Field label="Vânzarea începe (opțional)" htmlFor="salesStartAt" error={fe.salesStartAt}>
        <Input name="salesStartAt" type="datetime-local" defaultValue={toLocalInputValue(type?.salesStartAt)} />
      </Field>
      <Field label="Vânzarea se închide (opțional)" htmlFor="salesEndAt" error={fe.salesEndAt}>
        <Input name="salesEndAt" type="datetime-local" defaultValue={toLocalInputValue(type?.salesEndAt)} />
      </Field>
      <Field label="Descriere (opțional)" htmlFor="description" error={fe.description} className="sm:col-span-2">
        <Textarea name="description" defaultValue={type?.description ?? ""} className="min-h-20" placeholder="ex. include un cocktail; masa e pentru 6 persoane" />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="hidden" defaultChecked={type?.hidden ?? false} className="size-4 accent-stamp" />
        Ascuns pe pagină (se vinde doar prin link direct sau cod)
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvez…" : type ? "Salvează" : "Adaugă biletul"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Renunță
        </Button>
        <ErrorText>{state.error}</ErrorText>
      </div>
    </form>
  );
}

function PhaseForm({ eventId, typeId }: { eventId: string; typeId: string }) {
  const bound = addPhaseAction.bind(null, eventId, typeId);
  const [state, action, pending] = useActionState<ActionState, FormData>(bound, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
      <Field label="Val" htmlFor="pname" error={fe.name}>
        <Input name="name" placeholder="Early Bird" required />
      </Field>
      <Field label="Preț (lei)" htmlFor="pprice" error={fe.price}>
        <Input name="price" inputMode="decimal" placeholder="40" required />
      </Field>
      <Field label="Câte bilete" htmlFor="pqty" error={fe.quantity}>
        <Input name="quantity" inputMode="numeric" placeholder="50" />
      </Field>
      <Field label="Până la" htmlFor="pend" error={fe.endsAt}>
        <Input name="endsAt" type="datetime-local" />
      </Field>
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "…" : "+ Val"}
      </Button>
    </form>
  );
}
