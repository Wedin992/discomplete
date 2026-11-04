import Link from "next/link";
import { Cover } from "@/components/Cover";
import { recordPath, stars, type Album } from "@/lib/format";

export type RowItem = { album: Album; sub?: string | null; rating?: number | null; href?: string };

/** A horizontal, swipeable row of covers with a heading — for Discover and the diary. */
export function AlbumRow({ title, href, items, note }: { title: string; href?: string; linkLabel?: string; items: RowItem[]; note?: string }) {
  if (!items.length) return null;
  return (
    <section className="stack gap-12" aria-label={title}>
      <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="eyebrow">{href ? <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{title} ›</Link> : title}</h2>
      </div>
      {note ? <p className="muted small" style={{ marginTop: -6 }}>{note}</p> : null}
      <div className="album-row">
        {items.map((it, i) => (
          <Link key={`${it.album.id}-${i}`} href={it.href ?? recordPath(it.album)} className="album-row-item">
            <Cover album={it.album} size="full" />
            <span className="album-row-title">{it.album.title}</span>
            <span className="album-row-sub">{it.sub ?? it.album.artist}</span>
            {it.rating ? <span className="stars small">{stars(it.rating)}</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
