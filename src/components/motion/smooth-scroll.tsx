"use client";

import { useEffect } from "react";

// Lenis: singurul motor de scroll lin al site-ului, doar pe paginile de prezentare (prima pagină,
// /organizatori). Harta și rezervarea rămân pe scroll nativ. Legat de GSAP ScrollTrigger: același
// ceas, aceleași măsurători. Nu mută niciodată scrollul singur. Reduced motion: nu pornește deloc.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let killed = false;
    let destroy: (() => void) | null = null;

    Promise.all([import("lenis"), import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
      if (killed) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.16, smoothWheel: true });
      const onScroll = () => ScrollTrigger.update();
      lenis.on("scroll", onScroll);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      // Măsurătorile se refac după fonturi și imagini.
      const refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(refresh).catch(() => {});
      window.addEventListener("load", refresh);

      destroy = () => {
        window.removeEventListener("load", refresh);
        gsap.ticker.remove(tick);
        lenis.off("scroll", onScroll);
        lenis.destroy();
      };
    });

    return () => {
      killed = true;
      destroy?.();
    };
  }, []);

  return null;
}
