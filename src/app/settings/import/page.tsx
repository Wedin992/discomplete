import type { Metadata } from "next";
import { Importer } from "./Importer";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 560 }}>
      <div>
        <p className="eyebrow">Settings</p>
        <h1 className="title-xl">Bring your records</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Import from Rate Your Music, or any spreadsheet saved as CSV with an “Artist” and an “Album” column. Optional columns: Rating, Date, Review.
        </p>
      </div>
      <div className="card stack gap-12">
        <h2 className="eyebrow">Rate Your Music</h2>
        <p className="muted small">On RYM, open your profile, scroll to the bottom and choose “Export your data”. Then pick that file here.</p>
      </div>
      <div className="card">
        <Importer />
      </div>
    </section>
  );
}
