import Link from "next/link";
import { Cover } from "@/components/Cover";
import { VisibilityIcon } from "@/components/Icons";
import { formatLabel, kindLabel, stars, visibilityLabel, type EntryWithAlbum } from "@/lib/format";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";

export function EntryCard({ entry }: { entry: EntryWithAlbum }) {
  const a = entry.album;
  return (
    <article className="card entry" style={{ padding: 16 }}>
      <Link href={`/record/${a.id}`} tabIndex={-1} aria-hidden="true">
        <Cover album={a} size="76" />
      </Link>
      <div className="entry-body">
        <div className="row gap-4" style={{ alignItems: "baseline", columnGap: 10 }}>
          <Link href={`/record/${a.id}`} className="link-button entry-title">{a.title}</Link>
          <span className="muted">{a.artist}</span>
        </div>
        <div className="meta">
          {entry.rating ? <span className="stars" aria-label={`${entry.rating} of 5`}>{stars(entry.rating)}</span> : null}
          <span>{kindLabel(entry.kind)} · {formatLabel(entry.format)}</span>
          {entry.tags.length ? <span>{entry.tags.join(" · ")}</span> : null}
        </div>
        {entry.note ? <p style={{ marginTop: 2, whiteSpace: "pre-line" }}>{entry.note}</p> : null}
        {entry.lyric ? <p className="lyric">“{entry.lyric}”</p> : null}
        <div className="row gap-12" style={{ justifyContent: "space-between", marginTop: 2 }}>
          <span className="vis">
            <VisibilityIcon isPrivate={entry.is_private} isAnonymous={entry.is_anonymous} />
            {visibilityLabel(entry)}
          </span>
          <DeleteEntryButton id={entry.id} title={a.title} />
        </div>
      </div>
    </article>
  );
}
