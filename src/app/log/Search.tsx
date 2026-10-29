"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronIcon, SearchIcon } from "@/components/Icons";
import Link from "next/link";
import { logFromDeezer } from "@/app/actions";
import { QuickRate } from "@/components/QuickRate";
import type { SearchAlbum, SearchTrack } from "@/lib/deezer";

const TRIES = ["and justice for all", "kent", "rumours"];

/** A search hit; tapping it saves the record (if new) and opens the log form directly. */
function ResultButton({ children, transparent }: { children: React.ReactNode; transparent?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="result" disabled={pending} style={transparent ? { background: "transparent" } : undefined}>
      {children}
      {pending ? <span className="chip">Opening…</span> : <ChevronIcon />}
    </button>
  );
}

export type SearchMode = "log" | "before";
type Props = {
  initialQuery: string;
  children?: React.ReactNode;
  autoFocus?: boolean;
  initialMode?: SearchMode;
  /** On the /log page the switch navigates (so the page title follows); in the sheet it's local. */
  modeLinks?: boolean;
};

export function Search({ initialQuery, children, autoFocus = true, initialMode = "log", modeLinks = false }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [albums, setAlbums] = useState<SearchAlbum[]>([]);
  const [tracks, setTracks] = useState<SearchTrack[]>([]);
  const [years, setYears] = useState<Record<number, number | null>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setAlbums([]);
      setTracks([]);
      setStatus("idle");
      return;
    }
    const id = ++reqId.current;
    setStatus("loading");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (id !== reqId.current) return;
        if (!res.ok) throw new Error(json.error);
        const found: SearchAlbum[] = json.albums ?? [];
        setAlbums(found);
        setTracks(json.tracks ?? []);
        setStatus("done");
        // Years arrive a moment later; the list is usable before that.
        const missing = found.map((a) => a.deezerId).filter((x) => !(x in years));
        if (missing.length) {
          fetch(`/api/search/years?ids=${missing.join(",")}`)
            .then((r) => r.json())
            .then((y) => setYears((cur) => ({ ...cur, ...(y.years ?? {}) })))
            .catch(() => {});
        }
      } catch {
        if (id === reqId.current) setStatus("error");
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const empty = query.trim().length < 2;
  const none = status === "done" && !albums.length && !tracks.length;

  const modes: { value: SearchMode; label: string }[] = [
    { value: "log", label: "Log a listen" },
    { value: "before", label: "Add records you know" },
  ];
  const q = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";

  return (
    <div className="stack gap-28">
      <div className="stack gap-8">
        <div className="mode-switch" role="group" aria-label="What are you adding?">
          {modes.map((m) =>
            modeLinks ? (
              <Link key={m.value} href={m.value === "log" ? `/log${q ? `?${q.slice(1)}` : ""}` : `/log?mode=before${q}`} replace scroll={false} className="btn btn-sm pill" aria-pressed={mode === m.value} onClick={() => setMode(m.value)}>
                {m.label}
              </Link>
            ) : (
              <button key={m.value} type="button" className="btn btn-sm pill" aria-pressed={mode === m.value} onClick={() => setMode(m.value)}>
                {m.label}
              </button>
            )
          )}
        </div>
        {mode === "before" ? (
          <p className="muted small">Records you’ve heard over the years: search, tap the stars, next. No dates, no notes — they go under “Heard before” in your diary and help Discover learn your taste.</p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="search" className="muted small" style={{ fontWeight: 400 }}>Search albums, artists or tracks</label>
        <div className="search-box">
          <SearchIcon />
          <input
            id="search"
            type="search"
            autoFocus={autoFocus}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="e.g. and justice for all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="muted small" aria-live="polite" style={{ minHeight: 20 }}>
          {status === "loading" ? "Searching…" : status === "error" ? "Search is unavailable right now. Try again in a moment." : ""}
        </p>
      </div>

      {empty ? (
        <>
          <div className="stack gap-12">
            <p className="eyebrow">Try</p>
            <div className="row gap-8">
              {TRIES.map((t) => (
                <button key={t} type="button" className="btn" onClick={() => setQuery(t)}>{t}</button>
              ))}
            </div>
          </div>
          {children}
        </>
      ) : null}

      {albums.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Albums</h2>
          {albums.map((a) => {
            const year = a.year ?? years[a.deezerId] ?? null;
            if (mode === "before")
              return (
                <div key={a.deezerId} className="quick-result">
                  <img src={a.cover} alt="" width={64} height={64} className="cover cover-64" />
                  <span className="result-text">
                    <span style={{ fontSize: 17, fontWeight: 700 }}>{a.title}</span>
                    <span className="muted" style={{ fontSize: 14 }}>{a.artist}{year ? ` · ${year}` : ""}</span>
                    <QuickRate deezerId={a.deezerId} title={a.title} />
                  </span>
                </div>
              );
            return (
              <form key={a.deezerId} action={logFromDeezer}>
                <input type="hidden" name="deezer_id" value={a.deezerId} />
                <ResultButton>
                  <img src={a.cover} alt="" width={64} height={64} className="cover cover-64" />
                  <span className="result-text">
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{a.title}</span>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {a.artist} · {a.recordType === "single" ? "Single" : a.recordType === "ep" ? "EP" : "Album"}
                      {year ? ` · ${year}` : ""}
                    </span>
                  </span>
                  {a.editions > 1 ? <span className="chip">{a.editions} editions</span> : null}
                </ResultButton>
              </form>
            );
          })}
        </div>
      ) : null}

      {tracks.length && mode === "log" ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Tracks</h2>
          {tracks.map((t) => (
            <form key={t.deezerId} action={logFromDeezer}>
              <input type="hidden" name="deezer_id" value={t.albumDeezerId} />
              <ResultButton transparent>
                <img src={t.cover} alt="" width={44} height={44} className="cover cover-44" />
                <span className="result-text">
                  <span style={{ fontWeight: 700 }}>{t.title}</span>
                  <span className="muted" style={{ fontSize: 14 }}>{t.artist} · Track · from {t.albumTitle}</span>
                </span>
              </ResultButton>
            </form>
          ))}
        </div>
      ) : null}

      {none ? (
        <div className="card stack gap-8">
          <p style={{ fontWeight: 700 }}>No match for “{query.trim()}”</p>
          <p className="muted">Try the artist name, or fewer words from the title.</p>
        </div>
      ) : null}
    </div>
  );
}
