"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui";
import { buyerCancelAction, retryPaymentAction, type CancelState } from "./actions";

export function OrderControls({ token, mode, paid = false }: { token: string; mode: "pay" | "cancel"; paid?: boolean }) {
  const [state, cancel, cancelling] = useActionState<CancelState, void>(() => buyerCancelAction(token), {});
  const [pending, start] = useTransition();

  if (mode === "pay") {
    return (
      <div className="mt-3">
        <Button variant="night" onClick={() => start(() => retryPaymentAction(token))} disabled={pending}>
          {pending ? "…" : "Plătește acum"}
        </Button>
      </div>
    );
  }

  if (state.ok) return <p className="text-center text-sm text-[#7ee2c0] font-semibold">Ai renunțat la loc. Mulțumim că ai anunțat.</p>;

  return (
    <form
      action={() => {
        if (confirm(paid ? "Renunți la rezervare? Dacă politica evenimentului permite, banii se întorc integral." : "Renunți la loc? Îl dăm următorului de pe listă.")) cancel();
      }}
      className="text-center"
    >
      <button type="submit" disabled={cancelling} className="text-sm text-night-muted underline hover:text-white">
        {cancelling ? "…" : "Nu mai pot veni"}
      </button>
      {state.error ? <p className="text-sm text-[#ff9aa9] mt-2">{state.error}</p> : null}
    </form>
  );
}
