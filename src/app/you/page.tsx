import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { monthName, todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "You" };

function Row({ href, title, sub }: { href: string; title: string; sub?: string }) {
  return (
    <Link href={href} className="flat-item you-row">
      <span className="stack" style={{ minWidth: 0 }}>
        <strong>{title}</strong>
        {sub ? <span className="small muted">{sub}</span> : null}
      </span>
      <span className="er-chevron" aria-hidden="true">›</span>
    </Link>
  );
}

/** You: your profile, your months in albums, your records and settings. */
export default async function YouPage() {
  const { supabase, user } = await getUser();
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const lastMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  const [{ data: p }, extraRes, countRes, collRes] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", user!.id).maybeSingle(),
    supabase.from("profiles").select("is_public, bio").eq("id", user!.id).maybeSingle(),
    supabase.from("entries").select("album_id", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("collection").select("vinyl, cd, wishlist").eq("user_id", user!.id),
  ]);
  const profile = p as { username: string; display_name: string | null } | null;
  const extra = extraRes.error ? null : (extraRes.data as { is_public: boolean; bio: string | null } | null);
  const coll = (collRes.data ?? []) as { vinyl: boolean; cd: boolean; wishlist: boolean }[];
  const vinyl = coll.filter((c) => c.vinyl).length;
  const cd = coll.filter((c) => c.cd).length;
  const name = profile?.display_name || profile?.username || "You";

  return (
    <section className="stack gap-40 narrow" style={{ maxWidth: 640 }}>
      <div className="stack gap-8">
        <p className="eyebrow">{profile?.username ? `@${profile.username}` : "You"}</p>
        <h1 className="title-xl">{name}</h1>
        {extra?.bio ? <p style={{ fontSize: 17 }}>{extra.bio}</p> : null}
        <p className="small muted">{(countRes.count ?? 0).toLocaleString("en-US")} listens in your diary</p>
      </div>

      <div className="stack gap-8">
        <h2 className="eyebrow">In albums</h2>
        <div className="flat-list">
          <Row href={`/recap/${thisMonth}`} title={`${monthName(`${thisMonth}-01`)} so far`} sub="Your numbers, best records and a picture to share" />
          <Row href={`/recap/${lastMonth}`} title={monthName(`${lastMonth}-01`)} />
          <Row href={`/recap/${today.slice(0, 4)}`} title={`All of ${today.slice(0, 4)}`} />
        </div>
      </div>

      <div className="stack gap-8">
        <h2 className="eyebrow">Yours</h2>
        <div className="flat-list">
          {profile?.username ? (
            <Row href={`/u/${profile.username}`} title="Your profile" sub={extra?.is_public ? "Public — anyone with the link can see it" : "Private — only you can see it. Switch it on in Settings"} />
          ) : null}
          <Row href="/records" title="Collection" sub={vinyl || cd ? `${vinyl} on vinyl · ${cd} on CD · wishlist · heard before` : "Your vinyl, CDs, wishlist and records you knew before"} />
          <Row href="/settings" title="Settings" sub="Profile, Spotify via Last.fm, your data, the app" />
        </div>
      </div>
    </section>
  );
}
