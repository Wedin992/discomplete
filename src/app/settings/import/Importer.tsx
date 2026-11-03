"use client";

import { useState } from "react";
import { importRows, type ImportResult, type ImportRow } from "@/app/actions";

/** Minimal CSV parser: quotes, escaped quotes, commas/semicolons, CRLF. */
function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const firstLine = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/** Turns a Rate Your Music export, or any CSV with artist + album columns, into rows to import. */
function toRows(table: string[][]): { rows: ImportRow[]; kind: "rym" | "csv" } | null {
  if (table.length < 2) return null;
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  // Rate Your Music: "RYM Album, First Name, Last Name, …, Title, Release_Date, Rating, Ownership, Purchase Date, Media Type, Review"
  if (head.includes("rym album")) {
    const fn = col("first name"), ln = col("last name"), ti = col("title"), ra = col("rating"), ow = col("ownership"), me = col("media type"), re = col("review");
    const rows = table.slice(1).map((r) => {
      const media = (r[me] ?? "").toLowerCase();
      const owned = (r[ow] ?? "").trim().toLowerCase();
      return {
        artist: decode(`${r[fn] ?? ""} ${r[ln] ?? ""}`),
        title: decode(r[ti] ?? ""),
        rating: Number(r[ra]) > 0 ? Number(r[ra]) / 2 : null,
        note: decode(r[re] ?? "") || null,
        own: owned === "w" ? "wishlist" : owned === "o" && media.includes("vinyl") ? "vinyl" : owned === "o" && media.includes("cd") ? "cd" : null,
      } as ImportRow;
    });
    return { rows: rows.filter((r) => r.artist && r.title), kind: "rym" };
  }
  const ar = col("artist", "artist name", "artists"), ti = col("album", "title", "album title", "release", "name");
  if (ar < 0 || ti < 0) return null;
  const ra = col("rating", "stars", "score"), da = col("date", "listened", "listened on", "watched date", "logged"), no = col("note", "review", "notes", "comment");
  const ratings = table.slice(1).map((r) => Number(r[ra])).filter((n) => n > 0);
  const tenScale = ratings.some((n) => n > 5);
  const rows = table.slice(1).map((r) => ({
    artist: decode(r[ar] ?? ""),
    title: decode(r[ti] ?? ""),
    rating: ra >= 0 && Number(r[ra]) > 0 ? (tenScale ? Number(r[ra]) / 2 : Number(r[ra])) : null,
    date: da >= 0 ? (r[da] ?? "").trim().slice(0, 10) || null : null,
    note: no >= 0 ? decode(r[no] ?? "") || null : null,
  }));
  return { rows: rows.filter((r) => r.artist && r.title), kind: "csv" };
}

export function Importer() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [kind, setKind] = useState<"rym" | "csv">("csv");
  const [error, setError] = useState<string | null>(null);
  const [privateNotes, setPrivateNotes] = useState(true);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  async function onFile(file: File | undefined) {
    setError(null); setRows(null); setResults([]); setDone(false);
    if (!file) return;
    const parsed = toRows(parseCsv(await file.text()));
    if (!parsed || !parsed.rows.length) {
      setError("We couldn’t read that file. It needs a header row with “Artist” and “Album” (or a Rate Your Music export).");
      return;
    }
    setRows(parsed.rows.slice(0, 5000));
    setKind(parsed.kind);
  }

  async function run() {
    if (!rows) return;
    setRunning(true);
    const out: ImportResult[] = [];
    for (let i = 0; i < rows.length; i += 15) {
      try {
        out.push(...(await importRows(rows.slice(i, i + 15), privateNotes)));
      } catch {
        out.push(...rows.slice(i, i + 15).map(() => "error" as const));
      }
      setResults([...out]);
    }
    setRunning(false);
    setDone(true);
  }

  const n = (r: ImportResult) => results.filter((x) => x === r).length;
  const missed = rows ? rows.filter((_, i) => results[i] === "notfound" || results[i] === "error") : [];

  return (
    <div className="stack gap-16">
      <label className="stack gap-8">
        <span className="small muted">Choose a CSV file</span>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} disabled={running} />
      </label>
      {error ? <p className="error small" role="alert">{error}</p> : null}
      {rows && !done ? (
        <div className="stack gap-12">
          <p>
            <strong>{rows.length} {rows.length === 1 ? "record" : "records"}</strong>{" "}
            <span className="muted">found{kind === "rym" ? " in your Rate Your Music export" : ""}.</span>
          </p>
          <p className="muted small">
            Records with a date become dated listens. The rest are saved as “Heard before”, with your stars. Records already in your diary are skipped.
            {kind === "rym" ? " Owned vinyl and CDs go to your collection, wishlist items to your wishlist." : ""}
          </p>
          <label className="row gap-8" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={privateNotes} onChange={(e) => setPrivateNotes(e.target.checked)} disabled={running} />
            <span>Keep imported reviews private</span>
          </label>
          <button type="button" className="btn btn-primary" onClick={run} disabled={running} style={{ alignSelf: "flex-start" }}>
            {running ? `Importing… ${results.length} of ${rows.length}` : `Import ${rows.length}`}
          </button>
          {running ? <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${Math.round((results.length / rows.length) * 100)}%` }} /></div> : null}
        </div>
      ) : null}
      {done ? (
        <div className="stack gap-8" role="status">
          <p className="lfm-msg">Done. {n("added")} added{n("exists") ? ` · ${n("exists")} already in your diary` : ""}{missed.length ? ` · ${missed.length} not found` : ""}.</p>
          {missed.length ? (
            <details>
              <summary className="small" style={{ cursor: "pointer" }}>Show the ones we couldn’t find</summary>
              <ul className="small muted" style={{ marginTop: 8 }}>
                {missed.slice(0, 200).map((r, i) => <li key={i}>{r.artist} – {r.title}</li>)}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
