import { NextResponse, type NextRequest } from "next/server";
import { getYears } from "@/lib/deezer";

export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 10);
  if (!ids.length) return NextResponse.json({ years: {} });
  return NextResponse.json({ years: await getYears(ids) });
}
