"use client";
import { useState, useTransition } from "react";
import { quickRate } from "@/app/actions";

const MESSAGES = { added: "Added to Heard before", updated: "Rating updated", logged: "Already in your diary", diary: "Logged — you played it on Spotify", error: "Couldn’t save — try again" } as const;

/** Five tap-to-rate stars that save a record as "heard before" right away. */
type Props = {
  deezerId: number;
  title: string;
  initial?: number;
  compact?: boolean;
  /** Save some other way than "heard before" (e.g. a Last.fm suggestion logged on its day). */
  onRate?: (rating: number) => Promise<{ status: keyof typeof MESSAGES }>;
  addedText?: string;
  idleText?: string;
};

export function QuickRate({ deezerId, title, initial = 0, compact = false, onRate, addedText, idleText }: Props) {
  const [rating, setRating] = useState(initial);
  const [status, setStatus] = useState<keyof typeof MESSAGES | null>(initial ? "added" : null);
  const [pending, start] = useTransition();

  const rate = (n: number) => {
    setRating(n);
    start(async () => {
      const res = onRate ? await onRate(n) : await quickRate(deezerId, n);
      setStatus(res.status);
      if (res.status === "error" || res.status === "logged") setRating(initial);
    });
  };

  return (
    <div className={`quick-rate${compact ? " compact" : ""}`} role="group" aria-label={`Rate ${title}`}>
      <div className="quick-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`quick-star${n <= rating ? " on" : ""}`}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            aria-pressed={n === rating}
            disabled={pending}
            onClick={() => rate(n)}
          >
            ★
          </button>
        ))}
      </div>
      <span className="mono quick-status" aria-live="polite">
        {pending ? "Saving…" : status ? (status === "added" || status === "updated" || status === "diary" ? `✓ ${status === "added" && addedText ? addedText : MESSAGES[status]}` : MESSAGES[status]) : idleText ?? (compact ? "I know this" : "Tap to rate")}
      </span>
    </div>
  );
}
