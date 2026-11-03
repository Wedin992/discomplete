"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { PendingButton } from "@/components/PendingButton";
import type { SearchAlbum } from "@/lib/deezer";

type Option = { deezerId: number; title: string; artist: string; cover: string | null };

export type PickerOption = Option;

/** Choose an album: search, or one from your To listen. Then an optional line on why, and submit to `action`. */
export function AlbumPicker({ action, hidden, submitLabel, noteLabel = "Why this one? (optional)", notePlaceholder = "", queued }: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  submitLabel: string;
  noteLabel?: string;
  notePlaceholder?: string;
  queued: Option[];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchAlbum[]>([]);
  const [chosen, setChosen] = useState<Option | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const id = ++req.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { albums?: SearchAlbum[] };
        if (id === req.current) setHits((json.albums ?? []).slice(0, 6));
      } catch {
        if (id === req.current) setHits([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (chosen)
    return (
      <form action={action} className="stack gap-12">
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="deezer_id" value={chosen.deezerId} />
        <div className="row gap-12" style={{ alignItems: "center", flexWrap: "nowrap" }}>
          {chosen.cover ? <img src={chosen.cover} alt="" width={56} height={56} className="cover" style={{ width: 56, height: 56 }} /> : null}
          <span style={{ minWidth: 0 }}>
            <strong>{chosen.title}</strong>
            <span className="muted"> · {chosen.artist}</span>
          </span>
        </div>
        <label className="stack gap-4">
          <span className="small muted">{noteLabel}</span>
          <input name="note" className="input" maxLength={280} placeholder={notePlaceholder} />
        </label>
        <div className="row gap-12">
          <PendingButton className="btn btn-primary" pending="Saving…">{submitLabel}</PendingButton>
          <button type="button" className="btn-text" onClick={() => setChosen(null)}>Choose another</button>
        </div>
      </form>
    );

  const list: Option[] = query.trim().length >= 2 ? hits.map((h) => ({ deezerId: h.deezerId, title: h.title, artist: h.artist, cover: h.cover })) : queued;
  return (
    <div className="stack gap-12">
      <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for an album" aria-label="Search for an album" />
      {list.length ? (
        <>
          {query.trim().length < 2 ? <p className="eyebrow">From your To listen</p> : null}
          <ul className="stack gap-8" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {list.map((o) => (
              <li key={o.deezerId}>
                <button type="button" className="result" onClick={() => setChosen(o)}>
                  {o.cover ? <img src={o.cover} alt="" width={44} height={44} className="cover" style={{ width: 44, height: 44 }} /> : <span className="cover" style={{ width: 44, height: 44 }} />}
                  <span style={{ minWidth: 0, textAlign: "left", flex: 1 }}>
                    <strong>{o.title}</strong>
                    <span className="muted small" style={{ display: "block" }}>{o.artist}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
