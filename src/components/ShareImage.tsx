"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

/** A preview of a share picture, with Share (the phone's share sheet) and Download. */
export function ShareImage({ src, filename, title }: { src: string; filename: string; title: string }) {
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const blob = await fetch(src).then((r) => r.blob());
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      }
    } catch {
      /* cancelled */
    }
    setBusy(false);
  }
  return (
    <div className="stack gap-12">
      <img src={src} alt={`Share picture: ${title}`} style={{ width: "100%", maxWidth: 320, borderRadius: 12, border: "1px solid var(--line)" }} />
      <div className="row gap-8">
        <button type="button" className="btn btn-primary" onClick={share} disabled={busy}>{busy ? "Getting it ready…" : "Share"}</button>
        <a href={src} download={filename} className="btn">Download</a>
      </div>
    </div>
  );
}
