import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { shortDate, type EntryWithAlbum } from "@/lib/format";

export const metadata: Metadata = { title: "Lyrics you kept" };

export default async function LyricsPage() {
  const { supabase, user } = await getUser();
  const { data } = await supabase
    .from("entries")
    .select("*, album:albums(*)")
    .eq("user_id", user!.id)
    .not("lyric", "is", null)
    .order("listened_on", { ascending: false });
  const items = (data ?? []) as unknown as EntryWithAlbum[];

  return (
    <section className="stack gap-20 narrow" style={{ maxWidth: 780 }}>
      <div>
        <p className="eyebrow">Your commonplace book</p>
        <h1 className="title-xl">Lyrics you kept</h1>
        <p className="muted" style={{ marginTop: 8 }}>Lines you saved while logging, collected in one place.</p>
      </div>
      {items.length ? (
        items.map((e) => (
          <figure key={e.id} className="card stack gap-8" style={{ margin: 0, padding: "22px 24px" }}>
            <blockquote style={{ margin: 0, fontSize: 26, lineHeight: 1.25, fontStyle: "italic" }}>“{e.lyric}”</blockquote>
            <figcaption className="mono small muted">
              <Link href={`/record/${e.album_id}`} style={{ color: "inherit" }}>{e.album.title} — {e.album.artist}</Link> · {shortDate(e.listened_on)}
            </figcaption>
          </figure>
        ))
      ) : (
        <div className="card-dashed"><p className="muted">No lines yet. Add one when you log a listen.</p></div>
      )}
    </section>
  );
}
