// Time-series line chart. points: [{ts, v}] (v may be Infinity => clipped to yMax).
export function LineChart({ points, now, spanSec, yMin, yMax, ticks, fmt, gapMs, band, height = 220, ariaLabel }) {
  const W = 1200, H = height, L = 76, B = 28, T = 14, Rm = 16;
  const span = spanSec * 1000;
  const x = (ts) => L + ((ts - (now - span)) / span) * (W - L - Rm);
  const clamp = (v) => Math.min(Math.max(Number.isFinite(v) ? v : yMax, yMin), yMax);
  const frac = (v) => (clamp(v) - yMin) / (yMax - yMin);
  const y = (v) => T + (1 - frac(v)) * (H - T - B);

  const segs = [];
  let cur = [];
  points.forEach((p, i) => {
    if (p.ts < now - span) return;
    if (cur.length && p.ts - cur[cur.length - 1].ts > gapMs) { segs.push(cur); cur = []; }
    cur.push(p);
  });
  if (cur.length) segs.push(cur);
  const last = points[points.length - 1];
  const marks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(spanSec * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img" aria-label={ariaLabel}>
      {band && <rect x={L} width={W - L - Rm} y={Math.min(y(band[0]), y(band[1]))} height={Math.abs(y(band[1]) - y(band[0]))} className="c-band" />}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - Rm} y1={y(v)} y2={y(v)} className="c-grid" />
          <text x={L - 8} y={y(v) + 4} className="c-label" textAnchor="end">{fmt(v)}</text>
        </g>
      ))}
      {marks.map((s) => (
        <text key={s} x={x(now - s * 1000)} y={H - 8} className="c-label" textAnchor={s === 0 ? "end" : s === spanSec ? "start" : "middle"}>
          {s === 0 ? "now" : s >= 60 ? `${+(s / 60).toFixed(1)} min ago` : `${s} s ago`}
        </text>
      ))}
      {segs.map((s, i) => (
        <polyline key={i} points={s.map((p) => `${x(p.ts)},${y(p.v)}`).join(" ")} className="c-line" />
      ))}
      {last && last.ts >= now - span && <circle cx={x(last.ts)} cy={y(last.v)} r={4.5} className="c-dot" />}
      {!points.length && <text x={W / 2} y={H / 2} textAnchor="middle" className="c-label">No readings yet</text>}
    </svg>
  );
}
