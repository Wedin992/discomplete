/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { findAlbum, getAlbumTracks } from "@/lib/deezer";
import { getTopAlbums } from "@/lib/lastfm";
import { QuickRate } from "@/components/QuickRate";
import { recordPath, stars } from "@/lib/format";

const MIN_PLAYS = 5;

export const metadata: Metadata = { title: "Your most played albums" };

export default async function TopAlbumsPage() {
  const { supabase, user } = await getUser();
  const { data, error } = await supabase.from("lastfm_links").select("username").eq("user_id", user!.id).maybeSingle();
  if (error || !data) redirect("/settings#lastfm");
  return (
    <section className="stack gap-28 narrow">
      <div>
        <Link href="/settings#lastfm" className="btn-text small" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>← Settings</Link>
        <p className="eyebrow" style={{ marginTop: 8 }}>From Last.fm · all time</p>
        <h1 className="title-xl">Your most played albums</h1>
        <p className="muted" style={{ marginTop: 8 }}>Albums you’ve played about start to finish at least once. Rate the ones you know — they’re saved under “Heard before” in your diary, with no date, and teach Discover your taste.</p>
      </div>
      <Suspense fallback={<p className="muted">Fetching your Last.fm history…</p>}>
        <TopList username={(data as { username: string }).username} userId={user!.id} />
      </Suspense>
    </section>
  );
}

async function TopList({ username, userId }: { username: string; userId: string }) {
  const { supabase } = await getUser();
  let top;
  try {
    top = await getTopAlbums(username, 60);
  } catch {
    return <p className="error">Last.fm didn’t answer. Try again in a moment.</p>;
  }
  // Only albums with at least as many plays as tracks (and 5+): a few songs from an album isn't having heard it.
  const found = await Promise.all(
    top.map(async (t) => {
      const hit = await findAlbum(t.artist, t.album).catch(() => null);
      if (!hit) return null;
      const total = hit.tracks || (await getAlbumTracks(hit.deezerId).catch(() => [])).length;
      return total && t.plays >= Math.max(MIN_PLAYS, total) ? { t, hit } : null;
    })
  );
  const rows = found.filter((r): r is NonNullable<typeof r> => !!r).slice(0, 30);
  if (!rows.length) return <p className="muted">No whole albums in your Last.fm history yet. Play a few start to finish on Spotify and come back.</p>;
  // What's already in your diary (any kind of entry) is shown as done, with your rating — not as "Tap to rate".
  const { data: mineRows } = await supabase
    .from("entries")
    .select("rating, album:albums!inner(id, deezer_id, artist_slug, title_slug)")
    .eq("user_id", userId)
    .in("album.deezer_id", rows.map((r) => r.hit.deezerId));
  type Mine = { rating: number | null; album: { id: string; deezer_id: number; artist_slug: string | null; title_slug: string | null } };
  const mine = new Map<number, Mine>();
  for (const m of (mineRows ?? []) as unknown as Mine[]) {
    const prev = mine.get(m.album.deezer_id);
    if (!prev || (m.rating ?? 0) > (prev.rating ?? 0)) mine.set(m.album.deezer_id, m);
  }
  const todo = rows.filter((r) => !mine.has(r.hit.deezerId));
  const done = rows.filter((r) => mine.has(r.hit.deezerId));
  return (
    <div className="stack gap-28">
      {todo.length ? (
        <div className="stack gap-12">
          {todo.map(({ t, hit }) => (
            <div key={hit.deezerId} className="quick-result">
              <img src={hit.cover} alt="" width={64} height={64} className="cover cover-64" />
              <span className="result-text">
                <span style={{ fontSize: 17, fontWeight: 700 }}>{hit.title}</span>
                <span className="muted" style={{ fontSize: 14 }}>{hit.artist} · {t.plays.toLocaleString("en-US")} track plays</span>
                <QuickRate deezerId={hit.deezerId} title={hit.title} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">You’ve rated all of them. Nice.</p>
      )}
      {done.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Already in your diary · {done.length}</h2>
          {done.map(({ t, hit }) => {
            const m = mine.get(hit.deezerId)!;
            return (
              <Link key={hit.deezerId} href={recordPath(m.album)} className="quick-result" style={{ textDecoration: "none", color: "inherit" }}>
                <img src={hit.cover} alt="" width={48} height={48} className="cover" style={{ width: 48, height: 48 }} />
                <span className="result-text">
                  <span style={{ fontWeight: 700 }}>{hit.title}</span>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {hit.artist} · {t.plays.toLocaleString("en-US")} track plays · {m.rating ? <span className="stars">{stars(m.rating)}</span> : "✓"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
