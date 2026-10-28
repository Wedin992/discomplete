"use client";
import { useState } from "react";
import { openFromDeezer, swapPick } from "@/app/actions";
import { QuickRate } from "@/components/QuickRate";
import { PendingButton } from "@/components/PendingButton";

/** "Already heard it" on a Discover pick: rate it right here, then write about it or get a new pick. */
export function HeardIt({ deezerId, title, scope, slot, canSwap }: { deezerId: number; title: string; scope: string; slot: string; canSwap: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn-text small" style={{ minHeight: 40, alignSelf: "flex-start", textAlign: "left" }} onClick={() => setOpen(true)} aria-expanded={false}>
        Already heard it
      </button>
    );
  return (
    <div className="heard-it stack gap-8">
      <p className="small" style={{ fontWeight: 700 }}>What did you think?</p>
      <QuickRate deezerId={deezerId} title={title} compact />
      <div className="row gap-16">
        <form action={openFromDeezer}>
          <input type="hidden" name="deezer_id" value={deezerId} />
          <PendingButton className="btn-text small" style={{ minHeight: 36, color: "var(--accent)" }} pending="Opening…">Write about it →</PendingButton>
        </form>
        {canSwap ? (
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
