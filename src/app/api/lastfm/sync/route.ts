import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { syncLastfm } from "@/lib/lastfm-sync";

// Called in the background when the diary opens: picks up new album listens from Last.fm.
export async function POST() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ added: 0 }, { status: 401 });
  const res = await syncLastfm(supabase, user.id);
  return NextResponse.json(res);
}
