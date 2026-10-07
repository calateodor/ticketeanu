"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckInResult, TicketView } from "@/lib/checkin";
import { formatLei } from "@/lib/money";
import { scanAction, searchAction, undoAction } from "./actions";

type Stats = { expected: number; arrived: number };

type BarcodeDetectorLike = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

export function Scanner({ token, eventTitle, eventWhen, doorLabel, initialStats }: { token: string; eventTitle: string; eventWhen: string; doorLabel: string; initialStats: Stats }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState<"idle" | "on" | "error">("idle");
  const [stats, setStats] = useState(initialStats);
  const [last, setLast] = useState<CheckInResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TicketView[]>([]);
  const [manual, setManual] = useState("");
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const streamRef = useRef<MediaStream | null>(null);

  const handleCode = useCallback(
    async (raw: string) => {
      const now = Date.now();
      if (raw === lastCodeRef.current.code && now - lastCodeRef.current.at < 4000) return;
      lastCodeRef.current = { code: raw, at: now };
      setBusy(true);
      try {
        const res = await scanAction(token, raw);
        setLast(res.result);
        setStats(res.stats);
        if (navigator.vibrate) navigator.vibrate(res.result.status === "ok" ? 80 : [60, 60, 60]);
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("idle");
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera("on");
    } catch {
      setCamera("error");
    }
  }, []);

  useEffect(() => {
    if (camera !== "on") return;
    let stop = false;
    const video = videoRef.current!;
    const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
    let jsqr: typeof import("jsqr").default | null = null;
    if (!detector) import("jsqr").then((m) => (jsqr = m.default));

    const tick = async () => {
      if (stop) return;
      if (video.readyState >= 2 && !busy) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) await handleCode(codes[0].rawValue);
          } else if (jsqr) {
            const canvas = canvasRef.current!;
            const w = Math.min(640, video.videoWidth);
            const h = Math.round((w * video.videoHeight) / video.videoWidth) || 480;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const found = jsqr(img.data, w, h, { inversionAttempts: "dontInvert" });
            if (found?.data) await handleCode(found.data);
          }
        } catch {
          /* cadru ratat */
        }
      }
      setTimeout(tick, 250);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [camera, busy, handleCode]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const h = setTimeout(async () => setResults(await searchAction(token, query)), 250);
    return () => clearTimeout(h);
  }, [query, token]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) setResults([]);
  };

  const tone = last?.status === "ok" ? "bg-[#1D9E75]" : last ? "bg-[#C62828]" : "bg-night-2";

  return (
    <div className="night min-h-dvh flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-night-line">
        <div className="min-w-0">
          <p className="font-bold truncate">{eventTitle}</p>
          <p className="text-xs text-night-muted">
            {eventWhen} · {doorLabel}
          </p>
        </div>
        <p className="font-display font-extrabold text-xl tabular shrink-0">
          {stats.arrived}
          <span className="text-night-muted text-sm font-sans font-medium">/{stats.expected}</span>
        </p>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="relative bg-black aspect-square max-h-[48vh] w-full overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {camera !== "on" ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                {camera === "error" ? <p className="text-sm text-[#ff9aa9] mb-3">Nu am acces la cameră. Dă voie din setările browserului sau caută după nume mai jos.</p> : null}
                <button onClick={startCamera} className="rounded-2xl bg-white text-night font-bold px-6 py-3">
                  Pornește camera
                </button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-8 border-2 border-white/60 rounded-3xl pointer-events-none" />
          )}
        </div>

        <div className={`${tone} transition-colors px-4 py-4 min-h-28`}>
          {!last ? (
            <p className="text-night-muted text-sm">Îndreaptă camera spre codul QR. Sau caută după nume.</p>
          ) : last.status === "ok" ? (
            <ResultBlock headline="INTRĂ" ticket={last.ticket} />
          ) : last.status === "already" ? (
            <ResultBlock headline="DEJA SCANAT" ticket={last.ticket} sub={last.ticket.checkedInAt ? `la ${new Date(last.ticket.checkedInAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}${last.ticket.checkedInBy ? `, ${last.ticket.checkedInBy}` : ""}` : undefined} />
          ) : last.status === "cancelled" ? (
            <ResultBlock headline="ANULAT" ticket={last.ticket} sub="Biletul a fost anulat sau rambursat." />
          ) : last.status === "wrong_event" ? (
            <p className="font-display font-extrabold text-3xl">ALT EVENIMENT</p>
          ) : (
            <p className="font-display font-extrabold text-3xl">COD INVALID</p>
          )}
          {last && "ticket" in last && last.status === "ok" ? (
            <button
              className="mt-2 text-sm underline opacity-80"
              onClick={async () => {
                await undoAction(token, last.ticket.id);
                setLast(null);
                setStats((s) => ({ ...s, arrived: Math.max(0, s.arrived - 1) }));
              }}
            >
              Anulează scanarea
            </button>
          ) : null}
        </div>

        <div className="p-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) {
                handleCode(manual.trim());
                setManual("");
              }
            }}
            className="flex gap-2"
          >
            <input value={manual} onChange={(e) => setManual(e.target.value)} className="field font-mono uppercase" placeholder="Cod bilet, ex. 7K3PQ2WX9A" />
            <button className="rounded-xl bg-white text-night font-bold px-4">OK</button>
          </form>
          <input value={query} onChange={(e) => onQueryChange(e.target.value)} className="field" placeholder="Caută după nume, e-mail sau telefon" />
          {results.length > 0 ? (
            <ul className="divide-y divide-night-line rounded-2xl border border-night-line">
              {results.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{t.holderName ?? t.buyerName}</p>
                    <p className="text-xs text-night-muted truncate">
                      {t.typeName} · {t.orderCode}
                      {t.dueAtDoorBani > 0 ? ` · de plătit ${formatLei(t.dueAtDoorBani)}` : ""}
                    </p>
                  </div>
                  {t.status === "valid" ? (
                    <button onClick={() => handleCode(t.code)} className="rounded-xl bg-white text-night text-sm font-bold px-3 py-2">
                      Intră
                    </button>
                  ) : (
                    <span className="text-xs text-night-muted">{t.status === "used" ? "intrat" : "anulat"}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function ResultBlock({ headline, ticket, sub }: { headline: string; ticket: TicketView; sub?: string }) {
  return (
    <div>
      <p className="font-display font-extrabold text-3xl leading-none">{headline}</p>
      <p className="mt-2 text-lg font-semibold">{ticket.holderName ?? ticket.buyerName}</p>
      <p className="text-sm opacity-90">
        {ticket.typeName} · comanda {ticket.orderCode}
        {ticket.seatsInOrder > 1 ? ` · ${ticket.seatsInOrder} locuri în comandă` : ""}
      </p>
      {ticket.dueAtDoorBani > 0 ? <p className="mt-1 font-bold text-lg">De încasat: {formatLei(ticket.dueAtDoorBani)}</p> : null}
      {ticket.discountNote ? <p className="mt-2 inline-block rounded-lg bg-lime text-night font-bold text-sm px-2.5 py-1">Reducere: {ticket.discountNote}</p> : null}
      {sub ? <p className="text-sm opacity-90 mt-1">{sub}</p> : null}
    </div>
  );
}
