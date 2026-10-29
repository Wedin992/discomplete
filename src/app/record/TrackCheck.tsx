"use client";
import { useState, useTransition } from "react";
import { markTrack } from "@/app/actions";

/** A track's check: tap to mark it played yourself (or unmark your own mark). Scrobbled ones stay checked. */
export function TrackCheck({ deezerId, track, title, scrobbled, marked }: { deezerId: number; track: string; title: string; scrobbled: boolean; marked: boolean }) {
  const [on, setOn] = useState(marked);
  const [pending, start] = useTransition();
  if (scrobbled) return <span className="tl-toggle on" role="img" aria-label="Played (from Last.fm)" style={{ cursor: "default" }}>✓</span>;
  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await markTrack(deezerId, track, next);
      if (!res.ok) setOn(!next);
    });
  };
  return (
    <button
      type="button"
      className={`tl-toggle${on ? " on" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Unmark ${title}` : `Mark ${title} as played`}
      disabled={pending}
      onClick={toggle}
    >
      {on ? "✓" : ""}
    </button>
  );
}
