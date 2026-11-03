import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { buildIndex, challengeTitle, viewChallengeFor, type Challenge } from "@/lib/challenges";
import { summary, type List, type ListItem } from "@/lib/lists";
import { recordPath, shortDate, stars, todayIso, type Album } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { ListCard } from "@/app/lists/ListCard";

type Listen = { id: string; listened_on: string; rating: number | null; kind: string; note: string | null; format: string; created_at: string; album: Album };

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  return { title: `@${(await params).username}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { supabase, user } = await getUser();
  const { data: p } = await supabase.from("profiles").select("id, username, display_name, is_public, bio").eq("username", username.toLowerCase()).maybeSingle();
  const profile = p as { id: string; username: string; display_name: string | null; is_public: boolean; bio: string | null } | null;
  if (!profile) notFound();
  const me = profile.id === user!.id;
  const name = profile.display_name || profile.username;

  if (!profile.is_public && !me)
    return (
      <section className="stack gap-12 narrow" style={{ maxWidth: 560 }}>
        <p className="eyebrow">@{profile.username}</p>
        <h1 className="title-xl">{name}</h1>
        <p className="muted">This profile is private.</p>
      </section>
    );

  const [listensRes, chRes, listsRes] = await Promise.all([
    supabase.rpc("profile_listens", { p_username: profile.username, p_limit: 2000 }),
    supabase.rpc("profile_challenges", { p_username: profile.username }),
    supabase.from("lists").select("id, user_id, title, description, is_public, ranked, created_at, updated_at, items:list_items(position, album:albums(*))").eq("user_id", profile.id).eq("is_public", true).order("updated_at", { ascending: false }).limit(6),
  ]);
  const listens = (listensRes.data ?? []) as Listen[];
  const dated = listens.filter((l) => l.kind !== "before");
  const index = buildIndex(listens);
  const challenges = ((chRes.data ?? []) as Challenge[]).slice(0, 4);
  const views = await Promise.all(challenges.map((c) => viewChallengeFor(supabase, c, index)));
  const lists = ((listsRes.data ?? []) as unknown as (List & { items: ListItem[] })[]).map(summary);

  const year = todayIso().slice(0, 4);
  const thisYear = new Set(dated.filter((l) => l.listened_on.startsWith(year)).map((l) => l.album.id)).size;
  const albums = new Set(listens.map((l) => l.album.id)).size;
  // The month strip: the last 30 days, one cover per day.
  const since = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const byDay = new Map<string, Listen>();
  for (const l of dated) if (l.listened_on >= since && !byDay.has(l.listened_on)) byDay.set(l.listened_on, l);
  const recent = dated.slice(0, 10);

  return (
    <section className="stack gap-40 narrow" style={{ maxWidth: 720 }}>
      <div className="stack gap-8">
        <p className="eyebrow">@{profile.username}{me && !profile.is_public ? " · only you can see this" : ""}</p>
        <h1 className="title-xl">{name}</h1>
        {profile.bio ? <p style={{ fontSize: 18 }}>{profile.bio}</p> : null}
        <p className="mono small muted">{albums} albums in the diary · {thisYear} in {year}</p>
        {me ? <Link href="/settings" className="btn-text small" style={{ alignSelf: "flex-start", color: "var(--accent)" }}>{profile.is_public ? "Edit your profile" : "Make it public in Settings"} →</Link> : null}
      </div>

      {byDay.size ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">The last 30 days</h2>
          <div className="profile-strip">
            {[...byDay.values()].map((l) => (
              <Link key={l.id} href={recordPath(l.album)} title={`${l.album.title} · ${shortDate(l.listened_on)}`}><Cover album={l.album} size="64" /></Link>
            ))}
          </div>
        </div>
      ) : null}

      {views.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Working through</h2>
          {views.map((v) => (
            <div key={v.id} className="stack gap-4">
              <p className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                {v.kind === "user_list" ? <Link href={`/lists/${v.ref}`} className="link-button">{challengeTitle(v)}</Link> : <strong>{challengeTitle(v)}</strong>}
                <span className="mono small muted">{v.done}/{v.total}</span>
              </p>
              <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${v.total ? Math.round((v.done / v.total) * 100) : 0}%` }} /></div>
            </div>
          ))}
        </div>
      ) : null}

      {recent.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Lately</h2>
          <div className="stack gap-0">
            {recent.map((l) => (
              <Link key={l.id} href={recordPath(l.album)} className="profile-row">
                <Cover album={l.album} size="44" />
                <span className="stack gap-2" style={{ minWidth: 0, flex: 1 }}>
                  <span><strong>{l.album.title}</strong> <span className="muted">· {l.album.artist}</span></span>
                  {l.note ? <span className="small muted profile-note">“{l.note}”</span> : null}
                </span>
                <span className="stack" style={{ alignItems: "flex-end", flex: "0 0 auto" }}>
                  {l.rating ? <span className="stars small">{stars(l.rating)}</span> : null}
                  <span className="mono small muted">{shortDate(l.listened_on).replace(/ \d{4}$/, "")}{l.kind === "relisten" ? " · ↻" : ""}{l.format === "vinyl" ? " · vinyl" : ""}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {lists.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Lists</h2>
          {lists.map((l) => <ListCard key={l.id} list={l} />)}
        </div>
      ) : null}

      {!recent.length && !views.length && !lists.length ? <p className="muted">Nothing public here yet.</p> : null}
    </section>
  );
}
