// Shown instantly while the next page loads, so taps feel immediate.
export default function Loading() {
  return (
    <div className="stack gap-28" aria-busy="true" aria-label="Loading">
      <div className="stack gap-8">
        <span className="skeleton" style={{ width: 140, height: 12 }} />
        <span className="skeleton" style={{ width: "min(320px, 70%)", height: 44 }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card entry" style={{ padding: 16 }}>
          <span className="skeleton cover-76" />
          <div className="entry-body">
            <span className="skeleton" style={{ width: "55%", height: 18 }} />
            <span className="skeleton" style={{ width: "35%", height: 12 }} />
            <span className="skeleton" style={{ width: "90%", height: 14 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
