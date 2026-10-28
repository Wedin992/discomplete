"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Asks the server to look for new album listens on Last.fm, then refreshes if it found any. */
export function LastfmSync() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/lastfm/sync", { method: "POST" })
      .then((r) => r.json())
      .then((r: { added?: number }) => {
        if (!cancelled && r.added) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
