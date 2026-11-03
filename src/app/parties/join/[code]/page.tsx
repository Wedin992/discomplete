import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { joinClub } from "@/app/actions";
import { PendingButton } from "@/components/PendingButton";

export const metadata: Metadata = { title: "Join a listening party" };

export default async function JoinClubPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { supabase } = await getUser();
  const { data } = await supabase.rpc("club_by_code", { p_code: code.toLowerCase() }).maybeSingle();
  const club = data as { id: string; name: string; members: number; is_member: boolean } | null;
  if (club?.is_member) redirect(`/parties/${club.id}`);

  return (
    <section className="stack gap-20 narrow" style={{ maxWidth: 520 }}>
      {club ? (
        <>
          <p className="eyebrow">You’re invited</p>
          <h1 className="title-xl">{club.name}</h1>
          <p className="muted">
            An album club with {club.members} {club.members === 1 ? "member" : "members"}. One album a week — listen in your own time, then see what everyone thought.
          </p>
          <form action={joinClub}>
            <input type="hidden" name="code" value={code} />
            <PendingButton className="btn btn-primary btn-lg" pending="Joining…">Join the party</PendingButton>
          </form>
        </>
      ) : (
        <>
          <h1 className="title-xl">That invite didn’t work</h1>
          <p className="muted">The link may be wrong, or the party no longer exists. Ask for a new one.</p>
          <Link href="/parties" className="btn" style={{ alignSelf: "flex-start" }}>Listening parties</Link>
        </>
      )}
    </section>
  );
}
