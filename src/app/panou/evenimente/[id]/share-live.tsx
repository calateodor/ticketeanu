"use client";

import { useState } from "react";

// Ecranul de după „Publică acum”: linkul, gata de trimis.
export function ShareLive({ publicUrl, title }: { publicUrl: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title} · ${publicUrl}`)}`;
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
    <div className="relative overflow-hidden rounded-[1.75rem] bg-night text-white p-6 md:p-8">
      <span className="sticker stamp-in absolute right-5 top-5 text-xl [--tilt:8deg]" aria-hidden="true">
        E live!
      </span>
      <p className="headline text-[clamp(2.4rem,6vw,3.6rem)] max-w-[14ch]">Gata, lumea poate rezerva.</p>
      <p className="mt-2 text-white/75">Trimite linkul acum: pe grupul de WhatsApp, în story, PR-ilor.</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="min-w-0 max-w-full truncate rounded-full bg-white/10 ring-1 ring-white/20 px-4 py-2.5 font-mono text-sm hover:bg-white/15">
          {copied ? "Copiat!" : publicUrl.replace(/^https?:\/\//, "")}
        </button>
        <a href={wa} target="_blank" rel="noreferrer" className="rounded-full bg-lime text-night px-5 py-2.5 font-bold hover:bg-white transition-colors">
          Trimite pe WhatsApp
        </a>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-full px-4 py-2.5 font-semibold text-white/80 hover:text-white">
          Vezi pagina ↗
        </a>
      </div>
    </div>
  );
}
