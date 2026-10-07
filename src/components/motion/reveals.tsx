"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Reveal-uri în timp, declanșate la intrarea în ecran. Regulile lui Teo: fără scrub, fără pin,
// nimic nu mută scrollul. GSAP se încarcă doar pe client; fără JS, totul rămâne vizibil.
// Marcaje:
//   data-hero           secvența de intrare a paginii (rulează imediat)
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

        // Titlurile despărțite în cuvinte: în hero pornesc imediat, restul la intrarea în ecran.
        for (const el of document.querySelectorAll<HTMLElement>("[data-split]")) {
          const words = el.querySelectorAll<HTMLElement>(".split-w");
          if (!words.length) continue;
          const inHero = el.closest("[data-hero-root]") != null;
          if (!inHero && !below(el)) continue;
          gsap.set(words, { yPercent: 110 });
          const play = () => gsap.to(words, { yPercent: 0, duration: 0.9, ease: "power4.out", stagger: 0.06, overwrite: true });
          if (inHero) gsap.delayedCall(0.1, play);
          else ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: play });
        }

        // Hero: restul elementelor, după titlu.
        const hero = document.querySelectorAll<HTMLElement>("[data-hero]");
        if (hero.length) {
          gsap.set(hero, { opacity: 0, y: 24 });
          gsap.to(hero, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08, delay: 0.45, overwrite: true });
        }

        // Restul paginii: ce e sub ecran intră când ajunge în ecran, o singură dată.
        const items = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(below);
        for (const el of items) {
          const fade = el.dataset.reveal === "fade";
          gsap.set(el, { opacity: 0, y: fade ? 0 : 26 });
        }
        ScrollTrigger.batch(items, {
          start: "top 90%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08, overwrite: true }),
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
