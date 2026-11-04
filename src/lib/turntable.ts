import type { getUser } from "@/lib/supabase/server";
import { COMPLETE_SHARE } from "@/lib/lastfm";
import type { Suggestion } from "@/components/LastfmSuggestions";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];

/** Albums you've started on Spotify (via Last.fm) in the last 14 days and haven't logged since. */
export async function loadTurntable(supabase: Supabase, userId: string): Promise<{ items: Suggestion[]; linked: boolean }> {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const [linkRes, sugRes] = await Promise.all([
    supabase.from("lastfm_links").select("username").eq("user_id", userId).maybeSingle(),
    supabase
      .from("lastfm_suggestions")
      .select("id, deezer_id, title, artist, cover, played_on, tracks_played, total_tracks, status")
      .eq("user_id", userId)
      .in("status", ["pending", "listening"])
      .gte("played_on", since)
      .order("played_on", { ascending: false })
      .limit(10),
  ]);
  const linked = !linkRes.error && !!linkRes.data;
  const started = ((sugRes.error ? [] : sugRes.data ?? []) as Suggestion[]).filter(
    (s) => s.status === "listening" || s.tracks_played / Math.max(1, s.total_tracks) < COMPLETE_SHARE
  );
  if (!started.length) return { items: [], linked };
  const { data } = await supabase
    .from("entries")
    .select("created_at, album:albums!inner(deezer_id)")
    .eq("user_id", userId)
    .in("album.deezer_id", started.map((s) => s.deezer_id));
  const logged = (data ?? []) as unknown as { created_at: string; album: { deezer_id: number } }[];
  const items = started.filter((s) => !logged.some((e) => e.album.deezer_id === s.deezer_id && e.created_at.slice(0, 10) >= s.played_on)).slice(0, 4);
  return { items, linked };
}
