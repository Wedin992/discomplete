import { getListenLinks } from "@/lib/listen";
import type { Album } from "@/lib/format";

/** "Listen on Spotify / Apple Music / YouTube Music / Deezer" for a record. */
export async function ListenOn({ album }: { album: Pick<Album, "deezer_id" | "artist" | "title"> }) {
  const links = await getListenLinks(album);
  return (
    <div className="stack gap-8">
      <p className="eyebrow">Listen on</p>
      <div className="row gap-8">
        {links.map((l) => (
          <a
            key={l.service}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            title={l.exact ? `Open ${album.title} on ${l.label}` : `Search for ${album.title} on ${l.label}`}
          >
            {l.label}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
          </a>
        ))}
      </div>
    </div>
  );
}

export function ListenOnPlaceholder() {
  return (
    <div className="stack gap-8" aria-hidden="true">
      <p className="eyebrow">Listen on</p>
      <div className="row gap-8">
        {[92, 118, 132, 80].map((w) => <span key={w} className="skeleton" style={{ width: w, height: 40, borderRadius: 999 }} />)}
      </div>
    </div>
  );
}
