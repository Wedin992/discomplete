"use client";

import { useState } from "react";

/** A link with a Copy button (and the phone's share sheet when there is one). */
export function CopyLink({ url, title = "Join my listening party on Discomplete" }: { url: string; title?: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url, title });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      /* cancelled */
    }
  }
  return (
    <div className="row gap-8" style={{ alignItems: "center", flexWrap: "nowrap" }}>
      <input className="input mono" readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 13, minWidth: 0, flex: 1 }} />
      <button type="button" className="btn" onClick={share}>{done ? "✓ Copied" : "Share"}</button>
    </div>
  );
}
