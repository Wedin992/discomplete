import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { kindLabel, longDate, recordPath, todayIso, type EntryWithAlbum } from "@/lib/format";
import { LogForm } from "@/app/record/LogForm";
import { getAlbumTracks } from "@/lib/deezer";

export const metadata: Metadata = { title: "Edit entry" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("entries").select("*, album:albums(*)").eq("id", id).eq("user_id", user!.id).maybeSingle();
  const entry = data as unknown as EntryWithAlbum | null;
  if (!entry) notFound();
  const album = entry.album;
  const exploreRes = album.deezer_artist_id
    ? await supabase.from("explore_artists").select("deezer_artist_id").eq("user_id", user!.id).eq("deezer_artist_id", album.deezer_artist_id).maybeSingle()
    : null;
  const tracks = album.deezer_id ? (await getAlbumTracks(album.deezer_id).catch(() => [])).map((t) => ({ id: t.id, title: t.title, position: t.position })) : [];
  const explore = exploreRes && !exploreRes.error ? { artist: album.artist, following: !!exploreRes.data } : null;

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 640 }}>
      <LogForm
        albumId={album.id}
        entryId={entry.id}
        explore={explore}
        tracks={tracks}
        today={todayIso()}
        initial={{
          format: entry.format,
          rating: entry.rating ?? 0,
          note: entry.note ?? "",
          tags: entry.tags ?? [],
          isPrivate: entry.is_private,
          isAnonymous: entry.is_anonymous,
          listenedOn: entry.listened_on,
          kind: entry.kind,
          favTracks: entry.fav_tracks ?? [],
        }}
        head={
          <div className="log-head">
            <div className="stack gap-4" style={{ minWidth: 0 }}>
              <p className="eyebrow">{entry.kind === "before" ? "Heard before" : `${kindLabel(entry.kind)} · ${longDate(entry.listened_on)}`}</p>
              <h1>{album.title}</h1>
              <p className="muted">{album.artist}{album.release_year ? ` · ${album.release_year}` : ""}</p>
              <Link href={recordPath(album)} className="btn-text small" style={{ alignSelf: "flex-start", minHeight: 32 }}>View record</Link>
            </div>
            <Cover album={album} size="96" />
          </div>
        }
      />
      <div className="card-dashed row gap-12" style={{ justifyContent: "space-between" }}>
        <p className="muted">Changed your mind completely?</p>
        <DeleteEntryButton id={entry.id} title={album.title} label="Delete this entry" redirectTo="/" />
      </div>
    </section>
  );
}
