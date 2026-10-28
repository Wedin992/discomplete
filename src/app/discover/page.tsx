import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { UNLOCK_AT } from "@/lib/discover";
import { GENRES, GENRES_ENABLED } from "@/lib/genre";
import { longDate, todayIso } from "@/lib/format";
import { ThreePicks, ThreeSkeleton } from "./ThreePicks";
import { GenrePicker } from "./GenrePicker";

export const metadata: Metadata = { title: "Discover" };

type Row = {
  rating: number | null;
  album: { deezer_id: number | null; title: string } | null;
};

export default async function DiscoverPage() {
  const { supabase, user } = await getUser();
  const [entriesRes, favRes, waitingRes] = await Promise.all([
    supabase
      .from("entries")
      .select("rating, album:albums(deezer_id, title)")
      .eq("user_id", user!.id),
    supabase
      .from("favorite_artists")
      .select("deezer_artist_id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("to_listen")
      .select("album_id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .like("source", "Discover%"),
  ]);
  const rows = ((entriesRes.data ?? []) as unknown as Row[]).filter(
    (r) => r.album,
  );
  const likedCount = new Set(
    rows
      .filter((r) => (r.rating ?? 0) >= 3)
      .map((r) => r.album!.deezer_id ?? r.album!.title),
  ).size;
  const unlocked = likedCount >= UNLOCK_AT || (favRes.count ?? 0) > 0;
  const waiting = waitingRes.count ?? 0;

  return (
    <section className="stack gap-28">
      <div>
        <p className="eyebrow">Inspiration</p>
        <h1 className="title-xl">Discover</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Three records a day, picked from what you love and what people with
          your taste love.
        </p>
      </div>

      {unlocked ? (
        <section className="stack gap-16" aria-labelledby="today-three">
          <div
            className="row gap-12"
            style={{ justifyContent: "space-between", alignItems: "baseline" }}
          >
            <h2 id="today-three" className="title-l" style={{ margin: 0 }}>
              Today’s three
            </h2>
            <span className="mono muted" style={{ fontSize: 11 }}>
              {longDate(todayIso())}
            </span>
          </div>
          {waiting >= 3 ? (
            <div
              className="card row gap-12"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <p style={{ margin: 0 }}>
                <strong>{waiting} Discover picks</strong> are waiting in To
                listen — maybe start there?
              </p>
              <Link href="/to-listen" className="btn btn-sm">
                Open To listen
              </Link>
            </div>
          ) : null}
          <Suspense fallback={<ThreeSkeleton />}>
            <ThreePicks scope="daily" source="picks" />
          </Suspense>
        </section>
      ) : (
        <div className="card stack gap-12">
          <p style={{ fontWeight: 700, fontSize: 18 }}>
            {likedCount} of {UNLOCK_AT} — rate {UNLOCK_AT - likedCount} more{" "}
            {UNLOCK_AT - likedCount === 1 ? "record" : "records"} to unlock
            Today’s three
          </p>
          <div className="bar" style={{ height: 10 }} aria-hidden="true">
            <span style={{ width: `${(likedCount / UNLOCK_AT) * 100}%` }} />
          </div>
          <p className="muted">
            Give 3 stars or more to five different records — or tell us a few
            artists you love to get picks right away.
          </p>
          <div className="row gap-12">
            <Link href="/log" className="btn btn-primary">
              Log a listen
            </Link>
            <Link href="/welcome" className="btn">
              Pick artists you love
            </Link>
          </div>
        </div>
      )}

      {GENRES_ENABLED ? (
        <section className="stack gap-16" aria-labelledby="by-genre">
          <div>
            <h2 id="by-genre" className="title-l" style={{ margin: 0 }}>
              In the mood for a genre?
            </h2>
            <p className="muted" style={{ marginTop: 4 }}>
              Pick one and get three records from it — a safe bet, a classic and
              a wildcard.
            </p>
          </div>
          <GenrePicker
            genres={GENRES.map(({ slug, name }) => ({ slug, name }))}
          />
        </section>
      ) : null}
    </section>
  );
}
