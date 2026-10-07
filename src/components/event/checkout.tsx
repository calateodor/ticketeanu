"use client";

import { useActionState, useMemo, useState } from "react";
import { reserveAction, waitlistAction, type ReserveState, type WaitlistState } from "@/app/e/[slug]/actions";
import { compareAtPercent, discountValueLabel, pickDiscount, type DiscountRule } from "@/lib/discounts";
import { calcFee, formatLei } from "@/lib/money";
import { useNow } from "@/lib/use-now";
import { cx } from "@/components/ui";
import { Countdown } from "./countdown";

export type CheckoutType = {
  id: string;
  name: string;
  description: string | null;
  mode: "free" | "door" | "deposit" | "online";
  phaseName: string | null;
  priceBani: number;
  compareAtBani: number | null; // „prețul întreg”, afișat tăiat
  paidNowBani: number;
  dueAtDoorBani: number;
  remaining: number | null;
  onSale: boolean;
  reason: string | null;
  minPerOrder: number;
  maxPerOrder: number;
  lowSeatsHint: boolean; // arătăm „mai sunt N” doar la tipurile cu capacitate mare
};

// Regulile de reducere, serializate pentru client (datele ca numere).
export type CheckoutRule = {
  id: string;
  kind: "audience" | "group" | "timed";
  label: string;
  type: "percent" | "fixed";
  value: number;
  minQuantity: number | null;
  endsAt: number | null;
  proofHint: string | null;
};

export type CheckoutPromo = { code: string; type: "percent" | "fixed"; value: number };

type Props = {
  eventId: string;
  eventSlug: string;
  types: CheckoutType[];
  feeBearer: "buyer" | "organizer";
  feeBps: number;
  askPhone: boolean;
  groupEnabled: boolean;
  groupHoldHours: number;
  waitlistEnabled: boolean;
  group: { code: string; ticketTypeId: string; free: number; name: string } | null;
  offerToken: string | null;
  prCode: string | null;
  source: "direct" | "ticketeanu";
  organizerName: string;
  rules: CheckoutRule[];
  publicPromos: CheckoutPromo[];
};

