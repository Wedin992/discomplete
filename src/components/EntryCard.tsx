import Link from "next/link";
import { Cover } from "@/components/Cover";
import { VisibilityIcon } from "@/components/Icons";
import { artistPath, formatLabel, kindLabel, recordPath, stars, visibilityLabel, type EntryWithAlbum } from "@/lib/format";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { NoteText } from "@/components/NoteText";

export function EntryCard({ entry }: { entry: EntryWithAlbum }) {
  const a = entry.album;
  return (
    <article className="card entry" style={{ padding: 16 }}>
      <Link href={recordPath(a)} tabIndex={-1} aria-hidden="true">
        <Cover album={a} size="76" />
      </Link>
      <div className="entry-body">
        <div className="row gap-4" style={{ alignItems: "baseline", columnGap: 10 }}>
          <Link href={recordPath(a)} className="link-button entry-title">{a.title}</Link>
          {artistPath(a.artist, a.deezer_artist_id) ? <Link href={artistPath(a.artist, a.deezer_artist_id)!} className="muted artist-link">{a.artist}</Link> : <span className="muted">{a.artist}</span>}
        </div>
        <div className="meta">
          {entry.rating ? <span className="stars" aria-label={`${entry.rating} of 5`}>{stars(entry.rating)}</span> : null}
          <span>{entry.kind === "before" ? "Heard before" : `${kindLabel(entry.kind)} · ${formatLabel(entry.format)}`}</span>
          {entry.tags.length ? <span>{entry.tags.join(" · ")}</span> : null}
        </div>
        {entry.fav_tracks?.length ? <p className="fav-line">♥ {entry.fav_tracks.map((t) => t.title).join(" · ")}</p> : null}
        {entry.note ? (
          <div style={{ marginTop: 2 }}>
            <NoteText note={entry.note} lang={entry.note_lang} english={entry.note_en} />
          </div>
        ) : null}
        <div className="row gap-12" style={{ justifyContent: "space-between", marginTop: 2 }}>
          <span className="vis">
            <VisibilityIcon isPrivate={entry.is_private} isAnonymous={entry.is_anonymous} />
            {visibilityLabel(entry)}
          </span>
          <div className="row gap-16">
            <Link href={`/entry/${entry.id}/edit`} className="btn-text small" style={{ minHeight: 32, display: "inline-flex", alignItems: "center", textDecoration: "none" }} aria-label={`Edit this entry about ${a.title}`}>
              Edit
            </Link>
            <DeleteEntryButton id={entry.id} title={a.title} />
          </div>
        </div>
      </div>
    </article>
  );
}
