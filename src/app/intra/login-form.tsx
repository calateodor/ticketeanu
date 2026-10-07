"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "email" });

  if (state.step === "code") {
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="step" value="code" />
        <input type="hidden" name="email" value={state.email ?? ""} />
        <input type="hidden" name="next" value={next} />
        <p className="text-sm">
          Codul a plecat spre <strong>{state.email}</strong>.
        </p>
        {state.devCode ? (
          <p className="text-sm rounded-lg bg-warn-soft text-[#854f0b] px-3 py-2">
            Mod dezvoltare, fără e-mail real. Codul tău: <strong className="font-mono text-base">{state.devCode}</strong>
          </p>
        ) : null}
        <Field label="Codul din e-mail" htmlFor="code" error={state.error}>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            className="font-mono text-2xl tracking-[0.3em] text-center"
            autoFocus
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Verific…" : "Intră"}
        </Button>
        <p className="text-sm text-muted text-center">
          Nu a venit?{" "}
          <button type="button" className="underline" onClick={() => location.reload()}>
            Cere alt cod
          </button>
        </p>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="step" value="email" />
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email" error={state.error}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="tu@exemplu.ro" defaultValue={state.email ?? ""} autoFocus required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Trimit codul…" : "Trimite-mi codul"}
      </Button>
    </form>
  );
}
