/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { buildSuggestions, UNLOCK_AT, type KnownRecord, type LikedRecord } from "@/lib/discover";
import { logFromDeezer, queueFromDeezer } from "@/app/actions";

export const metadata: Metadata = { title: "Discover" };

type Row = { rating: number | null; album: { deezer_id: number | null; title: string; artist: string; deezer_artist_id: number | null } | null };

export default async function DiscoverPage() {
  const { supabase, user } = await getUser();
  const { data } = await supabase
    .from("entries")
    .select("rating, album:albums(deezer_id, title, artist, deezer_artist_id)")
    .eq("user_id", user!.id);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.album);
  const { data: favData } = await supabase.from("favorite_artists").select("deezer_artist_id, artist").eq("user_id", user!.id);
  const favourites = (favData ?? []) as { deezer_artist_id: number; artist: string }[];

  const likedTitles = new Set(rows.filter((r) => (r.rating ?? 0) >= 3).map((r) => r.album!.deezer_id ?? r.album!.title));
  const likedCount = likedTitles.size;

  return (
    <section className="stack gap-20">
      <div>
        <p className="eyebrow">Inspiration</p>
        <h1 className="title-xl">Discover</h1>
        <p className="muted" style={{ marginTop: 8 }}>Records picked from artists similar to the ones you love and rated highest.</p>
      </div>

      {likedCount < UNLOCK_AT && !favourites.length ? (
        <div className="card stack gap-12">
          <p style={{ fontWeight: 700, fontSize: 18 }}>
            {likedCount} of {UNLOCK_AT} — rate {UNLOCK_AT - likedCount} more {UNLOCK_AT - likedCount === 1 ? "record" : "records"} to unlock Discover
          </p>
          <div className="bar" style={{ height: 10 }} aria-hidden="true">
            <span style={{ width: `${(likedCount / UNLOCK_AT) * 100}%` }} />
          </div>
          <p className="muted">Give 3 stars or more to five different records — or tell us a few artists you love to get picks right away.</p>
          <div className="row gap-12">
            <Link href="/log" className="btn btn-primary">Log a listen</Link>
            <Link href="/welcome" className="btn">Pick artists you love</Link>
          </div>
        </div>
      ) : (
        <Suspense fallback={<DiscoverSkeleton />}>
          <Suggestions rows={rows} favourites={favourites} userId={user!.id} />
        </Suspense>
      )}
    </section>
  );
}

async function Suggestions({ rows, favourites, userId }: { rows: Row[]; favourites: { deezer_artist_id: number; artist: string }[]; userId: string }) {
  const { supabase } = await getUser();
  const [queuedRes, exploreRes] = await Promise.all([
    supabase.from("to_listen").select("album:albums(deezer_id, title, deezer_artist_id)").eq("user_id", userId),
    supabase.from("explore_artists").select("deezer_artist_id").eq("user_id", userId),
  ]);

  const liked: LikedRecord[] = [
    ...rows
      .filter((r) => (r.rating ?? 0) >= 3)
      .map((r) => ({ rating: r.rating!, artist: r.album!.artist, deezer_artist_id: r.album!.deezer_artist_id, deezer_id: r.album!.deezer_id, title: r.album!.title })),
    // Artists picked in the sign-up quiz count like a 4-star record.
    ...favourites.map((f) => ({ rating: 4, artist: f.artist, deezer_artist_id: f.deezer_artist_id, deezer_id: null, title: "" })),
  ];
  const queued = ((queuedRes.data ?? []) as unknown as { album: KnownRecord | null }[]).map((r) => r.album).filter((a): a is KnownRecord => !!a);
  const known: KnownRecord[] = [...rows.map((r) => r.album!), ...queued];

  // Artists you've logged anything by (any rating) or are already exploring aren't "new".
  const exclude = new Set<number>(rows.map((r) => r.album!.deezer_artist_id).filter((x): x is number => !!x));
  for (const e of (exploreRes.data ?? []) as { deezer_artist_id: number }[]) exclude.add(e.deezer_artist_id);

  const picks = await buildSuggestions(liked, known, exclude);

  if (!picks.length)
    return (
      <div className="card-dashed">
        <p style={{ fontWeight: 700 }}>No new picks right now</p>
        <p className="muted">Deezer couldn’t find similar artists you haven’t heard yet. Rate a few more records and check back.</p>
      </div>
    );

  return (
    <div className="grid-covers">
      {picks.map((p) => (
        <div key={p.deezerId} className="stack gap-8" style={{ minWidth: 0 }}>
          <img src={p.cover} alt="" className="cover cover-full" width={250} height={250} loading="lazy" />
          <div className="stack" style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, lineHeight: 1.25 }}>{p.title}</span>
            <span className="muted" style={{ fontSize: 14 }}>{p.artist}{p.year ? ` · ${p.year}` : ""}</span>
            <span className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>Because you liked {p.because.join(" and ")}</span>
          </div>
          <div className="row gap-8">
            <form action={queueFromDeezer}>
              <input type="hidden" name="deezer_id" value={p.deezerId} />
              <input type="hidden" name="source" value={`Discover · because you liked ${p.because.join(" and ")}`} />
              <button type="submit" className="btn btn-sm">+ To listen</button>
            </form>
            <form action={logFromDeezer}>
              <input type="hidden" name="deezer_id" value={p.deezerId} />
              <button type="submit" className="btn-text small" style={{ minHeight: 40 }}>Log it</button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscoverSkeleton() {
  return (
    <div className="grid-covers" aria-busy="true" aria-label="Finding records for you">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="stack gap-8">
          <span className="skeleton" style={{ aspectRatio: "1 / 1", width: "100%" }} />
          <span className="skeleton" style={{ width: "70%", height: 14 }} />
          <span className="skeleton" style={{ width: "45%", height: 12 }} />
        </div>
      ))}
    </div>
  );
}
