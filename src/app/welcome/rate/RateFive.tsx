"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { quickRate } from "@/app/actions";
import { QuickRate } from "@/components/QuickRate";

type A = { deezerId: number; title: string; artist: string; cover: string };

/** A grid of albums to give stars to; counts up to five, then Discover opens. */
export function RateFive({ albums }: { albums: A[] }) {
  const [rated, setRated] = useState<Set<number>>(new Set());
  const n = rated.size;
  return (
    <div className="stack gap-24">
      <div className="rate-five-bar" role="status">
        <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
          <strong>{n >= 5 ? "That’s five — Discover is open" : `${n} of 5 you like`}</strong>
          <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${Math.min(100, n * 20)}%` }} /></div>
        </div>
        {n >= 5 ? (
          <Link href="/discover?welcome=1" className="btn btn-primary btn-sm">See my three →</Link>
        ) : (
          <Link href="/" className="btn-text small" style={{ minHeight: 36, display: "inline-flex", alignItems: "center" }}>Skip for now</Link>
        )}
      </div>
      <div className="rate-five-grid">
        {albums.map((a) => (
          <div key={a.deezerId} className="stack gap-4" style={{ minWidth: 0 }}>
            <img src={a.cover} alt="" className="cover cover-full" width={250} height={250} loading="lazy" />
            <strong className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</strong>
            <span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.artist}</span>
            <QuickRate
              deezerId={a.deezerId}
              title={a.title}
              compact
              idleText="Heard it? Rate it"
              onRate={async (r) => {
                const res = await quickRate(a.deezerId, r);
                if (res.status !== "error" && res.status !== "logged")
                  setRated((s) => {
                    const next = new Set(s);
                    // Discover opens on five records you like (3★ or more).
                    if (r >= 3) next.add(a.deezerId);
                    else next.delete(a.deezerId);
                    return next;
                  });
                return res;
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
