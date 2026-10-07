import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";

// Afișele urcate (vezi /api/upload). O imagine nu se schimbă niciodată sub același id, deci
// cache-ul poate fi de un an, inclusiv pe CDN.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [img] = await db.select({ contentType: images.contentType, data: images.data }).from(images).where(eq(images.id, id)).limit(1);
  if (!img) return new Response("Nu există.", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
