"use client";

import { useSyncExternalStore } from "react";

// Înclinarea telefonului, o singură ascultare pentru toate biletele de pe pagină.
// x, y între -1 și 1: x = stânga/dreapta (gamma), y = față/spate (beta, față de cum ții telefonul de obicei).
export type Tilt = { x: number; y: number };

// Starea butonului de sub bilet:
//  hidden   - nu e telefon, sau înclinarea deja trimite date
//  ask      - telefon, încă nu avem date: butonul pornește înclinarea (pe iPhone cere permisiunea)
//  insecure - pagina e pe http: telefoanele dau înclinarea doar paginilor pe https
//  denied   - permisiunea a fost refuzată
export type MotionState = "hidden" | "ask" | "insecure" | "denied";

const tiltSubs = new Set<(t: Tilt) => void>();
const stateSubs = new Set<() => void>();
let listening = false;
let receiving = false;
let denied = false;
let triedInsecure = false;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const notify = () => {
  for (const fn of stateSubs) fn();
};

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  if (!receiving) {
    receiving = true;
    notify();
  }
  const t = { x: clamp(e.gamma / 30), y: clamp((e.beta - 45) / 30) };
  for (const fn of tiltSubs) fn(t);
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("deviceorientation", onOrientation);
}

type DOEWithPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export async function requestMotion(): Promise<void> {
  if (!window.isSecureContext) {
    triedInsecure = true;
    notify();
    return;
  }
  const DOE = (typeof DeviceOrientationEvent === "undefined" ? undefined : DeviceOrientationEvent) as unknown as DOEWithPermission | undefined;
  try {
    const res = DOE?.requestPermission ? await DOE.requestPermission() : "granted";
    if (res === "granted") listen();
    else denied = true;
  } catch {
    denied = true;
  }
  notify();
}

// Android: fără permisiune, pornim direct (merge doar pe https).
export function autoStartMotion() {
  if (!isTouch() || typeof DeviceOrientationEvent === "undefined" || !window.isSecureContext) return;
  const DOE = DeviceOrientationEvent as unknown as DOEWithPermission;
  if (typeof DOE.requestPermission !== "function") listen();
}

export function subscribeTilt(fn: (t: Tilt) => void): () => void {
  tiltSubs.add(fn);
  return () => tiltSubs.delete(fn);
}

function snapshot(): MotionState {
  if (!isTouch() || receiving) return "hidden";
  if (denied) return "denied";
  if (triedInsecure) return "insecure";
  return "ask";
}

export function useMotionState(): MotionState {
  return useSyncExternalStore(
    (cb) => {
      stateSubs.add(cb);
      return () => stateSubs.delete(cb);
    },
    snapshot,
    () => "hidden",
  );
}
