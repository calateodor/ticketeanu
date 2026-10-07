import { NextResponse } from "next/server";
import { db } from "@/db";
import { images } from "@/db/schema";
import { getCurrentOrganizer, getCurrentUser } from "@/lib/auth";
import { newId } from "@/lib/ids";

// Urcarea unui afiș. Doar organizatorii logați, doar JPG/PNG/WebP (fără SVG: poate conține scripturi),
// cel mult 3 MB. Browserul îl micșorează înainte (cover-upload.tsx), deci de obicei are câteva sute de KB.
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 3 * 1024 * 1024;

// Primii octeți confirmă tipul: nu ne bazăm doar pe ce spune browserul.
function sniff(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const ctx = user ? await getCurrentOrganizer(user) : null;
  if (!ctx) return NextResponse.json({ error: "Intră în cont ca organizator." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Nu a venit nicio imagine." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imaginea e prea mare (cel mult 3 MB)." }, { status: 413 });

  const data = Buffer.from(await file.arrayBuffer());
  const type = sniff(data);
  if (!type || !TYPES.has(type)) return NextResponse.json({ error: "Merge doar cu JPG, PNG sau WebP." }, { status: 415 });

  const id = newId();
  await db.insert(images).values({ id, organizerId: ctx.organizer.id, contentType: type, bytes: data.length, data });
  return NextResponse.json({ url: `/img/${id}` });
}
