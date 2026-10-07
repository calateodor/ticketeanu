"use client";

import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui";
import { cancelEventAction, setEventStatusAction } from "../actions";

export function EventHeaderActions({ eventId, status, publicUrl }: { eventId: string; status: string; publicUrl: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponibil */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-sm text-danger">{error}</span> : null}
      <Button variant="secondary" onClick={copy}>
        {copied ? "Copiat!" : "Copiază linkul"}
      </Button>
      <LinkButton variant="secondary" href={publicUrl} target="_blank">
        Vezi pagina
      </LinkButton>
      {status === "draft" || status === "ended" ? (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                await setEventStatusAction(eventId, "published");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Nu am putut publica.");
              }
            })
          }
        >
          {pending ? "…" : "Publică"}
        </Button>
      ) : null}
      {status === "published" ? (
        <>
          <Button variant="ghost" disabled={pending} onClick={() => start(() => setEventStatusAction(eventId, "draft"))}>
            Retrage
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (confirm("Anulezi evenimentul? Toate rezervările se anulează, iar banii plătiți online se dau înapoi integral.")) {
                start(() => cancelEventAction(eventId));
              }
            }}
          >
            Anulează evenimentul
          </Button>
        </>
      ) : null}
    </div>
  );
}
