import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchAddress } from "@/lib/geocode";

// Doar pentru organizatorii logați: altfel oricine ar putea consuma limita Nominatim prin noi.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Intră în cont." }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const hits = await searchAddress(q);
    return NextResponse.json({ hits });
  } catch {
    return NextResponse.json({ hits: [], error: "Căutarea nu a mers. Mută pinul pe hartă." }, { status: 200 });
  }
}
