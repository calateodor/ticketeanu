"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, Input, LinkButton } from "@/components/ui";
import { createDoorTokenAction, revokeDoorTokenAction, type ActionState } from "../../actions";

export function DoorCreateForm({ eventId }: { eventId: string }) {
  const [, action, pending] = useActionState<ActionState, FormData>(createDoorTokenAction.bind(null, eventId), {});
  return (
    <form action={action} className="flex gap-3 items-end max-w-md">
      <Field label="Cine scanează" htmlFor="label" className="flex-1">
        <Input name="label" placeholder="ex. Poarta 1, Andrei" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "+ Link"}
      </Button>
    </form>
  );
}

export function DoorTokenActions({ eventId, tokenId, url }: { eventId: string; tokenId: string; url: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`Link de scanare: ${url}`)}`;
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
      <LinkButton variant="secondary" size="sm" href={wa} target="_blank">
        WhatsApp
      </LinkButton>
      <LinkButton variant="secondary" size="sm" href={url} target="_blank">
        Deschide
      </LinkButton>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => revokeDoorTokenAction(eventId, tokenId))}>
        Oprește
      </Button>
    </div>
  );
}

