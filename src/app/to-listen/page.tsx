import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { toggleToListen } from "@/app/actions";
import type { Album } from "@/lib/format";

export const metadata: Metadata = { title: "To listen" };

export default async function ToListenPage() {
  const { supabase, user } = await getUser();
  const { data } = await supabase
    .from("to_listen")
    .select("source, created_at, album:albums(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const items = ((data ?? []) as unknown as { source: string | null; album: Album }[]).filter((r) => r.album);

  return (
    <section className="stack gap-20 narrow" style={{ maxWidth: 780 }}>
      <div>
        <p className="eyebrow">Your queue</p>
        <h1 className="title-xl">To listen</h1>
      </div>
      {items.length ? (
        items.map(({ album, source }) => (
          <div key={album.id} className="card row gap-16" style={{ padding: 14 }}>
            <Cover album={album} size="64" />
            <div className="stack gap-4" style={{ flex: "1 1 220px", minWidth: 0 }}>
              <Link href={`/record/${album.id}`} className="link-button" style={{ fontSize: 18 }}>{album.title}</Link>
              <span className="muted">{album.artist}{album.release_year ? ` · ${album.release_year}` : ""}</span>
              {source ? <span className="mono muted" style={{ fontSize: 11 }}>{source}</span> : null}
            </div>
            <div className="row gap-8">
              <Link href={`/record/${album.id}/log`} className="btn btn-primary">Log it</Link>
              <form action={toggleToListen}>
                <input type="hidden" name="album_id" value={album.id} />
                <button type="submit" className="btn">Remove</button>
              </form>
            </div>
          </div>
        ))
      ) : (
        <div className="card-dashed">
          <p style={{ fontWeight: 700 }}>Nothing queued</p>
          <p className="muted">Tap “+ To listen” on any record page to save it here.</p>
        </div>
      )}
    </section>
  );
}
