import type { getUser } from "@/lib/supabase/server";
import { todayIso, type Album } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];

/** The Monday of the week a day belongs to (YYYY-MM-DD). */
export function mondayOf(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type Club = { id: string; name: string; invite_code: string; created_by: string };
export type ClubPick = { id: string; week_start: string; note: string | null; picked_by: string | null; album: Album };
export type Member = {
  user_id: string; name: string; is_me: boolean; listened: boolean; listened_on: string | null;
  rating: number | null; note: string | null; revealed: boolean;
};
export type ClubView = Club & { current: ClubPick | null; next: ClubPick | null; members: Member[] };

const PICK = "id, week_start, note, picked_by, album:albums(*)";

/** All your clubs, each with this week's album and who has listened. `ready` is false before migration 0017. */
export async function myClubs(supabase: Supabase, userId: string): Promise<{ clubs: ClubView[]; ready: boolean }> {
  const { data: rows, error } = await supabase.from("club_members").select("club:clubs(id, name, invite_code, created_by)").eq("user_id", userId);
  if (error) return { clubs: [], ready: false };
  const clubs = ((rows ?? []) as unknown as { club: Club | null }[]).map((r) => r.club).filter(Boolean) as Club[];
  const views = await Promise.all(clubs.map((c) => viewClub(supabase, c)));
  return { clubs: views, ready: true };
}

export async function loadClub(supabase: Supabase, id: string): Promise<ClubView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from("clubs").select("id, name, invite_code, created_by").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return viewClub(supabase, data as Club);
}

async function viewClub(supabase: Supabase, club: Club): Promise<ClubView> {
  const week = mondayOf(todayIso());
  const { data } = await supabase.from("club_picks").select(PICK).eq("club_id", club.id).lte("week_start", addDays(week, 7)).order("week_start", { ascending: false }).limit(3);
  const picks = (data ?? []) as unknown as ClubPick[];
  const next = picks.find((p) => p.week_start > week) ?? null;
  const current = picks.find((p) => p.week_start <= week) ?? null;
  let members: Member[] = [];
  if (current) {
    const { data: m } = await supabase.rpc("club_week", { p_club: club.id, p_album: current.album.id, p_since: current.week_start });
    members = (m ?? []) as Member[];
  } else {
    const { data: m } = await supabase.rpc("club_week", { p_club: club.id, p_album: "00000000-0000-0000-0000-000000000000", p_since: week });
    members = (m ?? []) as Member[];
  }
  return { ...club, current, next, members };
}

/** Earlier weeks, newest first. */
export async function pastPicks(supabase: Supabase, clubId: string, before: string) {
  const { data } = await supabase.from("club_picks").select(PICK).eq("club_id", clubId).lt("week_start", before).order("week_start", { ascending: false }).limit(12);
  return (data ?? []) as unknown as ClubPick[];
}
