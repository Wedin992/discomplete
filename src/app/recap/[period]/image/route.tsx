/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { getUser } from "@/lib/supabase/server";
import { getRecap } from "@/lib/recap";
import { cover } from "@/lib/format";

/** Stars drawn as shapes (the share-picture font has no ★). */
function Stars({ rating, size = 26 }: { rating: number; size?: number }) {
  const path = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z";
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rating >= n ? 1 : rating >= n - 0.5 ? 0.5 : 0;
        return (
          <div key={n} style={{ display: "flex", position: "relative", width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute" }}><path d={path} fill="#3a3a3e" /></svg>
            {fill ? (
              <div style={{ display: "flex", position: "absolute", width: size * fill, height: size, overflow: "hidden" }}>
                <svg width={size} height={size} viewBox="0 0 24 24"><path d={path} fill="#ff6a3d" /></svg>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** The recap as a 1080×1350 picture, made for sharing (Instagram, messages). */
export async function GET(_req: Request, { params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const { supabase, user } = await getUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const r = await getRecap(supabase, user.id, period);
  if (!r) return new Response("Not found", { status: 404 });
  const grid = r.best.slice(0, 6);
  const size = 300;
  const bits = [
    `${r.albums} ${r.albums === 1 ? "album" : "albums"}`,
    `${r.listens} ${r.listens === 1 ? "listen" : "listens"}`,
    r.hours ? `${r.hours} hours` : null,
  ].filter(Boolean).join(" · ");
  const extra = [r.topArtist && r.topArtist.plays > 1 ? `Most played: ${r.topArtist.name}` : null, r.vinylShare ? `${r.vinylShare}% on vinyl` : null].filter(Boolean).join("  ·  ");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#141414", color: "#f2efe9", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#ff6a3d", textTransform: "uppercase" }}>Discomplete</div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1, marginTop: 24, letterSpacing: -2 }}>{r.label}</div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 20, color: "#d9d5ce" }}>{bits}</div>
        {extra ? <div style={{ display: "flex", fontSize: 30, marginTop: 10, color: "#a3a09a" }}>{extra}</div> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 56, width: size * 3 + 48 }}>
          {grid.map((b) => (
            <div key={b.album.id} style={{ display: "flex", flexDirection: "column", width: size }}>
              {cover(b.album, "m") ? (
                <img src={cover(b.album, "xl") ?? cover(b.album, "m")!} width={size} height={size} style={{ borderRadius: 12, objectFit: "cover" }} alt="" />
              ) : (
                <div style={{ width: size, height: size, borderRadius: 12, background: "#2a2a2a" }} />
              )}
              <div style={{ display: "flex", marginTop: 12, height: 26 }}>{b.rating ? <Stars rating={b.rating} /> : null}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 28, color: "#a3a09a", justifyContent: "space-between" }}>
          <span>Listen to whole albums again</span>
          <span>discomplete.com</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
