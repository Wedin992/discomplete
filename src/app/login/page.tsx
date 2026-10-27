import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await getUser();
  if (user) redirect("/");
  const { error } = await searchParams;
  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 520 }}>
      <div>
        <p className="eyebrow">Your music diary</p>
        <h1 className="title-xl">Remember what you listened to</h1>
        <p className="muted" style={{ marginTop: 12, fontSize: 18 }}>
          Log a record in seconds, keep the lines that stuck, and come back to see how it changed for you.
        </p>
      </div>
      {error ? <p className="error" role="alert">That sign-in link didn’t work. It may have expired — try again.</p> : null}
      <LoginForm />
    </section>
  );
}
