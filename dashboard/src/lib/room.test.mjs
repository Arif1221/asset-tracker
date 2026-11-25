// Self-check for room geometry: node src/lib/room.test.mjs
import assert from "node:assert/strict";
import { wallSpan, doorSwing, clampBox, gridStep } from "./room.js";

const W = 5, H = 4;
// clamped to the wall: a 2 m door at 4.5 m on a 5 m wall slides back to 3 m
assert.deepEqual(wallSpan({ wall: "top", at: 4.5, len: 2 }, W, H).P, [3, 0]);
// right wall runs top to bottom at x = W, opening inward (-x)
const r = wallSpan({ wall: "right", at: 1, len: 1 }, W, H);
assert.deepEqual([r.P, r.u, r.n], [[5, 1], [0, 1], [-1, 0]]);
// door on top wall swings down into the room, clockwise on screen
const d = doorSwing({ wall: "top", at: 1, len: 0.9 }, W, H);
assert.deepEqual([d.end, d.open, d.sweep], [[1.9, 0], [1, 0.9], 1]);
// bottom and left walls turn the other way
assert.equal(doorSwing({ wall: "bottom", at: 1, len: 1 }, W, H).sweep, 0);
assert.equal(doorSwing({ wall: "left", at: 1, len: 1 }, W, H).sweep, 0);
assert.equal(doorSwing({ wall: "right", at: 1, len: 1 }, W, H).sweep, 1);
// a box never leaves the room
assert.deepEqual(clampBox({ x: 4.5, y: -1, w: 2, h: 1 }, W, H), { x: 3, y: 0, w: 2, h: 1 });
assert.equal(gridStep(5, 5), 1);
assert.equal(gridStep(30, 10), 5);
console.log("room geometry: ok");
