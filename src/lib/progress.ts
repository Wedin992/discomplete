// Server-only: how far you've got into albums, from your Spotify listening via Last.fm.
import type { getUser } from "@/lib/supabase/server";
import { getAlbumTracks } from "@/lib/deezer";
import { getRecentScrobbles, lastfmConfigured, looseName, trackKey } from "@/lib/lastfm";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];
export type Progress = { played: number; total: number };
export const PROGRESS_DAYS = 30;

/**
 * Tracks played (last 30 days) per album, for the albums given. Only albums with at least one
 * track played are returned; nothing at all without a Last.fm connection.
 */
export async function listeningProgress(
  supabase: Supabase,
  userId: string,
  albums: { deezer_id: number | null; artist: string }[]
): Promise<Map<number, Progress>> {
  const out = new Map<number, Progress>();
  if (!lastfmConfigured() || !albums.length) return out;
  const { data, error } = await supabase.from("lastfm_links").select("username").eq("user_id", userId).maybeSingle();
  if (error || !data) return out;

  // Cached for a few minutes: the window starts on the hour.
  const from = Math.floor(Date.now() / 3_600_000) * 3600 - PROGRESS_DAYS * 86400;
  const scrobbles = await getRecentScrobbles((data as { username: string }).username, from, 3, 300).catch(() => []);
  const ids0 = albums.map((a) => a.deezer_id).filter((x): x is number => !!x);
  const { data: marks } = await supabase
    .from("track_marks")
    .select("deezer_id, track")
    .eq("user_id", userId)
    .in("deezer_id", ids0)
    .gte("created_at", new Date(from * 1000).toISOString());
  const marked = new Map<number, string[]>();
  for (const m of (marks ?? []) as { deezer_id: number; track: string }[]) marked.set(m.deezer_id, [...(marked.get(m.deezer_id) ?? []), m.track]);
  const byArtist = new Map<string, Set<string>>();
  for (const s of scrobbles) {
    const a = looseName(s.artist);
    if (!byArtist.has(a)) byArtist.set(a, new Set());
    byArtist.get(a)!.add(trackKey(s.track));
  }
  const ids = albums.map((a) => a.deezer_id).filter((x): x is number => !!x);
  const { data: sug } = await supabase.from("lastfm_suggestions").select("deezer_id, tracks").eq("user_id", userId).in("deezer_id", ids);
  const fromSuggestions = new Map<number, string[]>();
  for (const r of (sug ?? []) as { deezer_id: number; tracks: string[] | null }[]) fromSuggestions.set(r.deezer_id, [...(fromSuggestions.get(r.deezer_id) ?? []), ...(r.tracks ?? [])]);

  // Only look up tracklists for albums whose artist you've actually played.
  await Promise.all(
    albums.map(async (a) => {
      if (!a.deezer_id) return;
      const heard = new Set([...(byArtist.get(looseName(a.artist)) ?? []), ...(fromSuggestions.get(a.deezer_id) ?? []), ...(marked.get(a.deezer_id) ?? [])]);
      if (!heard.size) return;
      const tracks = await getAlbumTracks(a.deezer_id).catch(() => []);
      const played = tracks.filter((t) => heard.has(trackKey(t.title))).length;
      if (played) out.set(a.deezer_id, { played, total: tracks.length });
    })
  );
  return out;
}
