import Link from "next/link";
import { Cover } from "@/components/Cover";
import { recordPath, shortDate, stars } from "@/lib/format";
import type { ClubView } from "@/lib/clubs";

/** "3 of 5 have listened" with a small bar. */
export function ClubProgress({ club }: { club: ClubView }) {
  const done = club.members.filter((m) => m.listened).length;
  const total = club.members.length || 1;
  return (
    <div className="stack gap-4" style={{ maxWidth: 320 }}>
      <span className="mono small muted">{done} of {club.members.length} {club.members.length === 1 ? "has" : "have"} listened</span>
      <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${Math.round((done / total) * 100)}%` }} /></div>
    </div>
  );
}

/** A club at a glance: name, this week's album, progress. Used on /clubs and in the diary. */
export function ClubSummary({ club }: { club: ClubView }) {
  const me = club.members.find((m) => m.is_me);
  return (
    <Link href={`/clubs/${club.id}`} className="row gap-16" style={{ alignItems: "center", flexWrap: "nowrap", textDecoration: "none", color: "inherit" }}>
      {club.current ? <Cover album={club.current.album} size="64" /> : <span className="cover cover-64 skeleton" aria-hidden="true" />}
      <span className="stack gap-4" style={{ minWidth: 0, flex: 1 }}>
        <span className="eyebrow">{club.name}</span>
        {club.current ? (
          <>
            <strong>{club.current.album.title} <span className="muted" style={{ fontWeight: 400 }}>· {club.current.album.artist}</span></strong>
            <span className="small" style={{ color: me?.listened ? "var(--accent)" : undefined }}>
              {me?.listened ? `✓ You’ve listened${me.rating ? ` · ${stars(me.rating)}` : ""}` : "Your turn to listen"} · {club.members.filter((m) => m.listened).length}/{club.members.length}
            </span>
          </>
        ) : (
          <span className="muted small">No album this week yet — pick one</span>
        )}
      </span>
      <span style={{ color: "var(--accent)" }} aria-hidden="true">→</span>
    </Link>
  );
}

export function PickHeader({ club }: { club: ClubView }) {
  const p = club.current!;
  return (
    <div className="row gap-20" style={{ alignItems: "flex-start" }}>
      <Link href={recordPath(p.album)} style={{ flex: "0 0 160px" }}><Cover album={p.album} size="full" /></Link>
      <div className="stack gap-8" style={{ flex: "1 1 240px", minWidth: 0 }}>
        <p className="eyebrow">Album of the week · since {shortDate(p.week_start)}</p>
        <h2 className="title-l"><Link href={recordPath(p.album)} className="link-button" style={{ fontSize: "inherit" }}>{p.album.title}</Link></h2>
        <p>{p.album.artist}{p.album.release_year ? <span className="muted"> · {p.album.release_year}</span> : null}</p>
        {p.note ? <p style={{ fontStyle: "italic" }}>“{p.note}”</p> : null}
        <ClubProgress club={club} />
      </div>
    </div>
  );
}
