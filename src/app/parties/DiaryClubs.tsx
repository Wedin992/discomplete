import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { myClubs } from "@/lib/clubs";
import { ClubSummary } from "./ClubBits";

/** Diary: this week's album in each of your clubs (or a nudge to start one). */
export async function DiaryClubs() {
  const { supabase, user } = await getUser();
  const { clubs, ready } = await myClubs(supabase, user!.id);
  if (!ready) return null;
  if (!clubs.length)
    return (
      <Link href="/parties" className="card-dashed row gap-12" style={{ justifyContent: "space-between", textDecoration: "none", color: "inherit" }}>
        <span>
          <strong>New: Listening parties.</strong> <span className="muted">Pick an album with friends, listen this week, then see what everyone thought.</span>
        </span>
        <span style={{ color: "var(--accent)" }}>→</span>
      </Link>
    );
  return (
    <section className="stack gap-8" aria-label="Your listening parties">
      {clubs.map((c) => (
        <div key={c.id} className="card"><ClubSummary club={c} /></div>
      ))}
    </section>
  );
}
