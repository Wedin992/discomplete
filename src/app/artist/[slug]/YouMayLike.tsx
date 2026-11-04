/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getArtistAlbums, getRelatedArtists } from "@/lib/deezer";
import { diaryIndex, doneIn } from "@/lib/challenges";
import { queueFromDeezer } from "@/app/actions";
import { artistPath } from "@/lib/format";
import { PendingButton } from "@/components/PendingButton";
import { QuickRate } from "@/components/QuickRate";

/** "If you like X, you may like…": the best-known album from three similar artists that you haven't heard. */
export async function YouMayLike({ artistId, artistName }: { artistId: number; artistName: string }) {
  const { supabase, user } = await getUser();
  const [related, index, queuedRes] = await Promise.all([
    getRelatedArtists(artistId).catch(() => []),
    diaryIndex(supabase, user!.id),
    supabase.from("to_listen").select("album:albums(deezer_id)").eq("user_id", user!.id),
  ]);
  const queued = new Set(((queuedRes.data ?? []) as unknown as { album: { deezer_id: number | null } | null }[]).map((r) => r.album?.deezer_id));

  const picks: { deezerId: number; title: string; year: number | null; cover: string; artist: string; artistId: number }[] = [];
  for (const r of related.slice(0, 10)) {
    if (picks.length >= 3) break;
    const albums = await getArtistAlbums(r.id).catch(() => []);
    // Their best-known album you haven't heard (albums come most popular first).
    const a = albums.find((x) => !doneIn(index, { deezerId: x.deezerId, artist: r.name, title: x.title }));
    if (a) picks.push({ ...a, artist: r.name, artistId: r.id });
  }
  if (!picks.length) return null;

  return (
    <section className="stack gap-16" aria-labelledby="may-like">
      <div>
        <h2 id="may-like" className="title-l">If you like {artistName}, you may like…</h2>
        <p className="muted small" style={{ marginTop: 4 }}>The best-known album from three similar artists. Heard one already? Give it stars — it’s saved as Heard before.</p>
      </div>
      <div className="may-like">
        {picks.map((p) => (
          <div key={p.deezerId} className="may-like-item">
            <Link href={`/open/${p.deezerId}`} prefetch={false} className="may-like-cover" aria-hidden="true" tabIndex={-1}>
              <img src={p.cover} alt="" className="cover cover-full" width={250} height={250} />
            </Link>
            <div className="stack gap-4" style={{ minWidth: 0 }}>
              <Link href={`/open/${p.deezerId}`} prefetch={false} className="link-button" style={{ lineHeight: 1.25 }}>{p.title}</Link>
              <span className="muted small">
                <Link href={artistPath(p.artist, p.artistId)!} className="artist-link">{p.artist}</Link>
                {p.year ? ` · ${p.year}` : ""}
              </span>
              <QuickRate deezerId={p.deezerId} title={p.title} compact idleText="Heard it? Rate it" addedText="Heard before" />
              {queued.has(p.deezerId) ? (
                <Link href="/to-listen" className="btn btn-sm pill" aria-pressed="true" style={{ alignSelf: "flex-start" }}>✓ In To listen</Link>
              ) : (
                <form action={queueFromDeezer}>
                  <input type="hidden" name="deezer_id" value={p.deezerId} />
                  <input type="hidden" name="source" value={`Similar to ${artistName}`.slice(0, 200)} />
                  <PendingButton className="btn btn-sm" pending="Adding…">+ To listen</PendingButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
