// Server-only: turns new scrobbles into "Looks like you listened to …" suggestions.
import type { getUser } from "@/lib/supabase/server";
import { getAlbum } from "@/lib/deezer";
import { albumKey, COMPLETE_SHARE, DONE_SHARE, SCATTERED_DAYS, SETTLE_MIN, spotScatteredListens, getRecentScrobbles, lastfmConfigured, looseName, spotAlbumListens, trackKey, type AlbumListen, type Scrobble } from "@/lib/lastfm";
import { todayIso } from "@/lib/format";
import { listeningProgress } from "@/lib/progress";

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
    supabase.from("entries").select("listened_on, created_at, kind, album:albums!inner(deezer_id)").eq("user_id", userId).or(`listened_on.gte.${since},created_at.gte.${since}`),
  ]);
  type Row = { id: string; deezer_id: number; played_on: string; status: string; lfm_key: string | null; tracks: string[] | null; total_tracks: number; last_played_at: string | null };
  const muted = new Set(((mutedRes.data ?? []) as { kind: string; key: string }[]).map((m) => `${m.kind}:${m.key}`));
  const earlier = (sugRes.data ?? []) as Row[];
  // Real listens only: having heard a record "before" doesn't stop today's listen from counting.
  const dated = ((entriesRes.data ?? []) as unknown as { listened_on: string; kind: string; album: { deezer_id: number } }[]).filter((e) => e.kind !== "before");
  const logged = new Set(dated.map((e) => `${e.album.deezer_id}|${e.listened_on}`));
  const within7 = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) < 7 * 86400_000;

  // 1. Albums already suggested or on the turntable: add whatever you've played of them since.
  // Already in the diary since (logged, rated, "heard before"…): done following it.
  const enteredAfter = (r: Row) =>
    ((entriesRes.data ?? []) as unknown as { created_at: string; album: { deezer_id: number } }[]).some((e) => e.album.deezer_id === r.deezer_id && e.created_at.slice(0, 10) >= r.played_on);
  for (const r of earlier.filter((r) => ["pending", "listening", "finished"].includes(r.status) && r.id && enteredAfter(r))) {
    await supabase.from("lastfm_suggestions").update({ status: "logged" }).eq("id", r.id).eq("user_id", userId);
    r.status = "logged";
  }
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
    // Started albums go straight on the turntable (no "I'm on it" needed).
    if (status === "pending" && share < COMPLETE_SHARE) status = "listening";
    if (status === "listening") {
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
    // Started: straight on the turntable. (Nearly) whole: ask — or log it right away with autolog on.
    let status: "pending" | "logged" | "listening" = complete ? "pending" : "listening";
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
    const full: Record<string, unknown> = { ...base, lfm_key: l.key, tracks: l.tracks, last_played_at: new Date(l.lastUts * 1000).toISOString() };
    // Logged automatically: the diary asks how it was (migration 0014).
    let { error } = await supabase.from("lastfm_suggestions").insert(status === "logged" ? { ...full, review: "ask" } : full);
    if (error && status === "logged") ({ error } = await supabase.from("lastfm_suggestions").insert(full)); // before migration 0014
    if (error) ({ error } = await supabase.from("lastfm_suggestions").insert(base)); // before migration 0011
    if (!error && status !== "logged") added++;
  }
  // 3. Albums heard bit by bit over the last two weeks (half the album, in any order, over several sittings).
  try {
    const long = await getRecentScrobbles(link.username, Math.floor(now / 3_600_000) * 3600 - SCATTERED_DAYS * 86400, 3, 600);
    const followedKeys = new Set(earlier.map((s) => s.lfm_key).filter((k): k is string => !!k));
    const scattered = await spotScatteredListens(long, (k) => followedKeys.has(k));
    const loggedAlbums = new Set(dated.map((e) => e.album.deezer_id));
    for (const l of scattered) {
      if (muted.has(`album:${l.deezerId}`) || muted.has(`artist:${looseName(l.artist)}`)) continue;
      if (loggedAlbums.has(l.deezerId)) continue; // in the diary lately
      if (earlier.some((s) => s.deezer_id === l.deezerId)) continue; // already suggested lately, in some form
      earlier.push({ id: "", deezer_id: l.deezerId, played_on: l.playedOn, status: "pending", lfm_key: l.key, tracks: l.tracks, total_tracks: l.totalTracks, last_played_at: new Date(l.lastUts * 1000).toISOString() });
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
        status: l.tracksPlayed / l.totalTracks >= COMPLETE_SHARE ? "pending" : "listening",
        lfm_key: l.key,
        tracks: l.tracks,
        last_played_at: new Date(l.lastUts * 1000).toISOString(),
      });
      if (!error) added++;
    }
  } catch {
    // Last.fm busy: try again next time
  }

  added += await finishedFromToListen(supabase, userId, muted);
  await supabase.from("lastfm_links").update({ synced_at: new Date(now).toISOString() }).eq("user_id", userId);
  return { added, changed };
}

/**
 * Albums in To listen that you've since played (nearly) all of — over several sittings, or with tracks you ticked
 * yourself — come back to the diary as "You finished … — how was it?".
 */
async function finishedFromToListen(supabase: Supabase, userId: string, muted: Set<string>): Promise<number> {
  type A = { id: string; deezer_id: number | null; deezer_artist_id: number | null; artist: string; title: string; cover_medium: string | null };
  const { data } = await supabase.from("to_listen").select("album:albums!inner(id, deezer_id, deezer_artist_id, artist, title, cover_medium)").eq("user_id", userId);
  const albums = ((data ?? []) as unknown as { album: A }[]).map((r) => r.album).filter((a) => a?.deezer_id);
  if (!albums.length) return 0;
  const progress = await listeningProgress(supabase, userId, albums).catch(() => new Map());
  const done = albums.filter((a) => {
    const p = progress.get(a.deezer_id!);
    return p && p.total && p.played / p.total >= COMPLETE_SHARE && !muted.has(`album:${a.deezer_id}`) && !muted.has(`artist:${looseName(a.artist)}`);
  });
  if (!done.length) return 0;
  // Already asked (or answered) about it as a whole listen? Then leave it. A put-aside half listen doesn't count.
  const { data: prior } = await supabase
    .from("lastfm_suggestions")
    .select("deezer_id, status, tracks_played, total_tracks")
    .eq("user_id", userId)
    .in("deezer_id", done.map((a) => a.deezer_id!))
    .gte("played_on", daysAgo(30));
  const asked = new Set(
    ((prior ?? []) as { deezer_id: number; status: string; tracks_played: number; total_tracks: number }[])
      .filter((r) => r.status !== "dismissed" || r.tracks_played / Math.max(1, r.total_tracks) >= COMPLETE_SHARE)
      .map((r) => r.deezer_id)
  );
  let added = 0;
  for (const a of done) {
    if (asked.has(a.deezer_id!)) continue;
    const p = progress.get(a.deezer_id!)!;
    const { error } = await supabase.from("lastfm_suggestions").insert({
      user_id: userId,
      deezer_id: a.deezer_id,
      deezer_artist_id: a.deezer_artist_id,
      title: a.title,
      artist: a.artist,
      cover: a.cover_medium,
      played_on: todayIso(),
      tracks_played: p.played,
      total_tracks: p.total,
      status: "finished",
    });
    if (!error) added++;
  }
  return added;
}
