"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Pages seen in this visit to the app (the header stays mounted between pages, so this survives navigation).
let seen = 0;

const TOP = ["/", "/discover", "/to-listen", "/records", "/settings", "/log", "/welcome", "/login"];

/** Where "back" goes when there's no history to go back to (opened from a link, or a fresh app start). */
function parentOf(path: string) {
  if (/^\/record\/.+\/log$/.test(path)) return path.replace(/\/log$/, "");
  if (path.startsWith("/challenges/")) return "/challenges";
  if (path.startsWith("/parties/")) return "/parties";
  if (path.startsWith("/settings/") || path.startsWith("/lastfm")) return "/settings";
  return "/";
}

/** A back arrow in the header on every page below the main tabs — the app has no browser back button. */
export function BackButton() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    seen++;
  }, [path]);
  if (TOP.includes(path)) return null;
  const back = () => {
    // Came here from another page in the app: go back to it. Opened straight here: go to the page above.
    if (seen > 1 && window.history.length > 1) router.back();
    else router.push(parentOf(path));
  };
  return (
    <button type="button" className="back-btn" onClick={back} aria-label="Back">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="back-label">Back</span>
    </button>
  );
}
