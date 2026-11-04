import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getArtistAlbums, getChartAlbums } from "@/lib/deezer";
import { RateFive } from "./RateFive";

export const metadata: Metadata = { title: "Albums you like" };

/** Right after the quiz: give stars to albums you already know, so Discover has something to go on. */
export default async function RateFivePage() {
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("favorite_artists").select("deezer_artist_id, artist").eq("user_id", user!.id).limit(12);
  const artists = (data ?? []) as { deezer_artist_id: number; artist: string }[];
  type A = { deezerId: number; title: string; artist: string; cover: string };
  let albums: A[] = [];
  if (artists.length) {
    const per = artists.length >= 6 ? 2 : artists.length >= 3 ? 3 : 4;
    const lists = await Promise.all(artists.map((a) => getArtistAlbums(a.deezer_artist_id).then((xs) => xs.slice(0, per).map((x) => ({ deezerId: x.deezerId, title: x.title, artist: a.artist, cover: x.cover }))).catch(() => [] as A[])));
    // Interleave so the first row has a bit of everyone.
    for (let i = 0; i < 4; i++) for (const l of lists) if (l[i]) albums.push(l[i]);
  }
  if (albums.length < 12) {
    const chart = await getChartAlbums(24).catch(() => []);
    albums = [...albums, ...chart.filter((c) => !albums.some((a) => a.deezerId === c.deezerId))].slice(0, 18);
  }
  albums = albums.slice(0, 18);

  return (
    <section className="stack gap-24 narrow" style={{ maxWidth: 760 }}>
      <div className="stack gap-8">
        <p className="eyebrow">One minute</p>
        <h1 className="title-xl">Rate five albums you like</h1>
        <p className="muted" style={{ fontSize: 17, maxWidth: "60ch" }}>
          Tap the stars on records you’ve heard. Five you like — 3★ or more — and Discover opens with three picks for you. They go under “Heard before”, no dates needed.
        </p>
      </div>
      {albums.length ? (
        <RateFive albums={albums} />
      ) : (
        <div className="stack gap-12">
          <p className="muted">We couldn’t load albums to show right now. Search for a few you know instead — tap + and choose “Heard it before”.</p>
          <a href="/" className="btn" style={{ alignSelf: "flex-start" }}>Go to my diary</a>
        </div>
      )}
    </section>
  );
}
