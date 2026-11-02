import Link from "next/link";
import { Cover } from "@/components/Cover";
import { VisibilityIcon } from "@/components/Icons";
import { artistPath, formatLabel, kindLabel, ratingText, recordPath, stars, visibilityLabel, type EntryWithAlbum } from "@/lib/format";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { NoteText } from "@/components/NoteText";
import { RateBadge } from "@/components/RateBadge";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayShort = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()}`;
};

/** A plain relisten — no stars, no words: one quiet line, not a full card. */
export function RelistenRow({ entry, nth, rating }: { entry: EntryWithAlbum; nth?: number; rating?: number | null }) {
  const a = entry.album;
  return (
    <article className="relisten-row">
      <Link href={recordPath(a)} tabIndex={-1} aria-hidden="true"><Cover album={a} size="44" /></Link>
      <div className="stack" style={{ gap: 2, minWidth: 0, flex: "1 1 auto" }}>
        <span className="relisten-line">
          <Link href={recordPath(a)} className="relisten-title">{a.title}</Link>
          <span className="muted"> · {a.artist}</span>
        </span>
        <span className="mono muted" style={{ fontSize: 11 }}>
          {dayShort(entry.listened_on)} · ↻ Played again{nth && nth > 1 ? ` · ${nth}${nth % 100 >= 11 && nth % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][nth % 10] ?? "th"} listen` : ""}
          {rating ? <> · <span className="stars">{stars(rating)}</span></> : null}
        </span>
      </div>
      <Link href={`/entry/${entry.id}/edit`} className="btn-text small" style={{ minHeight: 32, display: "inline-flex", alignItems: "center", textDecoration: "none" }} aria-label={`Edit this listen of ${a.title}`}>
        Edit
      </Link>
    </article>
  );
}


/**
 * One listen as a single line — cover, title, stars, the start of what you wrote.
 * Tap it to open the whole entry (full note, favourite tracks, edit) in place.
 */
export function EntryRow({ entry, open = false }: { entry: EntryWithAlbum; open?: boolean }) {
  const a = entry.album;
  const snippet = entry.note ? (entry.note.length > 90 ? entry.note.slice(0, 90).trimEnd() + "…" : entry.note) : null;
  return (
    <details className="entry-row" open={open}>
      <summary>
        <Cover album={a} size="44" />
        <span className="er-main">
          <span className="er-line">
            <span className="er-title">{a.title}</span>
            <span className="muted"> · {a.artist}</span>
          </span>
          <span className="er-meta">
            <span className="mono muted">{entry.kind === "before" ? "Heard before" : dayShort(entry.listened_on)}</span>
            {entry.rating ? <span className="stars">{stars(entry.rating)}</span> : <span className="er-todo">☆ not rated</span>}
            {entry.kind === "relisten" ? <span className="mono muted">↻</span> : null}
          </span>
          {snippet ? <span className="er-snippet">“{snippet}”</span> : null}
        </span>
        <span className="er-chevron" aria-hidden="true">›</span>
      </summary>
      <div className="er-body">
        <EntryCard entry={entry} embedded />
      </div>
    </details>
  );
}

export function EntryCard({ entry, embedded = false }: { entry: EntryWithAlbum; embedded?: boolean }) {
  const a = entry.album;
  return (
    <article className={embedded ? "entry entry-embedded" : "card entry"} style={{ padding: embedded ? 0 : 16 }}>
      {embedded ? null : (
        <Link href={recordPath(a)} tabIndex={-1} aria-hidden="true">
          <Cover album={a} size="76" />
        </Link>
      )}
      <div className="entry-body">
        {embedded ? (
          <div className="row gap-12" style={{ alignItems: "baseline" }}>
            <Link href={recordPath(a)} className="btn-text small" style={{ color: "var(--accent)", textDecoration: "none" }}>Open record →</Link>
            {artistPath(a.artist, a.deezer_artist_id) ? <Link href={artistPath(a.artist, a.deezer_artist_id)!} className="btn-text small" style={{ textDecoration: "none" }}>{a.artist} →</Link> : null}
          </div>
        ) : (
          <div className="row gap-4" style={{ alignItems: "baseline", columnGap: 10 }}>
            <Link href={recordPath(a)} className="link-button entry-title">{a.title}</Link>
            {artistPath(a.artist, a.deezer_artist_id) ? <Link href={artistPath(a.artist, a.deezer_artist_id)!} className="muted artist-link">{a.artist}</Link> : <span className="muted">{a.artist}</span>}
          </div>
        )}
        <div className="meta">
          {entry.rating ? <span className="stars" aria-label={`${ratingText(Number(entry.rating))} of 5`}>{stars(entry.rating)}</span> : null}
          {entry.rating ? null : <RateBadge entryId={entry.id} title={a.title} />}
          <span>{entry.kind === "before" ? "Heard before" : `${kindLabel(entry.kind)} · ${formatLabel(entry.format)}`}</span>
          {entry.tags.length ? <span>{entry.tags.join(" · ")}</span> : null}
        </div>
        {entry.fav_tracks?.length ? <p className="fav-line">♥ {entry.fav_tracks.map((t) => t.title).join(" · ")}</p> : null}
        {entry.note ? (
          <div style={{ marginTop: 2 }}>
            <NoteText note={entry.note} lang={entry.note_lang} />
          </div>
        ) : (
          <Link href={`/entry/${entry.id}/edit`} className="badge-todo badge-soft" style={{ alignSelf: "flex-start" }}>✎ No review yet · Write one</Link>
        )}
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
