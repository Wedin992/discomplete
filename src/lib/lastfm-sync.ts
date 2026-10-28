// Server-only: turns new scrobbles into "Looks like you listened to …" suggestions.
import type { getUser } from "@/lib/supabase/server";
import { getAlbum } from "@/lib/deezer";
import { getRecentScrobbles, lastfmConfigured, looseName, spotAlbumListens, type AlbumListen } from "@/lib/lastfm";
import { todayIso } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];
export type Link = { username: string; autolog: boolean; synced_at: string | null };

const FIRST_LOOK_DAYS = 14; // on connecting: look back this far
const THROTTLE_MIN = 20; // don't ask Last.fm more often than this
export const SUGGESTION_DAYS = 14; // unanswered suggestions fade after this

export async function ensureAlbumId(supabase: Supabase, deezerId: number): Promise<string | null> {
  const { data: existing } = await supabase.from("albums").select("id").eq("deezer_id", deezerId).maybeSingle();
  if (existing?.id) return existing.id as string;
  try {
    const { data, error } = await supabase.rpc("upsert_album", { p: await getAlbum(deezerId) });
    return error ? null : (data as string);
  } catch {
    return null;
  }
}

/** Logs an album listen in the diary on the day it was played (first listen or relisten, worked out as usual). */
export async function logAlbumListen(supabase: Supabase, userId: string, deezerId: number, playedOn: string, rating: number | null) {
  const albumId = await ensureAlbumId(supabase, deezerId);
  if (!albumId) return false;
  const { count } = await supabase.from("entries").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("album_id", albumId);
  const { error } = await supabase.from("entries").insert({
    user_id: userId,
    album_id: albumId,
    listened_on: playedOn,
    rating,
    format: "stream",
    kind: (count ?? 0) > 0 ? "relisten" : "first",
  });
  if (error) return false;
  await supabase.from("to_listen").delete().eq("user_id", userId).eq("album_id", albumId);
  return true;
}

function daysAgo(n: number) {
  const d = new Date(todayIso() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function syncLastfm(supabase: Supabase, userId: string, opts: { force?: boolean } = {}): Promise<{ added: number; error?: string }> {
  if (!lastfmConfigured()) return { added: 0, error: "not-configured" };
  const { data: linkRow, error: linkErr } = await supabase.from("lastfm_links").select("username, autolog, synced_at").eq("user_id", userId).maybeSingle();
  if (linkErr || !linkRow) return { added: 0 };
  const link = linkRow as Link;
  const now = Date.now();
  if (!opts.force && link.synced_at && now - Date.parse(link.synced_at) < THROTTLE_MIN * 60_000) return { added: 0 };

  // A little overlap with the last sync, so a session that was still going isn't cut in half.
  const from = link.synced_at ? Date.parse(link.synced_at) / 1000 - 6 * 3600 : now / 1000 - FIRST_LOOK_DAYS * 86400;
  let listens: AlbumListen[];
  try {
    listens = await spotAlbumListens(await getRecentScrobbles(link.username, from));
  } catch (e) {
    return { added: 0, error: e instanceof Error ? e.message : "Last.fm error" };
  }

  const since = daysAgo(FIRST_LOOK_DAYS + 7);
  const [mutedRes, sugRes, entriesRes] = await Promise.all([
    supabase.from("lastfm_muted").select("kind, key").eq("user_id", userId),
    supabase.from("lastfm_suggestions").select("deezer_id, played_on").eq("user_id", userId).gte("played_on", since),
    supabase.from("entries").select("listened_on, album:albums!inner(deezer_id)").eq("user_id", userId).gte("listened_on", since),
  ]);
  const muted = new Set(((mutedRes.data ?? []) as { kind: string; key: string }[]).map((m) => `${m.kind}:${m.key}`));
  const earlier = (sugRes.data ?? []) as { deezer_id: number; played_on: string }[];
  const logged = new Set(((entriesRes.data ?? []) as unknown as { listened_on: string; album: { deezer_id: number } }[]).map((e) => `${e.album.deezer_id}|${e.listened_on}`));
  const within7 = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) < 7 * 86400_000;

  let added = 0;
  for (const l of listens) {
    if (muted.has(`album:${l.deezerId}`) || muted.has(`artist:${looseName(l.artist)}`)) continue;
    if (logged.has(`${l.deezerId}|${l.playedOn}`)) continue; // already in the diary that day
    if (earlier.some((s) => s.deezer_id === l.deezerId && within7(s.played_on, l.playedOn))) continue; // once a week per record
    earlier.push({ deezer_id: l.deezerId, played_on: l.playedOn });

    let status: "pending" | "logged" = "pending";
    if (link.autolog && (await logAlbumListen(supabase, userId, l.deezerId, l.playedOn, null))) status = "logged";
    const { error } = await supabase.from("lastfm_suggestions").insert({
      user_id: userId,
      deezer_id: l.deezerId,
      deezer_artist_id: l.deezerArtistId,
      title: l.title,
      artist: l.artist,
      cover: l.cover,
      played_on: l.playedOn,
      tracks_played: l.tracksPlayed,
      total_tracks: l.totalTracks,
      status,
    });
    if (!error && status === "pending") added++;
  }
  await supabase.from("lastfm_links").update({ synced_at: new Date(now).toISOString() }).eq("user_id", userId);
  return { added };
}
