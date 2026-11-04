"use client";
import { useState } from "react";
import { logListenToday, openFromDeezer, quickRate, swapPick } from "@/app/actions";
import { QuickRate } from "@/components/QuickRate";
import { PendingButton } from "@/components/PendingButton";

/**
 * "I've listened to it" on a Discover pick: rate it right here (logged as today's listen), then write about it.
 * Knew it from before? One tap saves it as "Heard before" instead, and you can swap for a new pick.
 */
export function HeardIt({ deezerId, title, scope, slot, canSwap, save, notForMe }: {
  deezerId: number; title: string; scope: string; slot: string; canSwap: boolean;
  /** "+ To listen" (or "✓ In To listen"), shown first. */
  save?: React.ReactNode;
  /** "Not for me", tucked under ⋯. */
  notForMe?: React.ReactNode;
}) {
  const [open, setOpen] = useState<false | "today" | "before">(false);
  if (!open)
    return (
      <div className="row gap-8 pick-actions" style={{ alignItems: "center" }}>
        {save}
        <button type="button" className="btn btn-sm" onClick={() => setOpen("today")}>✓ Just listened</button>
        <details className="more-menu">
          <summary className="icon-btn" aria-label={`More for ${title}`}>⋯</summary>
          <div className="more-menu-list">
            <button type="button" className="btn-text small" onClick={() => setOpen("before")}>Heard it before</button>
            {notForMe}
          </div>
        </details>
      </div>
    );
  return (
    <div className="heard-it stack gap-8">
      <p className="small" style={{ fontWeight: 700 }}>{open === "today" ? "How was it?" : "What do you think of it?"}</p>
      <QuickRate
        deezerId={deezerId}
        title={title}
        compact
        onRate={open === "today" ? (n) => logListenToday(deezerId, n) : (n) => quickRate(deezerId, n)}
        idleText={open === "today" ? "Tap to log it as today’s listen" : "Tap to save it as Heard before"}
      />
      <div className="row gap-16">
        <form action={openFromDeezer}>
          <input type="hidden" name="deezer_id" value={deezerId} />
          <PendingButton className="btn-text small" style={{ minHeight: 36, color: "var(--accent)" }} pending="Opening…">Write about it →</PendingButton>
        </form>
        {open === "before" && canSwap ? (
          <form action={swapPick}>
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="slot" value={slot} />
            <input type="hidden" name="deezer_id" value={deezerId} />
            <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="Finding another…">Swap for a new pick</PendingButton>
          </form>
        ) : null}
        <button type="button" className="btn-text small" style={{ minHeight: 36 }} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
