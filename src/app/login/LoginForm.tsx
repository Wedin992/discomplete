"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  if (state === "sent")
    return (
      <div className="card highlight" role="status">
        <p style={{ fontWeight: 700 }}>Check your inbox</p>
        <p className="muted">We sent a sign-in link to {email}. Open it on this device.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="stack gap-12">
      <div className="field">
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <button type="submit" className="btn btn-primary btn-lg" disabled={state === "sending"} style={{ alignSelf: "flex-start" }}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" ? <p className="error" role="alert">{message}</p> : null}
      <p className="muted small">No password. New here? The same link creates your account.</p>
    </form>
  );
}
