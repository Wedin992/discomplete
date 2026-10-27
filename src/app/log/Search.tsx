"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ChevronIcon, SearchIcon } from "@/components/Icons";
import type { SearchAlbum, SearchTrack } from "@/lib/deezer";

const TRIES = ["and justice for all", "kent", "rumours"];

export function Search({ initialQuery, children }: { initialQuery: string; children?: React.ReactNode }) {
  const [query, setQuery] = useState(initialQuery);
  const [albums, setAlbums] = useState<SearchAlbum[]>([]);
  const [tracks, setTracks] = useState<SearchTrack[]>([]);
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
        setAlbums(json.albums ?? []);
        setTracks(json.tracks ?? []);
        setStatus("done");
      } catch {
        if (id === reqId.current) setStatus("error");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const empty = query.trim().length < 2;
  const none = status === "done" && !albums.length && !tracks.length;

  return (
    <div className="stack gap-28">
      <div className="field">
        <label htmlFor="search" className="muted small" style={{ fontWeight: 400 }}>Search albums, artists or tracks</label>
        <div className="search-box">
          <SearchIcon />
          <input
            id="search"
            type="search"
            autoFocus
            autoComplete="off"
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
          {albums.map((a) => (
            <a key={a.deezerId} href={`/open/${a.deezerId}`} className="result">
              <img src={a.cover} alt="" width={64} height={64} className="cover cover-64" />
              <span className="result-text">
                <span style={{ fontSize: 18, fontWeight: 700 }}>{a.title}</span>
                <span className="muted" style={{ fontSize: 14 }}>
                  {a.artist} · {a.recordType === "single" ? "Single" : a.recordType === "ep" ? "EP" : "Album"}
                  {a.year ? ` · ${a.year}` : ""}
                </span>
              </span>
              {a.editions > 1 ? <span className="chip">{a.editions} editions</span> : null}
              <ChevronIcon />
            </a>
          ))}
        </div>
      ) : null}

      {tracks.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Tracks</h2>
          {tracks.map((t) => (
            <a key={t.deezerId} href={`/open/${t.albumDeezerId}`} className="result" style={{ background: "transparent" }}>
              <img src={t.cover} alt="" width={44} height={44} className="cover cover-44" />
              <span className="result-text">
                <span style={{ fontWeight: 700 }}>{t.title}</span>
                <span className="muted" style={{ fontSize: 14 }}>{t.artist} · Track · from {t.albumTitle}</span>
              </span>
              <ChevronIcon />
            </a>
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
