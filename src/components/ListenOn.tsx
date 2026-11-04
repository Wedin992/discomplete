import { getListenLinks } from "@/lib/listen";
import type { Album } from "@/lib/format";

/** "Listen on Spotify / Apple Music / YouTube Music / Deezer" for a record. */
export async function ListenOn({ album }: { album: Pick<Album, "deezer_id" | "artist" | "title"> }) {
  const links = await getListenLinks(album);
  return (
    <details className="listen-menu">
      <summary className="btn btn-sm">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
        Listen
        <span className="er-chevron" aria-hidden="true" style={{ fontSize: 16, marginLeft: 2 }}>›</span>
      </summary>
      <div className="listen-links">
        {links.map((l) => (
          <a
            key={l.service}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="listen-link"
            title={l.exact ? `Open ${album.title} on ${l.label}` : `Search for ${album.title} on ${l.label}`}
          >
            <span className={`listen-dot listen-${l.service}`} aria-hidden="true" />
            {l.label}
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
          </a>
        ))}
      </div>
    </details>
  );
}

export function ListenOnPlaceholder() {
  return (
    <span className="skeleton" aria-hidden="true" style={{ width: 92, height: 36, borderRadius: 999 }} />
  );
}
