"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/actions";

export function ProfileForm({ username, displayName, isPublic, bio, profileReady }: { username: string; displayName: string; isPublic: boolean; bio: string; profileReady: boolean }) {
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
      {profileReady ? (
        <>
          <input type="hidden" name="profile_shown" value="1" />
          <div className="field">
            <label htmlFor="bio" className="label">A line about you</label>
            <input id="bio" name="bio" className="input" defaultValue={bio} maxLength={200} placeholder="Mostly metal, slowly working through jazz" />
          </div>
          <label className="row gap-8" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
            <input type="checkbox" name="is_public" defaultChecked={isPublic} style={{ marginTop: 4 }} />
            <span>
              <strong>Public profile</strong>
              <span className="muted small" style={{ display: "block" }}>Others can open discomplete.com/u/{username || "you"} and see your public listens, what you’re working through and your public lists. Private and anonymous listens never show.</span>
            </span>
          </label>
        </>
      ) : null}
      <div className="row gap-12">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <span aria-live="polite" className={state.error ? "error" : "muted"}>{state.error ?? (state.ok ? "Saved." : "")}</span>
      </div>
    </form>
  );
}
