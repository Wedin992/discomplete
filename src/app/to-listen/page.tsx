import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExploreArtists } from "./ExploreArtists";
import { ChallengePicks } from "@/components/ChallengeCards";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { toggleToListen } from "@/app/actions";
import { logPath, recordPath, type Album } from "@/lib/format";
import { listeningProgress, PROGRESS_DAYS, type Progress } from "@/lib/progress";

export const metadata: Metadata = { title: "To listen" };

export default async function ToListenPage() {
  const { supabase, user } = await getUser();
  const { data } = await supabase
    .from("to_listen")
    .select("source, created_at, album:albums(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const all = ((data ?? []) as unknown as { source: string | null; album: Album }[]).filter((r) => r.album);
  // With Spotify via Last.fm: albums you've started come first, with how far you've got.
  const progress = await listeningProgress(supabase, user!.id, all.map((r) => r.album));
  const started = all.filter((r) => r.album.deezer_id && progress.has(r.album.deezer_id));
  const items = all.filter((r) => !started.includes(r));

  const row = ({ album, source }: { album: Album; source: string | null }, p?: Progress) => (
    <div key={album.id} className="card row gap-16" style={{ padding: 14 }}>
      <Cover album={album} size="64" />
      <div className="stack gap-4" style={{ flex: "1 1 220px", minWidth: 0 }}>
        <Link href={recordPath(album)} className="link-button" style={{ fontSize: 18 }}>{album.title}</Link>
        <span className="muted">{album.artist}{album.release_year ? ` · ${album.release_year}` : ""}</span>
        {p ? (
          <div className="stack gap-4" style={{ maxWidth: 320, marginTop: 2 }}>
            <span className="mono small" style={{ color: "var(--accent)" }}>{p.played} of {p.total} tracks played</span>
            <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${Math.round((Math.min(p.played, p.total) / Math.max(1, p.total)) * 100)}%` }} /></div>
          </div>
        ) : source ? (
          <span className="mono muted" style={{ fontSize: 11 }}>{source}</span>
        ) : null}
      </div>
      <div className="row gap-8">
        <Link href={logPath(album)} className="btn btn-primary">Log it</Link>
        <form action={toggleToListen}>
          <input type="hidden" name="album_id" value={album.id} />
          <button type="submit" className="btn">Remove</button>
        </form>
      </div>
    </div>
  );

  return (
    <section className="stack gap-20 narrow" style={{ maxWidth: 780 }}>
      <div>
        <p className="eyebrow">Your queue</p>
        <h1 className="title-xl">To listen</h1>
      </div>
      <Suspense fallback={null}>
        <ChallengePicks heading="Next in your challenges" />
      </Suspense>
      {started.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Started · from Spotify, last {PROGRESS_DAYS} days</h2>
          {started.map((r) => row(r, progress.get(r.album.deezer_id!)))}
        </div>
      ) : null}
      {items.length ? (
        <div className="stack gap-12">
          {started.length ? <h2 className="eyebrow" style={{ marginTop: 8 }}>Queued</h2> : null}
          {items.map((r) => row(r))}
        </div>
      ) : started.length ? null : (
        <div className="card-dashed">
          <p style={{ fontWeight: 700 }}>Nothing queued</p>
          <p className="muted">Tap “+ To listen” on any record page to save it here.</p>
        </div>
      )}
      <Suspense fallback={<p className="muted small">Finding more from artists you’re exploring…</p>}>
        <ExploreArtists />
      </Suspense>
    </section>
  );
}
