"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search } from "@/app/log/Search";
import { Cover } from "@/components/Cover";
import { logPath, type Album } from "@/lib/format";

const OPEN_EVENT = "discomplete:log";

/** Opens the log search on top of the current page — no page load needed. */
export function openLogSheet() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function LogSheet() {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<Album[] | null>(null);
  const path = usePathname();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Close when the user lands on another page (e.g. the log form).
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  // "Recently logged", fetched straight from the database the first time the sheet opens.
  useEffect(() => {
    if (!open || recent) return;
    const supabase = createClient();
    supabase
      .from("entries")
      .select("album:albums(*)")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const seen = new Set<string>();
        const list: Album[] = [];
        for (const row of (data ?? []) as unknown as { album: Album | null }[]) {
          if (row.album && !seen.has(row.album.id)) {
            seen.add(row.album.id);
            list.push(row.album);
          }
          if (list.length === 4) break;
        }
        setRecent(list);
      });
  }, [open, recent]);

  if (!open) return null;

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="sheet-inner container">
        <div className="row gap-12" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <div>
            <p className="eyebrow">Log a listen</p>
            <h1 id="sheet-title" className="title-xl">What did you listen to?</h1>
          </div>
          <button type="button" className="sheet-close" onClick={close} aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <Search initialQuery="">
          {recent?.length ? (
            <div className="stack gap-12">
              <p className="eyebrow">Recently logged</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
                {recent.map((a) => (
                  <Link key={a.id} href={logPath(a)} className="tile" onClick={close}>
                    <Cover album={a} size="full" />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </Search>
      </div>
    </div>
  );
}
