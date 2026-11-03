import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { createClub, joinClub } from "@/app/actions";
import { myClubs } from "@/lib/clubs";
import { PendingButton } from "@/components/PendingButton";
import { ClubSummary } from "./ClubBits";

export const metadata: Metadata = { title: "Listening parties" };

const ERRORS: Record<string, string> = {
  name: "Give the party a name.",
  code: "That invite code didn’t work. Check the link and try again.",
  setup: "Listening parties aren’t switched on yet (database update 0017).",
};

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, user } = await getUser();
  const { clubs, ready } = await myClubs(supabase, user!.id);

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 640 }}>
      <div>
        <p className="eyebrow">Listen together</p>
        <h1 className="title-xl">Listening parties</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          One album a week, front to back. Everyone listens in their own time, and you see what the others thought once you’ve heard it yourself.
        </p>
      </div>
      {!ready ? <p className="error small">{ERRORS.setup}</p> : error ? <p className="error small" role="alert">{ERRORS[error] ?? ERRORS.setup}</p> : null}

      {clubs.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">Your parties · {clubs.length}</h2>
          {clubs.map((c) => (
            <div key={c.id} className="card"><ClubSummary club={c} /></div>
          ))}
        </div>
      ) : null}

      <div className="card stack gap-12">
        <h2 className="eyebrow">Start a party</h2>
        <p className="muted small">Name it, then send the invite link to a few friends.</p>
        <form action={createClub} className="row gap-12" style={{ alignItems: "center" }}>
          <input name="name" className="input" maxLength={60} required placeholder="Sunday spins" aria-label="Party name" style={{ flex: "1 1 220px" }} />
          <PendingButton className="btn btn-primary" pending="Starting…">Start it</PendingButton>
        </form>
      </div>

      <div className="card stack gap-12">
        <h2 className="eyebrow">Got an invite?</h2>
        <form action={joinClub} className="row gap-12" style={{ alignItems: "center" }}>
          <input name="code" className="input" required placeholder="Paste the link or code" aria-label="Invite link or code" style={{ flex: "1 1 220px" }} />
          <PendingButton className="btn" pending="Joining…">Join</PendingButton>
        </form>
      </div>
    </section>
  );
}
