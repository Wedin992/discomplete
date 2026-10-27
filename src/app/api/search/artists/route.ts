import { NextResponse, type NextRequest } from "next/server";
import { searchArtists } from "@/lib/deezer";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ artists: [] });
  try {
    return NextResponse.json({ artists: await searchArtists(q.slice(0, 100)) });
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
