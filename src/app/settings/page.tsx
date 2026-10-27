import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("profiles").select("username, display_name").eq("id", user!.id).maybeSingle();
  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 560 }}>
      <div>
        <p className="eyebrow">Account</p>
        <h1 className="title-xl">Settings</h1>
      </div>
      <div className="card stack gap-16">
        <h2 className="eyebrow">Public profile</h2>
        <p className="muted small">This is how your public notes are signed. Anonymous notes never show it.</p>
        <ProfileForm username={data?.username ?? ""} displayName={data?.display_name ?? ""} />
      </div>
      <div className="card stack gap-12">
        <h2 className="eyebrow">Signed in as</h2>
        <p>{user!.email}</p>
        <form action={signOut}>
          <button type="submit" className="btn">Sign out</button>
        </form>
      </div>
    </section>
  );
}
