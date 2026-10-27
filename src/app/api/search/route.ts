import { NextResponse, type NextRequest } from "next/server";
import { search } from "@/lib/deezer";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ albums: [], tracks: [] });
  try {
    return NextResponse.json(await search(q.slice(0, 100)));
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 502 });
  }
}
