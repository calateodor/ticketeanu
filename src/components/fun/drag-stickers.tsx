"use client";

import { useEffect } from "react";

// Stickerele marcate cu data-drag se pot trage cu mouse-ul sau cu degetul și rămân unde le lași.
// Sunt decor (aria-hidden): informația lor apare și în text. Poziția stă în --dx/--dy, citite de
// .sticker (translate), deci înclinarea și animația de lipire rămân neatinse.
export function DragStickers() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-drag]")];
    const offs: (() => void)[] = [];

    for (const el of els) {
      let startX = 0;
      let startY = 0;
      let baseX = 0;
      let baseY = 0;
      let id: number | null = null;

      const down = (e: PointerEvent) => {
        if (e.button !== 0) return;
        id = e.pointerId;
        el.setPointerCapture(id);
        startX = e.clientX;
        startY = e.clientY;
        baseX = Number(el.dataset.dx ?? 0);
        baseY = Number(el.dataset.dy ?? 0);
        el.classList.add("is-dragging");
      };
      const move = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        const x = baseX + e.clientX - startX;
        const y = baseY + e.clientY - startY;
        el.dataset.dx = String(x);
        el.dataset.dy = String(y);
        el.style.setProperty("--dx", `${x}px`);
        el.style.setProperty("--dy", `${y}px`);
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = null;
        el.classList.remove("is-dragging");
      };

      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      offs.push(() => {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      });
    }
    return () => offs.forEach((off) => off());
  }, []);

  return null;
}
