import { NextResponse, type NextRequest } from "next/server";
import { mailMondayDigest } from "@/lib/party-mail";
import { mondayOf } from "@/lib/clubs";
import { todayIso } from "@/lib/format";

/** Vercel Cron, Mondays: email every listening party its album of the week. Guarded by CRON_SECRET. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const result = await mailMondayDigest(mondayOf(todayIso()));
  return NextResponse.json(result);
}
