"use client";

import { useSyncExternalStore } from "react";

// Ora curentă, actualizată la interval, fără setState în efect.
// Pe server întoarce 0: componentele arată „…” până la hidratare.
export function useNow(intervalMs = 1000): number {
  return useSyncExternalStore(
    (onChange) => {
      const t = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(t);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => 0,
  );
}
