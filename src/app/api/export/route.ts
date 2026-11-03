import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

function csvCell(v: unknown) {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Everything you've put into Discomplete, as CSV (your diary) or JSON (all of it). */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const ALBUM = "album:albums(deezer_id, artist, title, release_year, genre)";

  const all = async (table: string, select: string) => {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(select).eq("user_id", user.id).range(from, from + 999);
      if (error || !data?.length) break;
      rows.push(...(data as unknown as Row[]));
      if (data.length < 1000) break;
    }
    return rows;
  };

  const entries = await all("entries", `listened_on, rating, format, kind, note, tags, fav_tracks, is_private, is_anonymous, no_words, created_at, ${ALBUM}`)
    .then((r) => (r.length ? r : all("entries", `listened_on, rating, format, kind, note, tags, is_private, is_anonymous, created_at, ${ALBUM}`)));
  entries.sort((a, b) => String(b.listened_on).localeCompare(String(a.listened_on)));
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const head = ["date", "artist", "album", "year", "rating", "format", "kind", "note", "tags", "private", "deezer_id"];
    const lines = entries.map((e) => {
      const a = (e.album ?? {}) as Row;
      return [e.kind === "before" ? "" : e.listened_on, a.artist, a.title, a.release_year, e.rating, e.format, e.kind === "before" ? "heard before" : e.kind, e.note, e.tags, e.is_private ? "yes" : "no", a.deezer_id].map(csvCell).join(",");
    });
    return new NextResponse("﻿" + [head.join(","), ...lines].join("\r\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="discomplete-diary-${stamp}.csv"` },
    });
  }

  const [toListen, collection, challenges, lists, profile] = await Promise.all([
    all("to_listen", `source, created_at, ${ALBUM}`),
    all("collection", `vinyl, cd, wishlist, ${ALBUM}`),
    all("challenges", "kind, ref, title, created_at"),
    all("lists", "id, title, description, is_public, ranked, created_at, items:list_items(position, note, album:albums(deezer_id, artist, title, release_year))"),
    supabase.from("profiles").select("username, display_name").eq("id", user.id).maybeSingle().then((r) => r.data),
  ]);
  const body = { exported_at: new Date().toISOString(), app: "Discomplete", profile, diary: entries, to_listen: toListen, collection, challenges, lists };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="discomplete-${stamp}.json"` },
  });
}
