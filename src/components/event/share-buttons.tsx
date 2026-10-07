"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

export function ShareButtons({ url, title, dark = false }: { url: string; title: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title} · ${url}`)}`;
  const btn = cx(
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold border transition-colors",
    dark ? "border-night-line bg-night-2 hover:bg-night-3 text-white" : "border-line-strong bg-surface hover:bg-paper text-ink",
  );
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* anulat */
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <a href={wa} target="_blank" rel="noreferrer" className={btn}>
        Trimite pe WhatsApp
      </a>
      <button type="button" onClick={share} className={btn}>
        {copied ? "Link copiat!" : "Trimite prietenilor"}
      </button>
    </div>
  );
}
