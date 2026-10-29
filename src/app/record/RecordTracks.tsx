import { getUser } from "@/lib/supabase/server";
import { getAlbumTracks } from "@/lib/deezer";
import { getRecentScrobbles, lastfmConfigured, looseName, trackKey } from "@/lib/lastfm";
import type { Album } from "@/lib/format";
import { TrackCheck } from "./TrackCheck";

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const DAYS = 30;

/**
 * The tracklist. With Last.fm connected, tracks you've played in the last 30 days get a check —
 * handy for an album you're partway through. Any track can also be ticked by hand (Last.fm missed it,
 * or you heard it somewhere else); those marks count for 30 days too.
 */
export async function RecordTracks({ album }: { album: Album }) {
  if (!album.deezer_id) return null;
  const { supabase, user } = await getUser();
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const [tracks, linkRes, sugRes, marksRes] = await Promise.all([
    getAlbumTracks(album.deezer_id).catch(() => []),
    supabase.from("lastfm_links").select("username").eq("user_id", user!.id).maybeSingle(),
    supabase.from("lastfm_suggestions").select("tracks").eq("user_id", user!.id).eq("deezer_id", album.deezer_id),
    supabase.from("track_marks").select("track").eq("user_id", user!.id).eq("deezer_id", album.deezer_id).gte("created_at", since),
  ]);
  const canMark = !marksRes.error; // before migration 0012 there's nothing to tick
  if (!tracks.length) return null;

  const username = !linkRes.error && linkRes.data ? (linkRes.data as { username: string }).username : null;
  const heard = new Set<string>();
  if (username && lastfmConfigured()) {
    for (const r of (sugRes.error ? [] : sugRes.data ?? []) as { tracks: string[] | null }[]) for (const t of r.tracks ?? []) heard.add(t);
    // Same artist, a track on this record: played. (From the hour, so the lookup is cached for a while.)
    const from = Math.floor(Date.now() / 3_600_000) * 3600 - DAYS * 86400;
    const artist = looseName(album.artist);
    const scrobbles = await getRecentScrobbles(username, from, 3, 300).catch(() => []);
    for (const s of scrobbles) if (looseName(s.artist) === artist) heard.add(trackKey(s.track));
  }
  // Your own marks — kept apart from scrobbles so only those can be unticked.
  const marked = new Set(((marksRes.error ? [] : marksRes.data ?? []) as { track: string }[]).map((m) => m.track));
  const isPlayed = (title: string) => heard.has(trackKey(title)) || marked.has(trackKey(title));
  const played = tracks.filter((t) => isPlayed(t.title));
  const showChecks = played.length > 0;

  const list = (
    <ol className="tracklist">
      {tracks.map((t) => {
        const key = trackKey(t.title);
        const on = isPlayed(t.title);
        return (
          <li key={t.id} className={on ? "played" : undefined}>
            <span className="mono tl-pos">{t.position}</span>
            <span className="tl-title">{t.title}</span>
            {canMark ? (
              <TrackCheck deezerId={album.deezer_id!} track={key} title={t.title} scrobbled={heard.has(key)} marked={marked.has(key)} />
            ) : showChecks ? (
              <span className="tl-check" aria-label={on ? "Played" : "Not played yet"}>{on ? "✓" : ""}</span>
            ) : null}
            <span className="mono muted tl-dur">{t.duration ? mmss(t.duration) : ""}</span>
          </li>
        );
      })}
    </ol>
  );

  return showChecks ? (
    <section className="stack gap-12" aria-labelledby="tracklist">
      <div className="row gap-12" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 id="tracklist" className="title-l">Tracklist</h2>
        <span className="mono small" style={{ color: "var(--accent)" }}>✓ {played.length} of {tracks.length} played · last {DAYS} days</span>
      </div>
      <div className="bar" aria-hidden="true" style={{ maxWidth: 420 }}><span style={{ width: `${Math.round((played.length / tracks.length) * 100)}%` }} /></div>
      {list}
      <p className="muted small">{username ? "From your Spotify listening via Last.fm. " : ""}{canMark ? "Missing one? Tap the circle to tick it yourself." : ""}</p>
    </section>
  ) : (
    <details className="tracklist-details">
      <summary className="eyebrow">Tracklist · {tracks.length} tracks</summary>
      {list}
      {canMark ? <p className="muted small" style={{ marginTop: 8 }}>Tap the circle on a track you’ve played to tick it.</p> : null}
    </details>
  );
}
