import Link from "next/link";
import { Suspense } from "react";
import { ListenOn, ListenOnPlaceholder } from "@/components/ListenOn";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { artistPath, longDate, todayIso, type Album } from "@/lib/format";
import { LogForm } from "./LogForm";
import { getAlbumTracks } from "@/lib/deezer";

export async function LogView({ album }: { album: Album }) {
  const id = album.id;
  const { supabase, user } = await getUser();
  const tracksP = album.deezer_id ? getAlbumTracks(album.deezer_id).catch(() => []) : Promise.resolve([]);
  const [countRes, collRes, exploreRes] = await Promise.all([
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("album_id", id).eq("user_id", user!.id),
    supabase.from("collection").select("vinyl, cd").eq("album_id", id).eq("user_id", user!.id).maybeSingle(),
    album.deezer_artist_id
      ? supabase.from("explore_artists").select("deezer_artist_id").eq("user_id", user!.id).eq("deezer_artist_id", album.deezer_artist_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // Before migration 0004 the table doesn't exist: then the checkbox is simply not offered.
  const explore = album.deezer_artist_id && !exploreRes.error ? { artist: album.artist, following: !!exploreRes.data } : null;
  const before = countRes.count ?? 0;
  const owned = collRes.data as { vinyl: boolean; cd: boolean } | null;
  const defaultFormat = owned?.vinyl ? "vinyl" : owned?.cd ? "cd" : "stream";
  const today = todayIso();
  const tracks = (await tracksP).map((t) => ({ id: t.id, title: t.title, position: t.position }));

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 720 }}>
      <div className="row gap-16">
        <Cover album={album} size="96" />
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p className="eyebrow">Logging · {longDate(today)}</p>
          <h1 className="title-m" style={{ marginTop: 4 }}>{album.title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{artistPath(album.artist, album.deezer_artist_id) ? <Link href={artistPath(album.artist, album.deezer_artist_id)!} className="artist-link">{album.artist}</Link> : album.artist}{album.release_year ? ` · ${album.release_year}` : ""}</p>
        </div>
        <Link href="/log" className="btn">Change record</Link>
      </div>
      <Suspense fallback={<ListenOnPlaceholder />}>
        <ListenOn album={album} />
      </Suspense>
      <LogForm
        albumId={album.id}
        today={today}
        loggedBefore={before}
        explore={explore}
        tracks={tracks}
        initial={{ format: defaultFormat, rating: 0, note: "", tags: [], isPrivate: false, isAnonymous: false, listenedOn: today }}
      />
    </section>
  );
}
