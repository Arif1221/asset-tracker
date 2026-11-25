/*
  Estimate a tag's (x, y) from its distance to at least 3 non-collinear receivers.
  One receiver gives only a circle; two receivers leave two possible sides. Keep the
  map honest by returning no point until the 2D geometry can resolve a location.
*/
const SWITCH = 0.7; // leave the answer near the last position only for one that fits at least 30% better

export function solvePosition(reads, rxPos, maxD, room, nearM = 0.3, prev = null) {
  const pts = reads
    .filter((r) => r.fresh && !r.dist?.far && Number.isFinite(r.d) && rxPos[r.rx])
    .map((r) => ({ rx: r.rx, x: rxPos[r.rx].x, y: rxPos[r.rx].y, d: Math.min(r.d, maxD) }));
  // A receiver that hears the tag only weakly still says "the tag is at least `floor` m from me".
  // With two real distances that picks the right side of the line between them.
  const far = reads
    .filter((r) => r.fresh && r.dist?.far && r.dist.floor > 0 && rxPos[r.rx])
    .map((r) => ({ rx: r.rx, x: rxPos[r.rx].x, y: rxPos[r.rx].y, floor: r.dist.floor }));
  if (pts.length < 2 || pts.length + far.length < 3) return null;

  const all = [...pts, ...far];
  const a = all[0];
  let area = 0;
  for (let i = 1; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      area = Math.max(area, Math.abs((all[i].x - a.x) * (all[j].y - a.y) - (all[i].y - a.y) * (all[j].x - a.x)) / 2);
    }
  }
  if (area < 0.05) return null;

  // RSSI distance error grows with distance: a "0.3 m" reading is far more trustworthy than a "2.4 m" one.
  // So each receiver counts 1 / d^2, and a lone "very near" receiver pins the tag to itself.
  const near = pts.filter((p) => p.d <= nearM);
  if (near.length === 1) {
    const n = near[0];
    return { x: n.x, y: n.y, err: Math.max(n.d, nearM / 2), used: pts, pinned: n.rx };
  }

  const wt = (p) => 1 / Math.max(p.d, 0.2) ** 2;
  let wx = 0, wy = 0, ws = 0;
  for (const p of pts) {
    const w = wt(p);
    wx += w * p.x; wy += w * p.y; ws += w;
  }
  // RSSI noise pushes estimates slightly past walls; accept up to 0.5 m outside, then clamp
  const TOL = 0.5;
  const outside = (x, y) => room && (x < -TOL || y < -TOL || x > room.w + TOL || y > room.h + TOL);
  const cost = (x, y) =>
    pts.reduce((c, p) => c + wt(p) * (Math.hypot(x - p.x, y - p.y) - p.d) ** 2, 0) +
    far.reduce((c, p) => c + Math.min(0, Math.hypot(x - p.x, y - p.y) - p.floor) ** 2 / p.floor ** 2, 0);
  const descend = (x, y) => {
    for (let i = 0; i < 300; i++) {
      let gx = 0, gy = 0;
      for (const p of pts) {
        const dx = x - p.x, dy = y - p.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const e = (dist - p.d) * wt(p);
        gx += (e * dx) / dist;
        gy += (e * dy) / dist;
      }
      for (const p of far) {
        const dx = x - p.x, dy = y - p.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        if (dist >= p.floor) continue; // one-sided: only push away while closer than the floor
        const e = (dist - p.floor) / p.floor ** 2;
        gx += (e * dx) / dist;
        gy += (e * dy) / dist;
      }
      x -= (0.5 * gx) / ws;
      y -= (0.5 * gy) / ws;
    }
    return { x, y, c: cost(x, y) + (outside(x, y) ? 1e6 : 0) };
  };
  // Two circles cross at two mirror points and a start on the line between them never leaves it,
  // so also start from points around the room and keep the best in-room fit.
  const starts = [[wx / ws, wy / ws]];
  if (prev) starts.push([prev.x, prev.y]);
  if (room) for (const fx of [0.25, 0.75]) for (const fy of [0.25, 0.75]) starts.push([room.w * fx, room.h * fy]);
  // Mirror-image answers often fit almost equally well; prefer the one near the last position
  // so the dot doesn't flip sides on every scan. It switches once the other side fits clearly better.
  const fits = starts.map(([sx, sy]) => descend(sx, sy));
  const best = fits.reduce((a, b) => (b.c < a.c ? b : a));
  const here = prev && fits.reduce((a, b) => (Math.hypot(b.x - prev.x, b.y - prev.y) < Math.hypot(a.x - prev.x, a.y - prev.y) ? b : a));
  let { x, y, c } = here && here.c < 1e6 && best.c > here.c * SWITCH ? here : best;
  if (c >= 1e6) return null;
  if (room) { x = Math.min(room.w, Math.max(0, x)); y = Math.min(room.h, Math.max(0, y)); }
  const err = Math.sqrt(pts.reduce((acc, p) => acc + wt(p) * (Math.hypot(x - p.x, y - p.y) - p.d) ** 2, 0) / ws);
  return { x, y, err, used: pts };
}

