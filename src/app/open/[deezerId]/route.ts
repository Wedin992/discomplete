import { NextResponse, type NextRequest } from "next/server";
import { getAlbum } from "@/lib/deezer";
import { createClient } from "@/lib/supabase/server";
import { logPath, recordPath, type Album } from "@/lib/format";

// Picking a search result lands here: the record is saved to the shared catalogue
// (or refreshed if it is already there), then the user goes on to its record page.
export async function GET(request: NextRequest, ctx: { params: Promise<{ deezerId: string }> }) {
  const { deezerId } = await ctx.params;
  const id = Number(deezerId);
  const origin = request.nextUrl.origin;
  if (!Number.isInteger(id) || id <= 0) return NextResponse.redirect(new URL("/log", origin));

  const supabase = await createClient();
  const find = async () => {
    const { data } = await supabase.from("albums").select("*").eq("deezer_id", id).maybeSingle();
    return data as Album | null;
  };

  let album = await find();
  if (!album) {
    try {
      const record = await getAlbum(id);
      const { error } = await supabase.rpc("upsert_album", { p: record });
      if (error) throw error;
      album = await find();
      if (!album) throw new Error("Album not found after saving");
    } catch {
      return NextResponse.redirect(new URL("/log?error=open", origin));
    }
  }

  const next = request.nextUrl.searchParams.get("then") === "log" ? logPath(album) : recordPath(album);
  return NextResponse.redirect(new URL(next, origin));
}
