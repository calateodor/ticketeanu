"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";
import { Barcode } from "./barcode";
import { autoStartMotion, requestMotion, subscribeTilt, useMotionState, type Tilt } from "./motion";

export type TicketProps = {
  title: string;
  subtitle?: string | null;
  dayLabel: string; // „Sâm 18 oct”
  timeLabel: string; // „23:00”
  venue?: string | null;
  city?: string | null;
  holder: string;
  typeName: string;
  code: string; // codul biletului
  orderCode?: string | null;
  qrDataUrl?: string | null;
  coverUrl?: string | null; // afișul evenimentului, color, pe fundalul biletului
  useCover?: boolean; // organizatorul a bifat „afișul pe bilet”
  status?: "valid" | "used" | "cancelled" | "pending";
  discountNote?: string | null;
  dueAtDoorLabel?: string | null;
  index?: number; // „Bilet 2 din 3”
  count?: number;
  animate?: boolean; // iese din aparat
  motionButton?: boolean; // butonul „Mișcă telefonul” (o dată pe pagină)
  className?: string;
};

const MAX_DEG = 6; // cât se înclină biletul, cel mult

// Lumina de pe bilet: înclinarea (telefon sau cursor) mută o bandă diagonală care aprinde
// granulația, irizat. Totul prin variabile CSS scrise direct pe element, fără re-randări.
function useSparkle(animateIn: boolean) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let target: Tilt = { x: 0, y: 0 };
    const cur: Tilt = { x: 0, y: 0 };
    let raf = 0;
    let last = 0;
    let sweepUntil = 0;
    let sweepFrom = 0;

    const write = (t: Tilt) => {
      const mag = Math.min(1, Math.hypot(t.x, t.y));
      // Banda merge de la colțul din stânga-sus la cel din dreapta-jos după direcția înclinării.
      const band = 50 + (t.x * 0.7 + t.y * 0.45) * 75;
      wrap.style.setProperty("--rx", `${(-t.y * MAX_DEG).toFixed(2)}deg`);
      wrap.style.setProperty("--ry", `${(t.x * MAX_DEG).toFixed(2)}deg`);
      wrap.style.setProperty("--band", `${band.toFixed(1)}%`);
      // Culorile alunecă mai repede decât banda; fațetele sclipiciului se deplasează în sens opus.
      wrap.style.setProperty("--holo-y", `${(50 + t.y * 70 + t.x * 45).toFixed(1)}%`);
      wrap.style.setProperty("--gx", `${(t.x * 26).toFixed(1)}px`);
      wrap.style.setProperty("--gy", `${(t.y * 26).toFixed(1)}px`);
      // Se aprinde repede: la o treime din înclinare e deja la maxim.
      wrap.style.setProperty("--lit", `${Math.min(1, mag * 3).toFixed(3)}`);
    };

    const tick = (ts: number) => {
      if (last === 0) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      if (ts < sweepUntil) {
        // Prima trecere: biletul abia a ieșit și lumina îl mătură o dată, de la stânga la dreapta.
        const p = (ts - sweepFrom) / (sweepUntil - sweepFrom);
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        target = { x: -0.9 + 1.8 * e, y: -0.45 + 0.9 * e };
        if (p > 0.92) target = { x: 0, y: 0 };
      }
      const k = 1 - Math.exp(-dt / 0.08);
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      write(cur);
      raf = requestAnimationFrame(tick);
    };

    const startSweep = () => {
      sweepFrom = performance.now();
      sweepUntil = sweepFrom + 1000;
    };
    // Lumina trece peste bilet cum iese din imprimantă (.ticket-print: 0,25 s pauză + 1 s).
    const sweepTimer = window.setTimeout(startSweep, animateIn ? 1250 : 300);
    raf = requestAnimationFrame(tick);

    // Desktop: cursorul peste bilet.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = card.getBoundingClientRect();
      sweepUntil = 0;
      target = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 };
    };
    const onLeave = () => {
      target = { x: 0, y: 0 };
    };
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);

    // Telefon: înclinarea.
    const unsub = subscribeTilt((t) => {
      sweepUntil = 0;
      target = t;
    });
    autoStartMotion();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(sweepTimer);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      unsub();
    };
  }, [animateIn]);

  return { wrapRef, cardRef };
}

