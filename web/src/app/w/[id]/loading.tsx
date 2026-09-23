export default function Loading() {
  return (
    <div aria-live="polite" aria-busy="true" className="loading-state">
      <span className="eyebrow">GETTING THE PICTURE</span>
      <h1>Loading your workspace…</h1>
      <div className="metric-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="panel skeleton" />
        ))}
      </div>
    </div>
  );
}
