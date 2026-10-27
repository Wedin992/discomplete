"use client";

import { deleteEntry } from "@/app/actions";

export function DeleteEntryButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteEntry}
      onSubmit={(e) => {
        if (!window.confirm(`Delete this entry about ${title}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-text small" style={{ minHeight: 32 }} aria-label={`Delete this entry about ${title}`}>
        Delete
      </button>
    </form>
  );
}
