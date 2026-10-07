"use client";

import { useState } from "react";
import { calcFee, formatLei } from "@/lib/money";
import { cx } from "@/components/ui";

export function FeeCalculator({ feeBps }: { feeBps: number }) {
  const [price, setPrice] = useState(60);
  const [qty, setQty] = useState(150);
  const [bearer, setBearer] = useState<"buyer" | "organizer">("buyer");
  const priceBani = Math.round(price * 100);
  const fee = calcFee(priceBani, feeBps);
  const buyerPays = bearer === "buyer" ? priceBani + fee : priceBani;
  const youGet = bearer === "buyer" ? priceBani : priceBani - fee;
  const toggle = (active: boolean) => cx("flex-1 rounded-xl border px-3 py-2 font-semibold transition-colors", active ? "bg-white text-night border-white" : "border-white/20 text-white hover:border-white/50");

  return (
    <div className="glass rounded-3xl p-6">
      <p className="text-xs uppercase tracking-wider text-night-muted font-semibold">Calculator</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className="text-sm">
          Preț bilet (lei)
          <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="field mt-1" />
        </label>
        <label className="text-sm">
          Bilete vândute
          <input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className="field mt-1" />
        </label>
      </div>
      <div className="mt-4 flex gap-2 text-sm">
        <button type="button" onClick={() => setBearer("buyer")} className={toggle(bearer === "buyer")}>
          Comisionul îl plătește cumpărătorul
        </button>
        <button type="button" onClick={() => setBearer("organizer")} className={toggle(bearer === "organizer")}>
          Îl suport eu
        </button>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-night-muted">Cumpărătorul plătește</dt>
        <dd className="text-right font-semibold tabular">{formatLei(buyerPays)} / bilet</dd>
        <dt className="text-night-muted">Tu primești</dt>
        <dd className="text-right font-semibold tabular">{formatLei(youGet)} / bilet</dd>
        <dt className="text-night-muted">Comision Ticketeanu</dt>
        <dd className="text-right tabular">{formatLei(fee)} / bilet</dd>
        <dt className="font-bold pt-2 border-t border-white/15">Încasezi în total</dt>
        <dd className="text-right font-display font-extrabold text-2xl tabular pt-2 border-t border-white/15">{formatLei(youGet * qty)}</dd>
      </dl>
      <p className="mt-3 text-xs text-night-muted">Fără taxe de procesare adăugate separat. Plata cu cardul e inclusă în comision.</p>
    </div>
  );
}