export function Checkout(props: Props) {
  const { types, feeBearer, feeBps, group } = props;
  const selectable = group ? types.filter((t) => t.id === group.ticketTypeId) : types;
  const [qty, setQty] = useState<Record<string, number>>({});
  const [withGroup, setWithGroup] = useState(false);
  const [groupSize, setGroupSize] = useState(4);
  const [showPromo, setShowPromo] = useState(false);
  const [promoValue, setPromoValue] = useState("");
  const [audienceId, setAudienceId] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ReserveState, FormData>(reserveAction, {});
  const nowMs = useNow(15_000);

  const rules = useMemo<DiscountRule[]>(
    () => props.rules.map((r) => ({ ...r, active: true, startsAt: null, endsAt: r.endsAt ? new Date(r.endsAt) : null })),
    [props.rules],
  );

  const allSoldOut = selectable.length > 0 && selectable.every((t) => !t.onSale && t.reason === "Epuizat") && !props.offerToken;
  const totals = useMemo(() => {
    let subtotal = 0;
    let door = 0;
    let seats = 0;
    const lines = [];
    for (const t of selectable) {
      const q = qty[t.id] ?? 0;
      subtotal += t.paidNowBani * q;
      door += t.dueAtDoorBani * q;
      seats += q;
      if (q > 0) lines.push({ paidNowBani: t.paidNowBani, dueAtDoorBani: t.dueAtDoorBani, quantity: q });
    }
    const applied = nowMs ? pickDiscount({ rules, lines, chosenAudienceId: audienceId, now: new Date(nowMs) }) : null;
    const net = Math.max(0, subtotal - (applied?.onlineBani ?? 0));
    const doorNet = Math.max(0, door - (applied?.doorBani ?? 0));
    const fee = feeBearer === "buyer" ? calcFee(net, feeBps) : 0;
    return { subtotal, net, fee, total: net + fee, door: doorNet, seats, applied };
  }, [qty, selectable, feeBearer, feeBps, rules, audienceId, nowMs]);

  const selectedTypes = selectable.filter((t) => (qty[t.id] ?? 0) > 0);
  const canGroup = props.groupEnabled && selectedTypes.length === 1 && (selectedTypes[0].remaining == null || selectedTypes[0].remaining > (qty[selectedTypes[0].id] ?? 0));
  const groupMax = canGroup ? Math.min(30, selectedTypes[0].remaining ?? 30) : 30;

  const withFee = (bani: number) => (feeBearer === "buyer" ? bani + calcFee(bani, feeBps) : bani);
  const displayPrice = (t: CheckoutType) => withFee(t.paidNowBani);

  const setQ = (t: CheckoutType, next: number) => {
    const max = Math.min(t.maxPerOrder, group ? group.free : t.remaining ?? t.maxPerOrder);
    const v = Math.max(0, Math.min(max, next));
    setQty((q) => ({ ...q, [t.id]: v }));
  };

  if (allSoldOut) {
    return (
      <div>
        <h2 className="font-display font-extrabold text-2xl mb-1">S-a umplut</h2>
        {props.waitlistEnabled ? (
          <>
            <p className="text-night-muted mb-4">Intră pe lista de așteptare. Când cineva renunță, locul ajunge automat la următorul de pe listă.</p>
            <WaitlistForm eventId={props.eventId} askPhone={props.askPhone} />
          </>
        ) : (
          <p className="text-night-muted">Nu mai sunt locuri.</p>
        )}
      </div>
    );
  }

  const ctaLabel = pending
    ? "O clipă…"
    : totals.seats === 0
      ? "Alege locurile"
      : totals.total > 0
        ? `Plătește ${formatLei(totals.total)}`
        : totals.door > 0
          ? "Rezervă locul"
          : "Pune-mă pe listă";

  const timedRules = rules.filter((r) => r.kind === "timed");
  const groupRules = rules.filter((r) => r.kind === "group");
  const audienceRules = rules.filter((r) => r.kind === "audience");
  const hasDiscountBlock = rules.length > 0 || props.publicPromos.length > 0;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="eventId" value={props.eventId} />
      {props.prCode ? <input type="hidden" name="pr" value={props.prCode} /> : null}
      {group ? <input type="hidden" name="groupCode" value={group.code} /> : null}
      {props.offerToken ? <input type="hidden" name="offer" value={props.offerToken} /> : null}
      <input type="hidden" name="source" value={props.source} />
      <input type="hidden" name="discountId" value={audienceId ?? ""} />

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display font-extrabold text-2xl">{group ? "Ia-ți locul în gașcă" : "Alege locul"}</h2>
          <p className="eyebrow normal-case tracking-normal">prețuri finale, fără taxe ascunse</p>
        </div>
        <ul className="space-y-2">
          {selectable.map((t) => {
            const q = qty[t.id] ?? 0;
            const price = displayPrice(t);
            const disabled = !t.onSale;
            const pct = t.mode === "free" ? null : compareAtPercent(t.priceBani, t.compareAtBani);
            const compareShown = pct && t.compareAtBani ? (t.mode === "door" ? t.compareAtBani : withFee(t.mode === "deposit" ? t.paidNowBani : t.compareAtBani)) : null;
            return (
              <li key={t.id} className={cx("rounded-2xl border p-4 transition-colors", q > 0 ? "border-[var(--accent)] glass-strong" : "border-white/10 glass", disabled && "opacity-60")}>
                <input type="hidden" name={`qty[${t.id}]`} value={q} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-lg leading-tight">
                      {t.name}
                      {t.phaseName ? <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-night-muted">{t.phaseName}</span> : null}
                      {pct ? <span className="ml-2 inline-block rounded-md bg-lime text-night text-xs font-extrabold px-1.5 py-0.5 -rotate-2 align-middle">-{pct}%</span> : null}
                    </p>
                    <p className="text-sm text-night-muted mt-0.5">
                      {t.mode === "free"
                        ? "Gratuit, pe listă"
                        : t.mode === "door"
                          ? `${formatLei(t.priceBani)} la intrare, fără plată acum`
                          : t.mode === "deposit"
                            ? `${formatLei(price)} acum, ${formatLei(t.dueAtDoorBani)} la intrare`
                            : "Plată online"}
                    </p>
                    {t.description ? <p className="text-sm mt-1 text-white/80">{t.description}</p> : null}
                    {disabled ? (
                      <p className="text-sm mt-1 font-semibold" style={{ color: "var(--accent)" }}>
                        {t.reason}
                      </p>
                    ) : t.remaining != null && t.remaining <= 10 && t.lowSeatsHint ? (
                      <p className="text-sm mt-1 font-semibold" style={{ color: "var(--accent)" }}>
                        {t.remaining === 1 ? "Ultimul loc" : `Mai sunt ${t.remaining}`}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    {compareShown && t.mode !== "deposit" ? <p className="text-sm text-night-muted line-through tabular">{formatLei(compareShown)}</p> : null}
                    <p className="font-display font-extrabold text-xl">{t.mode === "free" ? "0 lei" : t.mode === "door" ? formatLei(t.priceBani) : formatLei(price)}</p>
                    {!disabled ? (
                      <div className="mt-2 inline-flex items-center rounded-xl border border-white/15 bg-night">
                        <button type="button" aria-label={`Mai puține ${t.name}`} onClick={() => setQ(t, q - 1)} disabled={q <= 0} className="size-10 text-xl disabled:opacity-30">
                          −
                        </button>
                        <span className="w-8 text-center font-bold tabular">{q}</span>
                        <button type="button" aria-label={`Mai multe ${t.name}`} onClick={() => setQ(t, q + 1 < t.minPerOrder ? t.minPerOrder : q + 1)} className="size-10 text-xl">
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {hasDiscountBlock ? (
        <div className="rounded-2xl glass p-4 space-y-3">
          <p className="font-display font-extrabold text-xl">Reduceri</p>
          {timedRules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-lime text-night px-3 py-2">
              <p className="font-bold">
                {r.label} <span className="font-extrabold">{discountValueLabel(r)}</span>
              </p>
              <p className="text-sm font-semibold tabular">
                {r.endsAt ? (
                  <>
                    se termină în <Countdown until={r.endsAt.getTime()} />
                  </>
                ) : (
                  "activă acum"
                )}
              </p>
            </div>
          ))}
          {groupRules.map((r) => {
            const min = r.minQuantity ?? 2;
            const ok = totals.seats >= min;
            return (
              <div key={r.id} className={cx("flex items-center justify-between gap-3 rounded-xl border px-3 py-2", ok ? "border-lime bg-lime/15" : "border-white/15")}>
                <p className="font-semibold">
                  {r.label} <span className="font-extrabold">{discountValueLabel(r)}</span>
                  <span className="block text-xs text-night-muted font-normal">de la {min} locuri într-o comandă</span>
                </p>
                <p className="text-sm font-semibold shrink-0">{ok ? "se aplică" : totals.seats > 0 ? `încă ${min - totals.seats}` : ""}</p>
              </div>
            );
          })}
          {audienceRules.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm text-night-muted mb-1">Ești într-una din categoriile astea? Alegi aici, arăți dovada la intrare.</legend>
              {audienceRules.map((r) => (
                <label key={r.id} className={cx("flex items-start gap-3 rounded-xl border px-3 py-2 cursor-pointer", audienceId === r.id ? "border-lime bg-lime/15" : "border-white/15")}>
                  <input type="checkbox" checked={audienceId === r.id} onChange={() => setAudienceId(audienceId === r.id ? null : r.id)} className="mt-1 size-5 accent-lime" />
                  <span>
                    <span className="font-semibold">
                      {r.label} <span className="font-extrabold">{discountValueLabel(r)}</span>
                    </span>
                    {r.proofHint ? <span className="block text-xs text-night-muted">La intrare arăți {r.proofHint}. Fără dovadă, plătești diferența acolo.</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {props.publicPromos.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-night-muted">Coduri:</span>
              {props.publicPromos.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => {
                    setShowPromo(true);
                    setPromoValue(p.code);
                  }}
                  className={cx("rounded-full border px-3 py-1 text-sm font-mono font-bold", promoValue === p.code ? "bg-white text-night border-white" : "border-white/25 hover:border-white/60")}
                >
                  {p.code} <span className="font-sans font-semibold">{p.type === "percent" ? `-${p.value}%` : `-${formatLei(p.value)}`}</span>
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-night-muted">Reducerile nu se cumulează: pe o comandă se aplică cea mai mare.</p>
        </div>
      ) : null}

      {canGroup ? (
        <div className={cx("rounded-2xl border p-4", withGroup ? "border-[var(--accent)] glass-strong" : "border-white/10 glass")}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="withGroup" checked={withGroup} onChange={(e) => setWithGroup(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
            <span>
              <span className="font-bold text-lg block leading-tight">Vin cu gașca</span>
              <span className="text-sm text-night-muted">
                Ținem locuri și pentru prietenii tăi, {props.groupHoldHours} de ore. Le trimiți un link în grup și fiecare își plătește locul lui.
              </span>
            </span>
          </label>
          {withGroup ? (
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center">
              <label htmlFor="groupSize" className="text-sm text-night-muted">
                Câți sunteți, cu tot cu tine
              </label>
              <div className="inline-flex items-center rounded-xl border border-white/15 bg-night w-fit">
                <button type="button" onClick={() => setGroupSize((s) => Math.max((qty[selectedTypes[0].id] ?? 1) + 1, s - 1))} className="size-10 text-xl">
                  −
                </button>
                <span className="w-8 text-center font-bold tabular">{groupSize}</span>
                <button type="button" onClick={() => setGroupSize((s) => Math.min(groupMax, s + 1))} className="size-10 text-xl">
                  +
                </button>
                <input type="hidden" name="groupSize" id="groupSize" value={groupSize} />
              </div>
              <label htmlFor="groupName" className="text-sm text-night-muted">
                Numele găștii
              </label>
              <input id="groupName" name="groupName" className="field" placeholder="ex. Gașca lui Andrei" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="font-display font-extrabold text-2xl">Pe cine trecem pe listă</h2>
        <input name="name" className="field" placeholder="Numele tău" autoComplete="name" required />
        <input name="email" type="email" className="field" placeholder="E-mail (aici vin biletele)" autoComplete="email" inputMode="email" />
        {props.askPhone ? <input name="phone" type="tel" className="field" placeholder="Telefon" autoComplete="tel" inputMode="tel" /> : null}
        {showPromo ? (
          <input name="promoCode" value={promoValue} onChange={(e) => setPromoValue(e.target.value)} className="field uppercase font-mono" placeholder="Cod de reducere" autoCapitalize="characters" />
        ) : (
          <button type="button" onClick={() => setShowPromo(true)} className="text-sm text-night-muted underline">
            Am un cod de reducere
          </button>
        )}
        <label className="flex items-start gap-2 text-sm text-night-muted">
          <input type="checkbox" name="marketing" className="mt-0.5 size-4 accent-[var(--accent)]" />
          Vreau să aflu de la {props.organizerName} și despre evenimentele următoare.
        </label>
      </div>

      {totals.seats > 0 ? (
        <div className="rounded-2xl glass p-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-night-muted">{totals.seats === 1 ? "1 loc" : `${totals.seats} locuri`}</span>
            <span className="tabular">{totals.total > 0 ? formatLei(totals.total) : totals.door > 0 ? "0 lei acum" : "gratuit"}</span>
          </div>
          {totals.applied ? (
            <div className="flex justify-between text-lime">
              <span>reducere · {totals.applied.rule.label}</span>
              <span className="tabular">−{formatLei(totals.applied.onlineBani + totals.applied.doorBani)}</span>
            </div>
          ) : null}
          {promoValue && !totals.applied ? <p className="text-night-muted text-xs">Codul se verifică și se scade la plată.</p> : null}
          {totals.fee > 0 ? (
            <div className="flex justify-between text-night-muted">
              <span>din care comision Ticketeanu</span>
              <span className="tabular">{formatLei(totals.fee)}</span>
            </div>
          ) : null}
          {totals.door > 0 ? (
            <div className="flex justify-between">
              <span className="text-night-muted">de plătit la intrare</span>
              <span className="tabular">{formatLei(totals.door)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft text-[#a32d2d] text-sm px-4 py-2.5">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || totals.seats === 0}
        className="w-full rounded-2xl py-4 text-lg font-bold text-white transition-transform duration-150 active:scale-[0.99] disabled:opacity-50 shadow-[0_12px_40px_-12px_var(--accent)]"
        style={{ background: "var(--accent)" }}
      >
        {ctaLabel}
      </button>
      <p className="text-xs text-night-muted text-center">
        {totals.total > 0 ? "Plata e cu cardul, pe o pagină sigură. " : ""}
        Primești biletele pe e-mail și pe telefon, cu cod QR.
      </p>
    </form>
  );
}

export function WaitlistForm({ eventId, askPhone }: { eventId: string; askPhone: boolean }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(waitlistAction, {});
  if (state.ok) {
    return <p className="rounded-2xl glass p-4">Ești pe lista de așteptare. Îți scriem pe e-mail dacă se eliberează un loc.</p>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input name="name" className="field" placeholder="Numele tău" required />
      <input name="email" type="email" className="field" placeholder="E-mail" required />
      {askPhone ? <input name="phone" type="tel" className="field" placeholder="Telefon (opțional)" /> : null}
      <div className="flex items-center gap-3">
        <label htmlFor="wq" className="text-sm text-night-muted">
          Câte locuri
        </label>
        <input id="wq" name="quantity" type="number" min={1} max={10} defaultValue={1} className="field w-20" />
      </div>
      {state.error ? <p className="text-sm text-[#ff9aa9]">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-2xl py-4 text-lg font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {pending ? "O clipă…" : "Pune-mă pe lista de așteptare"}
      </button>
    </form>
  );
}
