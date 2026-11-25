import { DEFAULT_CAL } from "../config.js";

export const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// Mean after dropping the top and bottom quarter: as robust to BLE fades as a median,
// but it moves in fractions of a dB instead of jumping a whole step at a time
export const trimmedMean = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const k = s.length >= 3 ? Math.max(1, Math.floor(s.length / 4)) : 0; // 3 readings: the median
  const kept = s.slice(k, s.length - k);
  return kept.reduce((x, y) => x + y, 0) / kept.length;
};

// Which number from a live reading a pair's calibration was captured with. Receiver firmware 1.2+
// also sends `avg` (mean of the second's packets); a pair uses it once it's recalibrated on that firmware.
export const signalOf = (r, measure) => (measure === "avg" && typeof r?.avg === "number" ? r.avg : r?.rssi);

// Pair-specific calibration points live at /calibration/{rx}/tags/{tag}/points/...
export const pointKey = (d) => `m${String(d).replace(".", "_")}`;
const keyToD = (k) => parseFloat(k.slice(1).replace("_", "."));
// Older points were saved as a bare number; newer ones as {rssi, samples, at}
const pointRssi = (v) => (typeof v === "number" ? v : typeof v?.rssi === "number" ? v.rssi : null);

export function readPoints(raw) {
  return Object.entries(raw?.points || {})
    .map(([k, v]) => ({ d: keyToD(k), r: pointRssi(v), samples: v?.samples, at: v?.at }))
    .filter((p) => p.r !== null && Number.isFinite(p.d))
    .sort((a, b) => a.d - b.d);
}

// Least-squares fit of rssi = tx - 10 n log10(d), using points at d >= 0.5 m
export function fitFormula(points) {
  const pts = points.filter((p) => p.d >= 0.5);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => Math.log10(p.d));
  const ys = pts.map((p) => p.r);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const tx = my - slope * mx;
  const n = -slope / 10;
  const err = Math.sqrt(pts.reduce((a, p) => a + (p.r - (tx - 10 * n * Math.log10(p.d))) ** 2, 0) / pts.length);
  return { tx: +tx.toFixed(1), n: +n.toFixed(2), err: +err.toFixed(1) };
}

/* Distance model for one tag/receiver pair.
   mode "table"   (default with ≥2 points): piecewise-linear between captured points.
   mode "formula" (or <2 points):          d = 10^((tx - rssi) / (10 n)).            */
export function makeModel(raw) {
  const pts = readPoints(raw);
  const tx = raw?.tx ?? DEFAULT_CAL.tx;
  const n = raw?.n ?? DEFAULT_CAL.n;
  const wantTable = (raw?.mode ?? "table") === "table";

  if (wantTable && pts.length >= 2) {
    let min = Infinity;
    const bad = [];
    const mono = pts.map((p, i) => {
      if (i > 0 && p.r >= min) bad.push(`${pts[i - 1].d}–${p.d} m`);
      min = Math.min(min, p.r);
      return { d: p.d, r: min };
    });
    const last = mono[mono.length - 1];
    const f = fitFormula(pts);
    const fit = f && f.n > 0 ? f : null; // a bad fit (signal rising with distance) can't extrapolate
    const toM = (rssi) => {
      if (rssi >= mono[0].r) return mono[0].d;
      for (let i = 1; i < mono.length; i++) {
        const a = mono[i - 1], b = mono[i];
        if (rssi >= b.r) return a.r === b.r ? (a.d + b.d) / 2 : a.d + ((a.r - rssi) / (a.r - b.r)) * (b.d - a.d);
      }
      // weaker than the farthest captured point: continue the best-fit curve instead of giving up
      return fit ? Math.max(last.d, Math.pow(10, (fit.tx - rssi) / (10 * fit.n))) : Infinity;
    };
    return { kind: "table", toM, pts, bad, maxD: fit ? Infinity : last.d, tx, n };
  }
  return { kind: "formula", toM: (r) => Math.pow(10, (tx - r) / (10 * n)), pts, bad: [], maxD: Infinity, tx, n };
}

// Distance with an honest "likely" range
export function approx(rssi, model, cfg) {
  const limit = Math.min(cfg.maxRange, model.maxD);
  const d = model.toM(rssi);
  if (!Number.isFinite(d) || d > limit) {
    // floor: the farthest distance we actually measured, so "far" safely means at least this far
    const floor = Math.min(limit, model.pts.length ? model.pts[model.pts.length - 1].d : limit);
    return { d: Infinity, far: true, limit, floor, text: `Beyond ${limit} m`, short: `>${limit} m` };
  }
  if (d < cfg.nearM) return { d, near: true, text: `Under ${cfg.nearM} m`, short: `<${cfg.nearM} m` };
  const lo = model.toM(rssi + cfg.spreadDb);
  const hiRaw = model.toM(rssi - cfg.spreadDb);
  const hi = Number.isFinite(hiRaw) ? Math.min(hiRaw, limit) : limit;
  return { d, text: `${d.toFixed(1)} m`, short: `${d.toFixed(1)} m`, range: `${lo.toFixed(1)}–${hi.toFixed(1)} m` };
}