/* How far off a solved position could be (m). Drawn as the dashed circle on the map and
   used to decide whether a direction is meaningful. */
export const posRadius = (err, cfg) => Math.min(cfg.posMaxM, Math.max(cfg.posMinM, err + cfg.posPadM));

const DIRS = ["up", "up-right", "right", "down-right", "down", "down-left", "left", "up-left"];

/* Direction from a receiver to a solved tag position, in room-plan terms:
   0 deg = toward the top wall (y = 0), 90 deg = toward the right wall, clockwise.
   Not reliable when the tag is within the position's own error radius of the receiver. */
export function bearing(from, pos, cfg) {
  const dx = pos.x - from.x, dy = pos.y - from.y; // y grows downward
  const dist = Math.hypot(dx, dy);
  const r = posRadius(pos.err, cfg);
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const dir = DIRS[Math.round(deg / 45) % 8];
  if (dist <= r) return { dist, deg, dir, r, reliable: false };
  return { dist, deg, dir, r, reliable: true, half: (Math.asin(r / dist) * 180) / Math.PI };
}

/* Plain-language reason a tag has no 2D position (and so no direction), or null if it has one. */
export function whyNoPosition(tag, receivers, label, room) {
  if (!tag.fresh || tag.pos) return null;
  const online = receivers.filter((r) => r.online);
  if (online.length < 3) return `Direction needs 3 receivers online; ${online.length} ${online.length === 1 ? "is" : "are"} right now.`;
  const unplaced = online.filter((r) => !r.positioned);
  if (unplaced.length) return `Set where ${unplaced.map((r) => label(r.id)).join(", ")} ${unplaced.length > 1 ? "are" : "is"} in the room (not saved yet).`;
  const reads = tag.reads || [];
  const usable = reads.filter((r) => r.fresh && !r.dist?.far && Number.isFinite(r.d) && online.some((o) => o.id === r.rx));
  if (usable.length < 3) {
    const far = online.filter((o) => reads.some((r) => r.rx === o.id && r.fresh && r.dist?.far));
    const silent = online.filter((o) => !reads.some((r) => r.rx === o.id && r.fresh));
    const parts = [];
    if (far.length) parts.push(`${far.map((r) => label(r.id)).join(", ")} hear${far.length > 1 ? "" : "s"} it too weakly to measure a distance (capture calibration points at larger distances)`);
    if (silent.length) parts.push(`${silent.map((r) => label(r.id)).join(", ")} can't hear it`);
    return `Only ${usable.length} of ${online.length} receivers give a distance: ${parts.join("; ")}.`;
  }
  const pts = usable.map((r) => receivers.find((x) => x.id === r.rx));
  let area = 0;
  for (let i = 1; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    area = Math.max(area, Math.abs((pts[i].x - pts[0].x) * (pts[j].y - pts[0].y) - (pts[i].y - pts[0].y) * (pts[j].x - pts[0].x)) / 2);
  }
  if (area < 0.05) return "The receivers are in a straight line, so the side can't be told. Move one off the line.";
  return room ? `The estimate falls outside the ${room.W} × ${room.H} m room. Check the room size and receiver positions.` : "The estimate falls outside the room.";
}
