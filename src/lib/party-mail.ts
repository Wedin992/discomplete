import { createClient } from "@supabase/supabase-js";
import { SITE, mailConfigured, partyMail, sendMail } from "@/lib/mail";

type Member = { club_id: string; club_name: string; user_id: string; email: string; name: string };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

/** "Kevin picked Hagnesta Hill for this week" to everyone else in the party. */
export async function mailNewPick(opts: { clubId: string; pickerId: string; title: string; artist: string; cover: string | null; note: string | null; week: "this" | "next" }) {
  if (!mailConfigured()) return;
  const { data, error } = await db().rpc("party_mail_list", { p_key: process.env.PARTY_MAIL_KEY, p_club: opts.clubId });
  if (error || !data) return;
  const members = data as Member[];
  const picker = members.find((m) => m.user_id === opts.pickerId)?.name ?? "Someone";
  const club = members[0]?.club_name ?? "your listening party";
  const when = opts.week === "next" ? "next week" : "this week";
  await Promise.all(
    members
      .filter((m) => m.user_id !== opts.pickerId)
      .map((m) => {
        const { html, text } = partyMail({
          heading: `${opts.title} — ${when} in ${club}`,
          lines: [`${picker} picked ${opts.title} by ${opts.artist} for ${when}.`, ...(opts.note ? [`“${opts.note}”`] : []), "Listen when it suits you, then log it to see what the others thought."],
          cover: opts.cover,
          button: "Open the party",
          href: `${SITE}/parties/${opts.clubId}`,
        });
        return sendMail(m.email, `${club}: ${opts.title} ${when}`, html, text);
      })
  );
}

/** Monday morning: this week's album in each party, or a nudge to pick one. */
export async function mailMondayDigest(week: string) {
  if (!mailConfigured()) return { sent: 0, skipped: "not configured" };
  const key = process.env.PARTY_MAIL_KEY;
  const [membersRes, picksRes] = await Promise.all([
    db().rpc("party_mail_list", { p_key: key, p_club: null }),
    db().rpc("party_week_picks", { p_key: key, p_week: week }),
  ]);
  if (membersRes.error || picksRes.error) return { sent: 0, skipped: membersRes.error?.message ?? picksRes.error?.message };
  const members = (membersRes.data ?? []) as Member[];
  const picks = new Map(((picksRes.data ?? []) as { club_id: string; title: string; artist: string; cover: string | null; note: string | null; picked_by: string }[]).map((p) => [p.club_id, p]));
  let sent = 0;
  for (const m of members) {
    const p = picks.get(m.club_id);
    const { html, text } = p
      ? partyMail({
          heading: `This week in ${m.club_name}: ${p.title}`,
          lines: [`${p.title} by ${p.artist}, picked by ${p.picked_by}.`, ...(p.note ? [`“${p.note}”`] : []), "Front to back, whenever suits you this week. Log it and the others’ stars and words unlock."],
          cover: p.cover,
          button: "Open the party",
          href: `${SITE}/parties/${m.club_id}`,
        })
      : partyMail({
          heading: `No album yet this week in ${m.club_name}`,
          lines: ["Be the one to pick — any album you think the others should hear."],
          button: "Pick this week’s album",
          href: `${SITE}/parties/${m.club_id}`,
        });
    if (await sendMail(m.email, p ? `${m.club_name}: ${p.title} this week` : `${m.club_name}: pick this week’s album`, html, text)) sent++;
  }
  return { sent };
}
