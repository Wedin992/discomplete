export type Album = {
  id: string;
  deezer_id: number | null;
  title: string;
  artist: string;
  deezer_artist_id: number | null;
  release_year: number | null;
  record_type: string | null;
  genre: string | null;
  cover_small: string | null;
  cover_medium: string | null;
  cover_xl: string | null;
  track_count: number | null;
  duration_sec: number | null;
  /** Set by the database (migration 0002). Null only before that migration has run. */
  artist_slug?: string | null;
  title_slug?: string | null;
};

type Linkable = Pick<Album, "id"> & { artist_slug?: string | null; title_slug?: string | null };

/** /record/metallica/and-justice-for-all — falls back to the id before slugs exist. */
export function recordPath(a: Linkable) {
  return a.artist_slug && a.title_slug ? `/record/${a.artist_slug}/${a.title_slug}` : `/record/${a.id}`;
}

export function logPath(a: Linkable) {
  return `${recordPath(a)}/log`;
}

/** Same rules as the database's slugify(): "Björk" → "bjork", "Simon & Garfunkel" → "simon-and-garfunkel". */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** /artist/metallica-119 — the Deezer artist id at the end keeps it unique. */
export function artistPath(name: string, deezerArtistId: number | null | undefined) {
  if (!deezerArtistId) return null;
  return `/artist/${slugify(name) || "artist"}-${deezerArtistId}`;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export type Entry = {
  id: string;
  album_id: string;
  listened_on: string;
  rating: number | null;
  format: "stream" | "vinyl" | "cd";
  kind: "first" | "relisten";
  note: string | null;
  /** Detected language of the note and its English translation (migration 0003). */
  note_lang?: string | null;
  note_en?: string | null;
  tags: string[];
  is_private: boolean;
  is_anonymous: boolean;
  created_at: string;
};

export type EntryWithAlbum = Entry & { album: Album };

export const FORMATS = [
  { value: "stream", label: "Stream" },
  { value: "vinyl", label: "Vinyl" },
  { value: "cd", label: "CD" },
] as const;

export const TAGS = ["running", "gym", "work", "focus", "evening", "home", "car", "party", "travel", "concert"];

export const RATING_LABELS = ["No rating", "Not for me", "Meh", "Good", "Great", "All-time"];

export function stars(n: number | null | undefined) {
  const r = Math.max(0, Math.min(5, n ?? 0));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

export function formatLabel(f: string) {
  return FORMATS.find((x) => x.value === f)?.label ?? "Stream";
}

export function kindLabel(k: string) {
  return k === "relisten" ? "Relisten" : "First listen";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function longDate(iso: string) {
  const d = parseDay(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function shortDate(iso: string) {
  const d = parseDay(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

export function monthName(iso: string) {
  return MONTHS[parseDay(iso).getUTCMonth()];
}

/** Today's date in Stockholm time, as YYYY-MM-DD. */
export function todayIso() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
}

export function daysBetween(aIso: string, bIso: string) {
  return Math.round((parseDay(bIso).getTime() - parseDay(aIso).getTime()) / 86400000);
}

export function duration(sec: number | null) {
  if (!sec) return "";
  return `${Math.round(sec / 60)} min`;
}

export function visibilityLabel(e: Pick<Entry, "is_private" | "is_anonymous">) {
  if (e.is_private) return "Private — only you";
  if (e.is_anonymous) return "Public as Anonymous listener";
  return "Public";
}

export function cover(a: Pick<Album, "cover_small" | "cover_medium" | "cover_xl">, size: "s" | "m" | "xl") {
  if (size === "s") return a.cover_small ?? a.cover_medium ?? a.cover_xl ?? null;
  if (size === "m") return a.cover_medium ?? a.cover_xl ?? a.cover_small ?? null;
  return a.cover_xl ?? a.cover_medium ?? a.cover_small ?? null;
}
