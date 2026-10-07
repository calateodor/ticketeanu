"use client";

import { useRef, useState } from "react";
import { cx } from "@/components/ui";

const MAX_SIDE = 1600; // latura cea mai lungă după micșorare
const MAX_BYTES = 3 * 1024 * 1024;

// Micșorează poza în browser (JPEG, ~0,82), ca urcarea să fie rapidă și pe date mobile.
// JPEG, nu WebP: imaginea de previzualizare a linkului (opengraph) citește sigur JPEG.
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (out) return out;
  } catch {
    /* formatul nu se poate desena: urcăm fișierul așa cum e, dacă e mic */
  }
  return file;
}

// Afișul evenimentului: îl urci de pe telefon sau calculator (merge și un link, ca rezervă).
// Valoarea pleacă în formular ca `name` (implicit coverUrl): /img/… pentru pozele urcate.
export function CoverUpload({ name = "coverUrl", defaultValue = "", onChange, error }: { name?: string; defaultValue?: string; onChange?: (url: string) => void; error?: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (v: string) => {
    setUrl(v);
    onChange?.(v);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith("image/")) return setErr("Alege o imagine (JPG sau PNG).");
    setBusy(true);
    try {
      const blob = await shrink(file);
      if (blob.size > MAX_BYTES) throw new Error("Imaginea e prea mare (cel mult 3 MB).");
      const fd = new FormData();
      fd.append("file", blob, "afis.jpg");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Nu am putut urca afișul. Mai încearcă o dată.");
      set(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nu am putut urca afișul.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const shown = err ?? error;

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" id={`${name}-file`} onChange={(e) => upload(e.target.files?.[0])} />

      {url ? (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Afișul evenimentului" className="h-28 w-[5.6rem] shrink-0 rounded-xl object-cover bg-line" />
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold">Afișul e pus.</p>
            <div className="flex flex-wrap gap-2">
              <label htmlFor={`${name}-file`} className="cursor-pointer rounded-full border border-line-strong px-3 py-1.5 text-sm font-semibold hover:border-ink">
                {busy ? "Se încarcă…" : "Schimbă"}
              </label>
              <button type="button" onClick={() => set("")} className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:text-danger">
                Scoate
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={`${name}-file`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files?.[0]);
          }}
          className={cx(
            "flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-line-strong px-4 py-4 transition-colors hover:border-stamp hover:bg-stamp-soft/40",
            busy && "pointer-events-none opacity-70",
          )}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-xl font-bold text-lime" aria-hidden="true">
            {busy ? "…" : "+"}
          </span>
          <span>
            <span className="block font-bold">{busy ? "Se încarcă afișul…" : "Adaugă afișul"}</span>
            <span className="block text-sm text-muted">Din telefon sau calculator. Apare pe pagină, pe bilet și pe WhatsApp.</span>
          </span>
        </label>
      )}

      {shown ? (
        <p role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {shown}
        </p>
      ) : null}

      {linkMode ? (
        <input
          type="url"
          placeholder="https://… (link către imagine)"
          defaultValue={url.startsWith("http") ? url : ""}
          onChange={(e) => set(e.target.value.trim())}
          className="field mt-2"
          aria-label="Linkul afișului"
        />
      ) : (
        <button type="button" onClick={() => setLinkMode(true)} className="mt-1.5 text-sm text-muted underline hover:text-ink">
          sau pune un link către imagine
        </button>
      )}
    </div>
  );
}
