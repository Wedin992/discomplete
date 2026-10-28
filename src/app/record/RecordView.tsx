import Link from "next/link";
import { Suspense } from "react";
import { ListenOn, ListenOnPlaceholder } from "@/components/ListenOn";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { NoteText } from "@/components/NoteText";
import { whenLabel, artistPath, duration, formatLabel, kindLabel, logPath, shortDate, stars, visibilityLabel, type Album, type Entry } from "@/lib/format";
import { toggleCollection, toggleToListen } from "@/app/actions";

type Stats = { rating_count: number; avg_rating: number | null; r1: number; r2: number; r3: number; r4: number; r5: number };
type PublicNote = {
  id: string; listened_on: string; rating: number | null; note: string; created_at: string;
  note_lang?: string | null; note_en?: string | null;
  username: string | null; display_name: string | null; is_anonymous: boolean; is_mine: boolean;
};

export async function RecordView({ album }: { album: Album }) {
  const id = album.id;
  const { supabase, user } = await getUser();

  const [statsRes, notesRes, mineRes, listRes, collRes] = await Promise.all([
    supabase.rpc("album_stats", { p_album: id }).maybeSingle(),
    supabase.rpc("album_public_notes", { p_album: id, p_limit: 20 }),
    supabase.from("entries").select("*").eq("album_id", id).eq("user_id", user!.id).order("listened_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("to_listen").select("album_id").eq("album_id", id).eq("user_id", user!.id).maybeSingle(),
    supabase.from("collection").select("vinyl, cd, wishlist").eq("album_id", id).eq("user_id", user!.id).maybeSingle(),
  ]);

  const stats = statsRes.data as Stats | null;
  const notes = (notesRes.data ?? []) as PublicNote[];
  const mine = (mineRes.data ?? []) as Entry[];
  const inList = !!listRes.data;
  const coll = (collRes.data ?? { vinyl: false, cd: false, wishlist: false }) as { vinyl: boolean; cd: boolean; wishlist: boolean };

  const total = stats?.rating_count ?? 0;
  const dist = [5, 4, 3, 2, 1].map((n) => {
    const c = stats ? (stats[`r${n}` as keyof Stats] as number) : 0;
    return { n, pct: total ? Math.round((c / total) * 100) : 0 };
  });

  const typeLabel = album.record_type === "single" ? "Single" : album.record_type === "ep" ? "EP" : "Album";
  const metaLine = [typeLabel, album.release_year, album.genre].filter(Boolean).join(" · ");
  const facts = [album.track_count ? `${album.track_count} tracks` : "", duration(album.duration_sec)].filter(Boolean).join(" · ");

  return (
    <div className="stack gap-56">
      <div className="row gap-40" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: "0 1 340px", maxWidth: "100%" }}>
          <Cover album={album} size="hero" decorative={false} />
        </div>
        <div className="stack gap-16" style={{ flex: "999 1 420px", minWidth: 0 }}>
          <p className="eyebrow">{metaLine}</p>
          <h1 className="title-xl" style={{ fontSize: "clamp(40px, 7vw, 68px)", lineHeight: 0.92 }}>{album.title}</h1>
          <p style={{ fontSize: 24 }}>{artistPath(album.artist, album.deezer_artist_id) ? <Link href={artistPath(album.artist, album.deezer_artist_id)!} className="artist-link">{album.artist}</Link> : album.artist}</p>
          {facts ? <div className="row gap-8"><span className="chip" style={{ fontSize: 12, padding: "5px 12px" }}>{facts}</span></div> : null}
          <div className="row gap-12" style={{ marginTop: 4 }}>
            <Link href={logPath(album)} className="btn btn-primary btn-lg">Log this listen</Link>
            <form action={toggleToListen}>
              <input type="hidden" name="album_id" value={album.id} />
              <input type="hidden" name="source" value="Saved from the record page" />
              <button type="submit" className="btn btn-lg" aria-pressed={inList}>{inList ? "✓ On your To listen" : "+ To listen"}</button>
            </form>
          </div>
          <Suspense fallback={<ListenOnPlaceholder />}>
            <ListenOn album={album} />
          </Suspense>
          <div className="stack gap-8">
            <p className="eyebrow">In your collection</p>
            <div className="row gap-8">
              {(["vinyl", "cd", "wishlist"] as const).map((f) => (
                <form key={f} action={toggleCollection}>
                  <input type="hidden" name="album_id" value={album.id} />
                  <input type="hidden" name="field" value={f} />
                  <button type="submit" className="btn pill" aria-pressed={coll[f]}>
                    {coll[f] ? "✓ " : ""}{f === "cd" ? "CD" : f === "vinyl" ? "Vinyl" : "Wishlist"}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="stack gap-20">
        <h2 className="title-l">What others think</h2>
        <div className="row gap-28" style={{ alignItems: "flex-start" }}>
          <div className="card stack gap-8" style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div className="row gap-8" style={{ alignItems: "baseline" }}>
              <span style={{ fontSize: 60, lineHeight: 1, fontWeight: 800, fontStretch: "75%" }}>{stats?.avg_rating ?? "–"}</span>
              <span className="muted">{total === 1 ? "1 rating" : `${total.toLocaleString("en-US")} ratings`}</span>
            </div>
            {dist.map((d) => (
              <div key={d.n} className="row gap-8 mono small muted" style={{ flexWrap: "nowrap" }}>
                <span style={{ flex: "0 0 26px" }}>{d.n}★</span>
                <span className="bar"><span style={{ width: `${d.pct}%` }} /></span>
                <span style={{ flex: "0 0 36px", textAlign: "right" }}>{d.pct}%</span>
              </div>
            ))}
            <p className="muted small" style={{ marginTop: 4 }}>Anonymous ratings count. Private ones don’t.</p>
          </div>
          <div className="stack gap-12" style={{ flex: "999 1 420px", minWidth: 0 }}>
            {notes.length ? (
              notes.map((n) => {
                const who = n.is_anonymous ? "Anonymous listener" : n.display_name || n.username || "Listener";
                return (
                  <article key={n.id} className="card row gap-12" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                    <span className="avatar" aria-hidden="true">{n.is_anonymous ? "?" : who.charAt(0).toUpperCase()}</span>
                    <div className="stack gap-4" style={{ minWidth: 0 }}>
                      <div className="row gap-8" style={{ alignItems: "baseline", columnGap: 12 }}>
                        <span style={{ fontWeight: 700 }}>{who}{n.is_mine ? " (you)" : ""}</span>
                        {n.rating ? <span className="stars small">{stars(n.rating)}</span> : null}
                        <span className="mono small muted">{shortDate(n.listened_on)}</span>
                      </div>
                      <NoteText note={n.note} lang={n.note_lang} english={n.note_en} />
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="card-dashed">
                <p style={{ fontWeight: 700 }}>No public notes yet</p>
                <p className="muted">Log a listen and yours could be the first one people read here.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {mine.length ? (
        <section className="stack gap-12">
          <h2 className="title-l">Your diary on this record</h2>
          <p className="muted">Every listen you’ve logged — see how it changed.</p>
          {mine.map((e) => (
            <div key={e.id} className="card row gap-20" style={{ alignItems: "flex-start" }}>
              <div className="stack mono small muted" style={{ flex: "0 0 150px" }}>
                <span>{whenLabel(e)}</span>
                <span style={{ textTransform: "uppercase" }}>{kindLabel(e.kind)} · {formatLabel(e.format)}</span>
                {e.rating ? <span className="stars">{stars(e.rating)}</span> : null}
              </div>
              <div className="stack gap-4" style={{ flex: "1 1 300px", minWidth: 0 }}>
                {e.note ? <NoteText note={e.note} lang={e.note_lang} english={e.note_en} /> : <p>—</p>}
                <div className="row gap-16" style={{ justifyContent: "space-between" }}>
                  <span className="mono muted" style={{ fontSize: 11 }}>{visibilityLabel(e)}</span>
                  <Link href={`/entry/${e.id}/edit`} className="btn-text small" style={{ minHeight: 32, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Edit</Link>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
