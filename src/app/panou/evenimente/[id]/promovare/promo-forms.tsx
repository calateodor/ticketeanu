"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { createPrLinkAction, createPromoAction, togglePrLinkAction, togglePromoAction, type ActionState } from "../../actions";

export function PrForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPrLinkAction.bind(null, eventId), {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
      <Field label="Numele PR-ului" htmlFor="prname" error={fe.name}>
        <Input name="name" placeholder="ex. Andrei" required />
      </Field>
      <Field label="Comision" htmlFor="ctype">
        <Select name="commissionType" defaultValue="percent">
          <option value="percent">% din vânzări</option>
          <option value="fixed">lei / bilet</option>
        </Select>
      </Field>
      <Field label="Valoare" htmlFor="cval" error={fe.commissionValue}>
        <Input name="commissionValue" inputMode="decimal" placeholder="10" className="w-24" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "+ Link de PR"}
      </Button>
    </form>
  );
}

export function PrToggle({ eventId, prId, active, url }: { eventId: string; prId: string; active: boolean; url: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(url).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copiat!" : "Copiază"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => togglePrLinkAction(eventId, prId, !active))}>
        {active ? "Oprește" : "Pornește"}
      </Button>
    </div>
  );
}

export function PromoForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPromoAction.bind(null, eventId), {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
      <Field label="Cod" htmlFor="pcode" error={fe.code}>
        <Input name="code" placeholder="PRIETENI" className="uppercase font-mono" required />
      </Field>
      <Field label="Tip" htmlFor="ptype">
        <Select name="type" defaultValue="percent">
          <option value="percent">% reducere</option>
          <option value="fixed">lei reducere</option>
        </Select>
      </Field>
      <Field label="Valoare" htmlFor="pval" error={fe.value}>
        <Input name="value" inputMode="decimal" placeholder="20" className="w-24" required />
      </Field>
      <Field label="Utilizări max." htmlFor="pmax">
        <Input name="maxUses" inputMode="numeric" placeholder="∞" className="w-24" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "+ Cod"}
      </Button>
    </form>
  );
}

export function PromoToggle({ eventId, promoId, active }: { eventId: string; promoId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => togglePromoAction(eventId, promoId, !active))}>
      {active ? "Oprește" : "Pornește"}
    </Button>
  );
}

