// Server-only: turns new scrobbles into "Looks like you listened to …" suggestions.
import type { getUser } from "@/lib/supabase/server";
import { getAlbum } from "@/lib/deezer";
import { albumKey, COMPLETE_SHARE, DONE_SHARE, SETTLE_MIN, getRecentScrobbles, lastfmConfigured, looseName, spotAlbumListens, trackKey, type AlbumListen, type Scrobble } from "@/lib/lastfm";
import { todayIso } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];
export type Link = { username: string; autolog: boolean; synced_at: string | null };

const FIRST_LOOK_DAYS = 14; // on connecting: look back this far
const THROTTLE_MIN = 10; // don't ask Last.fm more often than this
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

/** "I'll get back to it" (or left on the turntable for days): into To listen. */
export async function parkInToListen(supabase: Supabase, userId: string, deezerId: number) {
  const albumId = await ensureAlbumId(supabase, deezerId);
  if (!albumId) return;
  await supabase.from("to_listen").upsert({ user_id: userId, album_id: albumId, source: "Started on Spotify" }, { onConflict: "user_id,album_id", ignoreDuplicates: true });
}

function daysAgo(n: number) {
  const d = new Date(todayIso() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function syncLastfm(supabase: Supabase, userId: string, opts: { force?: boolean } = {}): Promise<{ added: number; changed?: number; error?: string }> {
  if (!lastfmConfigured()) return { added: 0, error: "not-configured" };
  const { data: linkRow, error: linkErr } = await supabase.from("lastfm_links").select("username, autolog, synced_at").eq("user_id", userId).maybeSingle();
  if (linkErr || !linkRow) return { added: 0 };
  const link = linkRow as Link;
  const now = Date.now();
  if (!opts.force && link.synced_at && now - Date.parse(link.synced_at) < THROTTLE_MIN * 60_000) return { added: 0 };

  // A little overlap with the last sync, so a session that was still going isn't cut in half.
  const from = link.synced_at ? Date.parse(link.synced_at) / 1000 - 6 * 3600 : now / 1000 - FIRST_LOOK_DAYS * 86400;
  let scrobbles: Scrobble[];
  try {
    scrobbles = await getRecentScrobbles(link.username, from);
  } catch (e) {
    return { added: 0, error: e instanceof Error ? e.message : "Last.fm error" };
  }

  const since = daysAgo(FIRST_LOOK_DAYS + 7);
  const [mutedRes, sugRes, entriesRes] = await Promise.all([
    supabase.from("lastfm_muted").select("kind, key").eq("user_id", userId),
    supabase.from("lastfm_suggestions").select("id, deezer_id, played_on, status, lfm_key, tracks, total_tracks, last_played_at").eq("user_id", userId).gte("played_on", since),
    supabase.from("entries").select("listened_on, album:albums!inner(deezer_id)").eq("user_id", userId).gte("listened_on", since),
  ]);
  type Row = { id: string; deezer_id: number; played_on: string; status: string; lfm_key: string | null; tracks: string[] | null; total_tracks: number; last_played_at: string | null };
  const muted = new Set(((mutedRes.data ?? []) as { kind: string; key: string }[]).map((m) => `${m.kind}:${m.key}`));
  const earlier = (sugRes.data ?? []) as Row[];
  const logged = new Set(((entriesRes.data ?? []) as unknown as { listened_on: string; album: { deezer_id: number } }[]).map((e) => `${e.album.deezer_id}|${e.listened_on}`));
  const within7 = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) < 7 * 86400_000;

  // 1. Albums already suggested or on the turntable: add whatever you've played of them since.
  const active = earlier.filter((r) => (r.status === "pending" || r.status === "listening") && r.lfm_key);
  const byKey = new Map(active.map((r) => [r.lfm_key!, r]));
  const grown = new Map<string, { tracks: Set<string>; last: number }>();
  for (const sc of scrobbles) {
    const row = byKey.get(albumKey(sc.artist, sc.album));
    if (!row) continue;
    const g = grown.get(row.id) ?? { tracks: new Set(row.tracks ?? []), last: row.last_played_at ? Date.parse(row.last_played_at) / 1000 : 0 };
    g.tracks.add(trackKey(sc.track));
    g.last = Math.max(g.last, sc.uts);
    grown.set(row.id, g);
  }
  let changed = 0;
  for (const row of active) {
    const g = grown.get(row.id);
    const tracks = g ? [...g.tracks] : row.tracks ?? [];
    const last = g ? g.last * 1000 : row.last_played_at ? Date.parse(row.last_played_at) : Date.parse(row.played_on);
    const share = Math.min(tracks.length, row.total_tracks) / Math.max(1, row.total_tracks);
    const quietH = (now - last) / 3_600_000;
    let status = row.status;
    if (row.status === "listening") {
      if (share >= DONE_SHARE || (quietH >= SETTLE_MIN / 60 && share >= COMPLETE_SHARE)) status = "finished"; // done (or most of it, then a pause): ask how it was
      else if (quietH >= 72) status = "parked"; // left alone for days: it goes to To listen
    }
    if (!g && status === row.status) continue;
    if (status === "parked") {
      await parkInToListen(supabase, userId, row.deezer_id);
      status = "dismissed";
    }
    await supabase
      .from("lastfm_suggestions")
      .update({ tracks, tracks_played: Math.min(tracks.length, row.total_tracks), last_played_at: new Date(last).toISOString(), status })
      .eq("id", row.id)
      .eq("user_id", userId);
    changed++;
  }

  // 2. New album listens (sessions that have settled).
  let listens: AlbumListen[] = [];
  try {
    listens = await spotAlbumListens(scrobbles, new Set(byKey.keys()));
  } catch {
    listens = [];
  }
  let added = 0;
  for (const l of listens) {
    if (muted.has(`album:${l.deezerId}`) || muted.has(`artist:${looseName(l.artist)}`)) continue;
    if (logged.has(`${l.deezerId}|${l.playedOn}`)) continue; // already in the diary that day
    // Once a week per record — except a new, (nearly) whole listen after you'd put it aside or logged it:
    // e.g. "I'll get back to it" on Monday, then the whole album on Wednesday.
    const complete0 = l.tracksPlayed / l.totalTracks >= COMPLETE_SHARE;
    const lastOf = (s: (typeof earlier)[number]) => (s.last_played_at ? Date.parse(s.last_played_at) : Date.parse(s.played_on + "T23:59:59Z"));
    const blocked = earlier.some(
      (s) =>
        s.deezer_id === l.deezerId &&
        within7(s.played_on, l.playedOn) &&
        !(complete0 && (s.status === "dismissed" || s.status === "logged") && l.startUts * 1000 > lastOf(s))
    );
    if (blocked) continue;
    earlier.push({ id: "", deezer_id: l.deezerId, played_on: l.playedOn, status: "pending", lfm_key: l.key, tracks: l.tracks, total_tracks: l.totalTracks, last_played_at: new Date(l.lastUts * 1000).toISOString() });

    const complete = l.tracksPlayed / l.totalTracks >= COMPLETE_SHARE;
    let status: "pending" | "logged" = "pending";
    if (complete && link.autolog && (await logAlbumListen(supabase, userId, l.deezerId, l.playedOn, null))) status = "logged";
    const base = {
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
    };
    let { error } = await supabase.from("lastfm_suggestions").insert({ ...base, lfm_key: l.key, tracks: l.tracks, last_played_at: new Date(l.lastUts * 1000).toISOString() });
    if (error) ({ error } = await supabase.from("lastfm_suggestions").insert(base)); // before migration 0011
    if (!error && status === "pending") added++;
  }
  await supabase.from("lastfm_links").update({ synced_at: new Date(now).toISOString() }).eq("user_id", userId);
  return { added, changed };
}
