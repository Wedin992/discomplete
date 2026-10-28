/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { findAlbum } from "@/lib/deezer";
import { getTopAlbums } from "@/lib/lastfm";
import { QuickRate } from "@/components/QuickRate";

export const metadata: Metadata = { title: "Your most played albums" };

export default async function TopAlbumsPage() {
  const { supabase, user } = await getUser();
  const { data, error } = await supabase.from("lastfm_links").select("username").eq("user_id", user!.id).maybeSingle();
  if (error || !data) redirect("/settings#lastfm");
  return (
    <section className="stack gap-28 narrow">
      <div>
        <Link href="/settings#lastfm" className="btn-text small" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>← Settings</Link>
        <p className="eyebrow" style={{ marginTop: 8 }}>From Last.fm · all time</p>
        <h1 className="title-xl">Your most played albums</h1>
        <p className="muted" style={{ marginTop: 8 }}>Tap the stars on the ones you’d put on your shelf. They’re saved as “heard before” — no dates needed — and teach Discover your taste.</p>
      </div>
      <Suspense fallback={<p className="muted">Fetching your Last.fm history…</p>}>
        <TopList username={(data as { username: string }).username} />
      </Suspense>
    </section>
  );
}

async function TopList({ username }: { username: string }) {
  let top;
  try {
    top = await getTopAlbums(username, 30);
  } catch {
    return <p className="error">Last.fm didn’t answer. Try again in a moment.</p>;
  }
  const rows = (await Promise.all(top.map(async (t) => ({ t, hit: await findAlbum(t.artist, t.album).catch(() => null) })))).filter((r) => r.hit);
  if (!rows.length) return <p className="muted">No albums in your Last.fm history yet. Play a few on Spotify and come back.</p>;
  return (
    <div className="stack gap-12">
      {rows.map(({ t, hit }) => (
        <div key={hit!.deezerId} className="quick-result">
          <img src={hit!.cover} alt="" width={64} height={64} className="cover cover-64" />
          <span className="result-text">
            <span style={{ fontSize: 17, fontWeight: 700 }}>{hit!.title}</span>
            <span className="muted" style={{ fontSize: 14 }}>{hit!.artist} · {t.plays.toLocaleString("en-US")} plays</span>
            <QuickRate deezerId={hit!.deezerId} title={hit!.title} />
          </span>
        </div>
      ))}
    </div>
  );
}