export function Ticket(p: TicketProps) {
  const { wrapRef, cardRef } = useSparkle(Boolean(p.animate));
  const motion = useMotionState();
  const showMotion = motion !== "hidden" && (p.motionButton ?? true);
  const withCover = Boolean(p.useCover && p.coverUrl);
  const status = p.status ?? "valid";
  const dim = status === "cancelled" || status === "pending";

  return (
    <div className={p.className}>
      <div className={p.animate ? "ticket-print" : undefined}>
        <div ref={wrapRef} className="tk-wrap">
          <div ref={cardRef} className="tk-tilt">
            <article
              className={cx("ticket-shape relative overflow-hidden text-white select-none [container-type:inline-size]", !withCover && "sunset", dim && "saturate-50 opacity-80")}
              style={{ aspectRatio: "0.64" }}
            >
              {withCover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverUrl!} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
              <div className="tk-scrim" aria-hidden="true" />
              <div className="tk-grain-rest" aria-hidden="true" />
              <div className="tk-grain-lit" aria-hidden="true" />
              <div className="tk-grain-core" aria-hidden="true" />

              <div className="tk-content">
                {/* Partea mare */}
                <div className="absolute inset-x-0 top-0 p-5" style={{ height: "68%" }}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-block rounded-md bg-white px-2 py-1 font-display font-extrabold text-[11px] tracking-[0.2em] uppercase text-night">Ticketeanu</span>
                    <div className="flex flex-col items-end">
                      <div className="h-[2px] w-20 bg-white/90" />
                      <Barcode code={p.code} className="mt-1 h-20 w-5 text-white/90" vertical />
                    </div>
                  </div>

                  <div className="absolute left-5 right-5 bottom-5">
                    <p className="eyebrow text-white/75">{p.orderCode ?? p.code}</p>
                    {/* Mărimea ține de lățimea biletului (container), iar titlurile lungi se opresc la trei rânduri. */}
                    <p className="headline mt-1 text-[clamp(1.5rem,11.5cqw,3rem)] line-clamp-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">{p.title}</p>
                    <div className="mt-2 border-t-2 border-white/85" />
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="font-display font-extrabold text-lg leading-tight truncate">{p.subtitle ?? p.venue ?? "Intrare"}</p>
                      <p className="shrink-0 font-display font-extrabold text-sm text-white/90">{p.timeLabel}</p>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                      <div>
                        <dt className="eyebrow text-white/65">Când</dt>
                        <dd className="font-semibold">{p.dayLabel}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-white/65">Unde</dt>
                        <dd className="font-semibold truncate">{[p.venue, p.city].filter(Boolean).join(", ") || "Se anunță"}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-white/65">Pe numele</dt>
                        <dd className="font-semibold truncate">{p.holder}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-white/65">Loc</dt>
                        <dd className="font-semibold truncate">{p.typeName}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Linia de rupere */}
                <div className="absolute inset-x-6 ticket-tear" style={{ top: "68%" }} />

                {/* Cotorul: QR + cod */}
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 p-5" style={{ height: "32%" }}>
                  <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-lg">
                    {p.qrDataUrl && status !== "cancelled" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.qrDataUrl} alt={`Cod QR ${p.code}`} className="size-[88px] block" />
                    ) : (
                      <div className="size-[88px] grid place-items-center text-center text-[11px] font-semibold text-ink/70 leading-tight">{status === "cancelled" ? "Anulat" : "Plata lipsește"}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-base tracking-wider">{p.code}</p>
                    {p.count && p.count > 1 ? (
                      <p className="eyebrow text-white/65">
                        Bilet {p.index ?? 1} din {p.count}
                      </p>
                    ) : null}
                    {status === "used" ? <p className="mt-1 text-xs font-bold">Scanat la intrare</p> : null}
                    {p.dueAtDoorLabel ? <p className="mt-1 text-xs font-bold">La intrare: {p.dueAtDoorLabel}</p> : null}
                    {p.discountNote ? <p className="mt-1 text-xs font-semibold leading-tight text-lime">{p.discountNote}</p> : null}
                    <Barcode code={p.orderCode ?? p.code} className="mt-2 h-7 w-full text-white/85" />
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
      {showMotion ? (
        <div className="mt-3 flex justify-center text-center">
          {motion === "ask" ? (
            <button type="button" onClick={() => requestMotion()} className="glass rounded-full px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/15">
              Mișcă telefonul ca să prindă lumina
            </button>
          ) : (
            <p className="text-xs text-night-muted max-w-xs">
              {motion === "insecure" ? "Telefonul dă voie la înclinare doar pe paginile cu https. Deschide pagina pe https." : "Ai refuzat accesul la mișcare. Îl poți porni din setările browserului."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Imprimanta de bilete: carcasa cu fantă, LED și eticheta; biletul iese pe dedesubt în patru
// smucituri, se rupe, cade puțin înclinat și i se lipește stickerul. Totul e CSS (.printer-*,
// .ticket-print), pe aceleași variabile: merge și fără JS.
export function TicketMachine({ children, label = "Ticketeanu · print", sticker }: { children: React.ReactNode; label?: string; sticker?: string }) {
  return (
    <div className="printer">
      <div className="printer-head" aria-hidden="true">
        <span className="printer-label">{label}</span>
        <span className="printer-led" />
        <div className="printer-slot">
          <span className="printer-beam" />
        </div>
      </div>
      <div className="printer-feed">{children}</div>
      {sticker ? (
        <span className="printer-sticker sticker [--tilt:-9deg]" aria-hidden="true">
          {sticker}
        </span>
      ) : null}
    </div>
  );
}
