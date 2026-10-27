"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError("That code didn’t work. Check the latest email, or send a new one.");
      return;
    }
    // Full page load so the new session cookie is picked up everywhere at once.
    window.location.replace("/");
  }

  if (step === "code")
    return (
      <form onSubmit={verifyCode} className="stack gap-16">
        <div className="card highlight stack gap-4" role="status">
          <p style={{ fontWeight: 700 }}>Check your inbox</p>
          <p className="muted">We sent an email to {email}. Type the code from it here — or just tap the link in the email if you’re in your browser.</p>
        </div>
        <div className="field">
          <label htmlFor="code" className="label">Code from the email</label>
          <input
            id="code"
            className="input mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            style={{ fontSize: 24, letterSpacing: "0.3em", maxWidth: 260 }}
            autoFocus
          />
        </div>
        <div className="row gap-12">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || code.length < 6}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <button type="button" className="btn-text" onClick={() => { setStep("email"); setCode(""); setError(""); }}>
            Use a different email
          </button>
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </form>
    );

  return (
    <form onSubmit={sendEmail} className="stack gap-12">
      <div className="field">
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} style={{ alignSelf: "flex-start" }}>
        {busy ? "Sending…" : "Email me a sign-in code"}
      </button>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <p className="muted small">No password. New here? The same email creates your account.</p>
    </form>
  );
}
