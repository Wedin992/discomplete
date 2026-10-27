import Link from "next/link";
import { Cover } from "@/components/Cover";
import { VisibilityIcon } from "@/components/Icons";
import { formatLabel, kindLabel, recordPath, stars, visibilityLabel, type EntryWithAlbum } from "@/lib/format";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";

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
          <span className="muted">{a.artist}</span>
        </div>
        <div className="meta">
          {entry.rating ? <span className="stars" aria-label={`${entry.rating} of 5`}>{stars(entry.rating)}</span> : null}
          <span>{kindLabel(entry.kind)} · {formatLabel(entry.format)}</span>
          {entry.tags.length ? <span>{entry.tags.join(" · ")}</span> : null}
        </div>
        {entry.note ? <p style={{ marginTop: 2, whiteSpace: "pre-line" }}>{entry.note}</p> : null}
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
