import { NextResponse, type NextRequest } from "next/server";
import { getAlbum } from "@/lib/deezer";
import { createClient } from "@/lib/supabase/server";

// Picking a search result lands here: the record is saved to the shared catalogue
// (or refreshed if it is already there), then the user goes on to its record page.
export async function GET(request: NextRequest, ctx: { params: Promise<{ deezerId: string }> }) {
  const { deezerId } = await ctx.params;
  const id = Number(deezerId);
  const origin = request.nextUrl.origin;
  if (!Number.isInteger(id) || id <= 0) return NextResponse.redirect(new URL("/log", origin));

  const supabase = await createClient();
  const { data: existing } = await supabase.from("albums").select("id").eq("deezer_id", id).maybeSingle();
  let albumId = existing?.id as string | undefined;

  if (!albumId) {
    try {
      const record = await getAlbum(id);
      const { data, error } = await supabase.rpc("upsert_album", { p: record });
      if (error) throw error;
      albumId = data as string;
    } catch {
      return NextResponse.redirect(new URL("/log?error=open", origin));
    }
  }

  const next = request.nextUrl.searchParams.get("then") === "log" ? `/record/${albumId}/log` : `/record/${albumId}`;
  return NextResponse.redirect(new URL(next, origin));
}
