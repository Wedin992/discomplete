import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { createList } from "@/app/actions";
import { myLists } from "@/lib/lists";
import { PendingButton } from "@/components/PendingButton";
import { ListCard } from "./ListCard";

export const metadata: Metadata = { title: "Your lists" };

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, user } = await getUser();
  const { lists, ready } = await myLists(supabase, user!.id);
  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 640 }}>
      <div>
        <p className="eyebrow">Lists</p>
        <h1 className="title-xl">Your lists</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Gather albums with a line on why each one is there. Anyone you share a public list with can take it on as a challenge.
        </p>
      </div>
      {!ready ? <p className="error small">Lists aren’t switched on yet (database update 0018).</p> : error === "title" ? <p className="error small" role="alert">Give the list a name.</p> : null}
      <form action={createList} className="card row gap-12" style={{ alignItems: "center" }}>
        <input name="title" className="input" maxLength={100} required placeholder="Albums for a long drive" aria-label="List name" style={{ flex: "1 1 220px" }} />
        <PendingButton className="btn btn-primary" pending="Creating…">New list</PendingButton>
      </form>
      {lists.length ? (
        <div className="stack gap-8">
          {lists.map((l) => <ListCard key={l.id} list={l} />)}
        </div>
      ) : null}
    </section>
  );
}
