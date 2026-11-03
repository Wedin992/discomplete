import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { leaveClub, logFromDeezer, removeClubPick } from "@/app/actions";
import { loadClub, mondayOf, pastPicks } from "@/lib/clubs";
import { cover, recordPath, shortDate, stars, todayIso } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { PendingButton } from "@/components/PendingButton";
import { CopyLink } from "@/components/CopyLink";
import { ClubPicker } from "../ClubPicker";
import { PickHeader } from "../ClubBits";

export const metadata: Metadata = { title: "Listening party" };

export default async function ClubPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; joined?: string; picked?: string; error?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  const { supabase, user } = await getUser();
  const club = await loadClub(supabase, id);
  if (!club) notFound();

  const week = mondayOf(todayIso());
  const thisWeekPicked = club.current?.week_start === week;
  const me = club.members.find((m) => m.is_me);
  const host = (await headers()).get("host") ?? "www.discomplete.com";
  const invite = `https://${host}/parties/join/${club.invite_code}`;

  // Albums from your To listen, to pick from quickly.
  const { data: q } = await supabase.from("to_listen").select("album:albums(deezer_id, title, artist, cover_small, cover_medium, cover_xl)").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5);
  const queued = ((q ?? []) as unknown as { album: { deezer_id: number | null; title: string; artist: string; cover_small: string | null; cover_medium: string | null; cover_xl: string | null } | null }[])
    .map((r) => r.album)
    .filter((a): a is NonNullable<typeof a> => !!a?.deezer_id)
    .map((a) => ({ deezerId: a.deezer_id!, title: a.title, artist: a.artist, cover: cover(a, "s") }));

  const past = club.current ? await pastPicks(supabase, club.id, club.current.week_start) : [];
  const canRemove = (pickedBy: string | null) => pickedBy === user!.id || club.created_by === user!.id;

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 720 }}>
      <div className="stack gap-8">
        <p className="eyebrow">Listening party · {club.members.length} {club.members.length === 1 ? "member" : "members"}</p>
        <h1 className="title-xl">{club.name}</h1>
        {flags.new ? <p className="small lfm-msg" role="status">Your party is ready. Pick the first album, then send the invite link below.</p> : null}
        {flags.joined ? <p className="small lfm-msg" role="status">You’re in! Here’s what the party is listening to.</p> : null}
        {flags.picked ? <p className="small lfm-msg" role="status">Picked. Everyone in the party sees it now.</p> : null}
        {flags.error === "taken" ? <p className="error small" role="alert">Someone picked an album for that week just before you.</p> : null}
      </div>

      {club.current ? (
        <div className="card stack gap-20">
          <PickHeader club={club} />
          {me?.listened ? (
            <p className="small" style={{ color: "var(--accent)", fontWeight: 700 }}>✓ You listened {shortDate(me.listened_on!)}{me.rating ? ` · ${stars(me.rating)}` : ""}</p>
          ) : (
            <div className="row gap-12">
              <form action={logFromDeezer}>
                <input type="hidden" name="deezer_id" value={club.current.album.deezer_id ?? ""} />
                <PendingButton className="btn btn-primary" pending="Opening…">I’ve listened — log it</PendingButton>
              </form>
              <Link href={recordPath(club.current.album)} className="btn">Open the record</Link>
            </div>
          )}

          <div className="stack gap-12">
            <h3 className="eyebrow">Who’s listening</h3>
            <ul className="stack gap-12" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {club.members.map((m) => (
                <li key={m.user_id} className="stack gap-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <p className="row gap-8" style={{ alignItems: "baseline" }}>
                    <strong>{m.is_me ? "You" : m.name}</strong>
                    {m.listened ? (
                      <span className="small" style={{ color: "var(--accent)" }}>✓ listened {shortDate(m.listened_on!)}</span>
                    ) : (
                      <span className="small muted">not yet</span>
                    )}
                    {m.listened && m.revealed && m.rating ? <span className="stars">{stars(m.rating)}</span> : null}
                  </p>
                  {m.listened && m.revealed && m.note ? <p style={{ whiteSpace: "pre-wrap" }}>{m.note}</p> : null}
                  {m.listened && !m.revealed && !m.is_me ? <p className="small muted">🔒 Stars and words show once you’ve heard it.</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {!thisWeekPicked ? (
        <div className="card stack gap-12">
          <h2 className="eyebrow">{club.current ? "Pick this week’s album" : "Pick the first album"}</h2>
          <p className="muted small">Anyone in the party can pick. Whole albums work best.</p>
          <ClubPicker clubId={club.id} week="this" queued={queued} />
        </div>
      ) : club.next ? (
        <div className="card stack gap-12">
          <h2 className="eyebrow">Next week</h2>
          <div className="row gap-12" style={{ alignItems: "center", flexWrap: "nowrap" }}>
            <Cover album={club.next.album} size="64" />
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong>{club.next.album.title}</strong> <span className="muted">· {club.next.album.artist}</span>
              {club.next.note ? <span className="small muted" style={{ display: "block", fontStyle: "italic" }}>“{club.next.note}”</span> : null}
            </span>
          </div>
          {canRemove(club.next.picked_by) ? (
            <form action={removeClubPick}>
              <input type="hidden" name="id" value={club.next.id} />
              <input type="hidden" name="club_id" value={club.id} />
              <PendingButton className="btn-text small muted" pending="Removing…">Remove this pick</PendingButton>
            </form>
          ) : null}
        </div>
      ) : (
        <details className="card stack gap-12">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Pick next week’s album</summary>
          <div style={{ marginTop: 12 }}>
            <ClubPicker clubId={club.id} week="next" queued={queued} />
          </div>
        </details>
      )}

      <div className="card stack gap-8">
        <h2 className="eyebrow">Invite friends</h2>
        <p className="muted small">Anyone with the link can join. They’ll need a Discomplete account (it’s free).</p>
        <CopyLink url={invite} />
      </div>

      {past.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Earlier weeks</h2>
          {past.map((p) => (
            <Link key={p.id} href={recordPath(p.album)} className="row gap-12" style={{ alignItems: "center", flexWrap: "nowrap", textDecoration: "none", color: "inherit" }}>
              <Cover album={p.album} size="44" />
              <span style={{ minWidth: 0 }}>
                <strong>{p.album.title}</strong> <span className="muted">· {p.album.artist}</span>
                <span className="mono small muted" style={{ display: "block" }}>Week of {shortDate(p.week_start)}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      <form action={leaveClub}>
        <input type="hidden" name="club_id" value={club.id} />
        <PendingButton className="btn-text small muted" pending="Leaving…">Leave this party</PendingButton>
      </form>
    </section>
  );
}
