import { randomBytes, randomUUID } from "node:crypto";

// Fără 0/O, 1/I/L ca să se poată dicta la telefon.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newId(): string {
  return randomUUID();
}

export function shortCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function secureToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sixDigitCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

const DIACRITICS: Record<string, string> = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  Ă: "a", Â: "a", Î: "i", Ș: "s", Ş: "s", Ț: "t", Ţ: "t",
};

export function slugify(input: string, maxLength = 60): string {
  const ascii = input
    .split("")
    .map((ch) => DIACRITICS[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "eveniment";
}
