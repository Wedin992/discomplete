import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="card stack gap-8">
        <h2 className="eyebrow">Your taste</h2>
        <p className="muted">The artists you love shape your picks in Discover.</p>
        <Link href="/welcome" className="btn" style={{ alignSelf: "flex-start" }}>Change artists and goals</Link>
      </div>
      <div className="card stack gap-8">
        <h2 className="eyebrow">Get the app</h2>
        <p><strong>iPhone:</strong> <span className="muted">open www.discomplete.com in Safari, tap Share, then “Add to Home Screen”.</span></p>
        <p><strong>Android:</strong> <span className="muted">open it in Chrome, tap the ⋮ menu, then “Install app”.</span></p>
        <p className="muted small">It opens full screen like any other app, and stays in sync with the web.</p>
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
