// Server-only: "Listen on" links for a record.
// Exact links where we can get them for free, otherwise a search in that service.
// Results are cached for 30 days per record (Next's data cache), so lookups are rare.
import { baseTitle } from "@/lib/deezer";
import type { Album } from "@/lib/format";

export type ListenLink = { service: "spotify" | "apple" | "youtube" | "deezer"; label: string; url: string; exact: boolean };

const MONTH = 60 * 60 * 24 * 30;
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: MONTH }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Odesli (song.link): turns a Deezer album link into links for other services. */
async function fromOdesli(deezerId: number) {
  type R = { linksByPlatform?: Record<string, { url: string }> };
  const deezerUrl = encodeURIComponent(`https://www.deezer.com/album/${deezerId}`);
  const r = await getJson<R>(`https://api.song.link/v1-alpha.1/links?url=${deezerUrl}&userCountry=SE`);
  const p = r?.linksByPlatform ?? {};
  return { spotify: p.spotify?.url, apple: p.appleMusic?.url, youtube: p.youtubeMusic?.url };
}

/** Apple's open iTunes Search API: finds the album page on Apple Music. */
async function fromItunes(artist: string, title: string) {
  type R = { results?: { artistName: string; collectionName: string; collectionViewUrl: string }[] };
  const term = encodeURIComponent(`${artist} ${title}`.slice(0, 200));
  const r = await getJson<R>(`https://itunes.apple.com/search?term=${term}&entity=album&limit=10&country=se`);
  const results = r?.results ?? [];
  const a = norm(artist);
  const t = norm(baseTitle(title));
  const best =
    results.find((x) => norm(x.artistName) === a && norm(baseTitle(x.collectionName)) === t) ??
    results.find((x) => norm(x.artistName) === a && norm(baseTitle(x.collectionName)).startsWith(t));
  return best?.collectionViewUrl?.replace(/[?&]uo=\d+/, "");
}

export async function getListenLinks(album: Pick<Album, "deezer_id" | "artist" | "title">): Promise<ListenLink[]> {
  const q = encodeURIComponent(`${album.artist} ${baseTitle(album.title) || album.title}`);
  const [odesli, itunes] = await Promise.all([
    album.deezer_id ? fromOdesli(album.deezer_id) : Promise.resolve({ spotify: undefined, apple: undefined, youtube: undefined }),
    fromItunes(album.artist, album.title),
  ]);

  const links: ListenLink[] = [
    odesli.spotify
      ? { service: "spotify", label: "Spotify", url: odesli.spotify, exact: true }
      : { service: "spotify", label: "Spotify", url: `https://open.spotify.com/search/${q}/albums`, exact: false },
    odesli.apple || itunes
      ? { service: "apple", label: "Apple Music", url: (odesli.apple || itunes)!, exact: true }
      : { service: "apple", label: "Apple Music", url: `https://music.apple.com/se/search?term=${q}`, exact: false },
    odesli.youtube
      ? { service: "youtube", label: "YouTube Music", url: odesli.youtube, exact: true }
      : { service: "youtube", label: "YouTube Music", url: `https://music.youtube.com/search?q=${q}`, exact: false },
  ];
  if (album.deezer_id) links.push({ service: "deezer", label: "Deezer", url: `https://www.deezer.com/album/${album.deezer_id}`, exact: true });
  return links;
}
