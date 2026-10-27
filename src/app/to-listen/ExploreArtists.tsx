/* eslint-disable @next/next/no-img-element */
import { getUser } from "@/lib/supabase/server";
import { baseTitle, getArtistAlbums, type ArtistAlbum } from "@/lib/deezer";
import { logFromDeezer, queueFromDeezer, stopExploring } from "@/app/actions";

type Followed = { deezer_artist_id: number; artist: string; from: { title: string } | null };
type Known = { deezer_id: number | null; title: string; deezer_artist_id: number | null };

const PER_ARTIST = 4;

/** "More from artists you're exploring": their albums you haven't logged or queued yet. */
export async function ExploreArtists() {
  const { supabase, user } = await getUser();
  const { data, error } = await supabase
    .from("explore_artists")
    .select("deezer_artist_id, artist, from:albums(title)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  if (error || !data?.length) return null; // table missing (before migration 0004) or nothing followed

  const followed = data as unknown as Followed[];
  const artistIds = followed.map((f) => f.deezer_artist_id);

  const [heardRes, queuedRes] = await Promise.all([
    supabase.from("entries").select("album:albums(deezer_id, title, deezer_artist_id)").eq("user_id", user!.id),
    supabase.from("to_listen").select("album:albums(deezer_id, title, deezer_artist_id)").eq("user_id", user!.id),
  ]);
  const known = [...(heardRes.data ?? []), ...(queuedRes.data ?? [])]
    .map((r) => (r as unknown as { album: Known | null }).album)
    .filter((a): a is Known => !!a && !!a.deezer_artist_id && artistIds.includes(a.deezer_artist_id));
  const knownIds = new Set(known.map((a) => a.deezer_id));
  const knownTitles = new Set(known.map((a) => `${a.deezer_artist_id}|${baseTitle(a.title)}`));

  const sections = await Promise.all(
    followed.map(async (f) => {
      let albums: ArtistAlbum[] = [];
      let failed = false;
      try {
        albums = await getArtistAlbums(f.deezer_artist_id);
      } catch {
        failed = true;
      }
      const fresh = albums.filter((a) => !knownIds.has(a.deezerId) && !knownTitles.has(`${f.deezer_artist_id}|${baseTitle(a.title)}`));
      return { ...f, albums: fresh.slice(0, PER_ARTIST), more: Math.max(0, fresh.length - PER_ARTIST), failed };
    })
  );

  return (
    <section className="stack gap-20" style={{ marginTop: 20 }}>
      <div>
        <p className="eyebrow">Suggestions</p>
        <h2 className="title-l" style={{ marginTop: 4 }}>More from artists you’re exploring</h2>
      </div>
      {sections.map((s) => (
        <div key={s.deezer_artist_id} className="card stack gap-16">
          <div className="row gap-12" style={{ justifyContent: "space-between" }}>
            <div className="stack" style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{s.artist}</span>
              {s.from ? <span className="mono muted" style={{ fontSize: 11 }}>Because you logged {s.from.title}</span> : null}
            </div>
            <form action={stopExploring}>
              <input type="hidden" name="deezer_artist_id" value={s.deezer_artist_id} />
              <button type="submit" className="btn-text small" style={{ minHeight: 32 }}>Stop exploring</button>
            </form>
          </div>

          {s.albums.length ? (
            <div className="explore-grid">
              {s.albums.map((a) => (
                <div key={a.deezerId} className="stack gap-8" style={{ minWidth: 0 }}>
                  <img src={a.cover} alt="" className="cover cover-full" width={250} height={250} loading="lazy" />
                  <div className="stack" style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{a.title}</span>
                    {a.year ? <span className="muted small">{a.year}</span> : null}
                  </div>
                  <div className="row gap-8">
                    <form action={queueFromDeezer}>
                      <input type="hidden" name="deezer_id" value={a.deezerId} />
                      <input type="hidden" name="source" value={`More from ${s.artist}`} />
                      <button type="submit" className="btn btn-sm">+ To listen</button>
                    </form>
                    <form action={logFromDeezer}>
                      <input type="hidden" name="deezer_id" value={a.deezerId} />
                      <button type="submit" className="btn-text small" style={{ minHeight: 40 }}>Log it</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              {s.failed ? "Couldn’t load their albums right now — try again in a bit." : `You’ve heard or queued every ${s.artist} album we could find.`}
            </p>
          )}
          {s.more ? <p className="mono muted" style={{ fontSize: 11 }}>+{s.more} more — queue or log one and the next shows up</p> : null}
        </div>
      ))}
    </section>
  );
}
