import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { newId } from "./ids";

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  related?: { type: string; id: string };
};

// Toate e-mailurile trec prin tabela `emails` (outbox). Dacă nu există RESEND_API_KEY,
// rămân acolo și se văd la /dev/emails. Așa testăm tot fluxul fără cont la un furnizor.
export async function sendMail(input: MailInput): Promise<{ id: string; delivered: boolean }> {
  const id = newId();
  await db.insert(emails).values({
    id,
    toEmail: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? null,
    status: "queued",
    relatedType: input.related?.type ?? null,
    relatedId: input.related?.id ?? null,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await db
      .update(emails)
      .set({ status: "sent", provider: "outbox", sentAt: new Date() })
      .where(eq(emails.id, id));
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mail → outbox] ${input.to} · ${input.subject}`);
    }
    return { id, delivered: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? "Ticketeanu <salut@ticketeanu.ro>",
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(body.message ?? `Resend ${res.status}`);
    await db
      .update(emails)
      .set({ status: "sent", provider: "resend", providerRef: body.id ?? null, sentAt: new Date() })
      .where(eq(emails.id, id));
    return { id, delivered: true };
  } catch (err) {
    await db
      .update(emails)
      .set({ status: "failed", provider: "resend", error: String(err) })
      .where(eq(emails.id, id));
    return { id, delivered: false };
  }
}

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

// Un singur șablon, simplu, care arată bine în orice client de mail.
export function renderEmail(opts: {
  title: string;
  intro?: string;
  lines?: string[];
  cta?: { label: string; url: string };
  footer?: string;
  accent?: string;
}): { html: string; text: string } {
  const accent = opts.accent ?? "#5B3FD1";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = (opts.lines ?? []).map((l) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#2B2140">${l}</p>`).join("");
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${opts.cta.url}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;font-size:16px">${esc(opts.cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="ro"><body style="margin:0;background:#F4F3F8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3F8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${accent};font-weight:700">Ticketeanu</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#15102A">${esc(opts.title)}</h1>
${opts.intro ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#2B2140">${esc(opts.intro)}</p>` : ""}
${lines}
${cta}
${opts.footer ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6B6480">${esc(opts.footer)}</p>` : ""}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#8E88A3">Trimis de Ticketeanu în numele organizatorului. Răspunde la acest mesaj dacă ai o întrebare despre eveniment.</p>
</td></tr></table></body></html>`;
  const text = [
    opts.title,
    "",
    opts.intro ?? "",
    ...(opts.lines ?? []).map((l) => l.replace(/<[^>]+>/g, "")),
    opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : "",
    opts.footer ? `\n${opts.footer}` : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return { html, text };
}
