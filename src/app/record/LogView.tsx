import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { artistPath, todayIso, type Album } from "@/lib/format";
import { LogForm } from "./LogForm";
import { getAlbumTracks } from "@/lib/deezer";

export async function LogView({ album, date, suggestionId }: { album: Album; date?: string; suggestionId?: string }) {
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
  // Coming from a Last.fm suggestion: the day it was played.
  const listenedOn = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : today;
  const tracks = (await tracksP).map((t) => ({ id: t.id, title: t.title, position: t.position }));

  return (
    <section className="narrow" style={{ maxWidth: 640 }}>
      <LogForm
        albumId={album.id}
        today={today}
        loggedBefore={before}
        explore={explore}
        tracks={tracks}
        suggestionId={suggestionId && /^[0-9a-f-]{36}$/i.test(suggestionId) ? suggestionId : undefined}
        initial={{ format: defaultFormat, rating: 0, note: "", tags: [], isPrivate: false, isAnonymous: false, listenedOn }}
        head={
          <div className="log-head">
            <div className="stack gap-4" style={{ minWidth: 0 }}>
              <p className="eyebrow">{album.record_type === "single" ? "Single" : album.record_type === "ep" ? "EP" : "Album"}{album.release_year ? ` · ${album.release_year}` : ""}</p>
              <h1>{album.title}</h1>
              <p className="muted">{artistPath(album.artist, album.deezer_artist_id) ? <Link href={artistPath(album.artist, album.deezer_artist_id)!} className="artist-link">{album.artist}</Link> : album.artist}</p>
              <Link href="/log" className="btn-text small" style={{ alignSelf: "flex-start", minHeight: 32 }}>Change record</Link>
            </div>
            <Cover album={album} size="96" />
          </div>
        }
      />
    </section>
  );
}
