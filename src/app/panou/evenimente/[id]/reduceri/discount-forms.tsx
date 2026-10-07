"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { createDiscountAction, deleteDiscountAction, setPromoPublicAction, toggleDiscountAction, type ActionState } from "../../actions";

type Kind = "audience" | "group" | "timed";

export function DiscountForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createDiscountAction.bind(null, eventId), {});
  const [kind, setKind] = useState<Kind>("group");
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="rounded-(--radius-card) border border-line bg-surface p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
      <Field label="Felul" htmlFor="dkind" className="col-span-2 sm:col-span-1">
        <Select id="dkind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="group">Grup (de la N locuri)</option>
          <option value="timed">Pe timp limitat</option>
          <option value="audience">Categorie de oameni</option>
        </Select>
      </Field>
      <Field label="Numele" htmlFor="dlabel" error={fe.label} className="col-span-2 sm:col-span-1">
        <Input id="dlabel" name="label" placeholder={kind === "group" ? "Gașca de 5+" : kind === "timed" ? "Happy hour" : "Studenți"} required />
      </Field>
      <Field label="Cât scade" htmlFor="dtype">
        <Select id="dtype" name="type" defaultValue="percent">
          <option value="percent">% din preț</option>
          <option value="fixed">lei pe loc</option>
        </Select>
      </Field>
      <Field label="Valoare" htmlFor="dvalue" error={fe.value}>
        <Input id="dvalue" name="value" inputMode="decimal" placeholder="10" required />
      </Field>
      {kind === "group" ? (
        <Field label="De la câte locuri" htmlFor="dmin" error={fe.minQuantity} className="col-span-2 sm:col-span-1">
          <Input id="dmin" name="minQuantity" inputMode="numeric" placeholder="5" />
        </Field>
      ) : null}
      {kind === "timed" ? (
        <>
          <Field label="Începe (opțional)" htmlFor="dstart" error={fe.startsAt} className="col-span-2 sm:col-span-1">
            <Input id="dstart" name="startsAt" type="datetime-local" />
          </Field>
          <Field label="Se termină" htmlFor="dend" error={fe.endsAt} className="col-span-2 sm:col-span-1">
            <Input id="dend" name="endsAt" type="datetime-local" required />
          </Field>
        </>
      ) : null}
      {kind === "audience" ? (
        <Field label="Ce arată la intrare" htmlFor="dproof" error={fe.proofHint} className="col-span-2" hint="Apare pe bilet și la scanare, ca omul de la ușă să știe ce să ceară.">
          <Input id="dproof" name="proofHint" placeholder="legitimația de student" />
        </Field>
      ) : null}
      <div className="col-span-2 sm:col-span-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "+ Reducere"}
        </Button>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      </div>
    </form>
  );
}

export function DiscountActions({ eventId, discountId, active }: { eventId: string; discountId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => toggleDiscountAction(eventId, discountId, !active))}>
        {active ? "Oprește" : "Pornește"}
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm("Ștergi reducerea? Comenzile deja făcute rămân cum sunt.")) start(() => deleteDiscountAction(eventId, discountId));
        }}
      >
        Șterge
      </Button>
    </div>
  );
}

export function PromoPublicToggle({ eventId, promoId, isPublic }: { eventId: string; promoId: string; isPublic: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(() => setPromoPublicAction(eventId, promoId, !isPublic))}>
      {isPublic ? "Ascunde de pe pagină" : "Arată pe pagină"}
    </Button>
  );
}
