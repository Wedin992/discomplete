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
        <p className="eyebrow">Discomplete</p>
        <h1 className="title-xl">Listen to whole albums again</h1>
        <p className="muted" style={{ marginTop: 12, fontSize: 18 }}>
          Three albums to try every day. A diary of every one you finish. Challenges to work through, and an album a week with friends.
        </p>
      </div>
      {error ? <p className="error" role="alert">That sign-in link didn’t work. It may have expired — try again.</p> : null}
      <LoginForm />
    </section>
  );
}
