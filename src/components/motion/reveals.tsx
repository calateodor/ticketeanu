"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Reveal-uri în timp, declanșate la intrarea în ecran. Regulile lui Teo: fără scrub, fără pin,
// nimic nu mută scrollul. GSAP se încarcă doar pe client; fără JS, totul rămâne vizibil.
// Marcaje:
//   data-hero           secvența de intrare a paginii (CSS, în globals.css; rulează imediat)
//   data-split          titlu cu <SplitWords>: cuvintele urcă din mască, unul după altul
//   data-reveal         intră de jos când ajunge în ecran; data-reveal="fade" doar opacitate
export function Reveals() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let killed = false;
    let cleanup: (() => void) | null = null;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (killed) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.9;

        // Titlurile despărțite în cuvinte, sub ecran: intră la scroll. Cele din hero intră din CSS
        // (globals.css, [data-hero-root]), din primul cadru, fără să aștepte încărcarea GSAP.
        for (const el of document.querySelectorAll<HTMLElement>("[data-split]")) {
          const words = el.querySelectorAll<HTMLElement>(".split-w");
          if (!words.length || el.closest("[data-hero-root]") || !below(el)) continue;
          gsap.set(words, { yPercent: 110 });
          const play = () => gsap.to(words, { yPercent: 0, duration: 0.6, ease: "power4.out", stagger: 0.045, overwrite: true });
          ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: play });
        }

        // Restul paginii: ce e sub ecran intră când ajunge în ecran, o singură dată.
        const items = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(below);
        for (const el of items) {
          const fade = el.dataset.reveal === "fade";
          gsap.set(el, { opacity: 0, y: fade ? 0 : 20 });
        }
        ScrollTrigger.batch(items, {
          start: "top 90%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.05, overwrite: true }),
        });
      });
      cleanup = () => ctx.revert();
    });

    return () => {
      killed = true;
      cleanup?.();
    };
  }, [pathname]);

  return null;
}
