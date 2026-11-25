// Self-check for the position solver: node src/lib/position.test.mjs
import assert from "node:assert/strict";
import { solvePosition } from "./position.js";

const rx = { A: { x: 0, y: 3 }, B: { x: 4, y: 3 }, C: { x: 2, y: 0 } };
const near = (rx, d) => ({ rx, fresh: true, d, dist: {} });
const far = (rx, floor) => ({ rx, fresh: true, d: Infinity, dist: { far: true, floor } });

// tag truly at (2, 4.5): A and B give distances, C only hears it weakly (at least 3 m away).
// A and B alone fit (2, 4.5) and its mirror (2, 1.5) equally; C's hint rules out the mirror.
const d = Math.hypot(2, 1.5);
const p = solvePosition([near("A", d), near("B", d), far("C", 3)], rx, 10, { w: 4, h: 6 });
assert.ok(p && Math.abs(p.x - 2) < 0.2 && Math.abs(p.y - 4.5) < 0.3, JSON.stringify(p));
// three good distances still land on the true point
const t = { x: 1, y: 2 }, dd = (k) => Math.hypot(t.x - rx[k].x, t.y - rx[k].y);
const q = solvePosition([near("A", dd("A")), near("B", dd("B")), near("C", dd("C"))], rx, 10, { w: 4, h: 6 });
assert.ok(Math.hypot(q.x - t.x, q.y - t.y) < 0.05, JSON.stringify(q));
// two distances and nothing else: still no position
assert.equal(solvePosition([near("A", d), near("B", d)], rx, 10, { w: 4, h: 6 }), null);
// one distance plus two far hints: not enough
assert.equal(solvePosition([near("A", 1), far("B", 4), far("C", 4)], rx, 10, { w: 4, h: 6 }), null);
// two mirror answers that fit equally (C's hint rules out neither): stay on the side the dot was on
const amb = [near("A", d), near("B", d), far("C", 1)];
for (const side of [1.5, 4.5]) {
  const r = solvePosition(amb, rx, 10, { w: 4, h: 6 }, 0.3, { x: 2, y: side });
  assert.ok(Math.abs(r.y - side) < 0.3, `expected y ${side}, got ${JSON.stringify(r)}`);
}
console.log("position solver: ok");
