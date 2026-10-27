"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/actions";

export function ProfileForm({ username, displayName }: { username: string; displayName: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  return (
    <form action={action} className="stack gap-16">
      <div className="field">
        <label htmlFor="display_name" className="label">Name</label>
        <input id="display_name" name="display_name" className="input" defaultValue={displayName} maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="username" className="label">Username</label>
        <input id="username" name="username" className="input" defaultValue={username} required minLength={3} maxLength={24} pattern="[a-z0-9._]{3,24}" />
        <p className="muted small">Lowercase letters, numbers, dots and underscores.</p>
      </div>
      <div className="row gap-12">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <span aria-live="polite" className={state.error ? "error" : "muted"}>{state.error ?? (state.ok ? "Saved." : "")}</span>
      </div>
    </form>
  );
}
