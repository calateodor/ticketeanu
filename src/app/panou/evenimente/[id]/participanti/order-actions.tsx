"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { cancelOrderAction, resendConfirmationAction } from "../../actions";

export function OrderActions({ eventId, orderId, status, paidOnline, hasEmail }: { eventId: string; orderId: string; status: string; paidOnline: boolean; hasEmail: boolean }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  if (status !== "confirmed") return null;
  return (
    <div className="flex flex-col items-end gap-1">
      {hasEmail ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || sent}
          onClick={() =>
            start(async () => {
              await resendConfirmationAction(eventId, orderId);
              setSent(true);
            })
          }
        >
          {sent ? "Trimis" : "Retrimite biletele"}
        </Button>
      ) : null}
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          const msg = paidOnline ? "Anulezi rezervarea și dai banii înapoi integral (cu tot cu comision)?" : "Anulezi rezervarea? Locul se eliberează.";
          if (confirm(msg)) start(() => cancelOrderAction(eventId, orderId, true));
        }}
      >
        {paidOnline ? "Anulează și rambursează" : "Anulează"}
      </Button>
    </div>
  );
}
