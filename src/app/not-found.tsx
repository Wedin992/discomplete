import Link from "next/link";

export default function NotFound() {
  return (
    <section className="stack gap-16 narrow">
      <p className="eyebrow">404</p>
      <h1 className="title-xl">This record skipped</h1>
      <p className="muted">We couldn’t find that page.</p>
      <Link href="/" className="btn" style={{ alignSelf: "flex-start" }}>Back to your diary</Link>
    </section>
  );
}
