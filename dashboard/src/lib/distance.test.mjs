// Self-check for signal → distance: node src/lib/distance.test.mjs
import assert from "node:assert/strict";
import { approx, makeModel, signalOf, trimmedMean } from "./distance.js";

const cfg = { maxRange: 10, nearM: 0.3, spreadDb: 8 };
const near = (a, b) => Math.abs(a - b) < 0.01;

// three readings with one dropout: the dropout must not drag the average (it's the median)
assert.equal(trimmedMean([-73, -74, -95]), -74);
// eight readings: top and bottom two dropped
assert.equal(trimmedMean([-70, -71, -72, -73, -74, -75, -90, -50]), -72.5);

// between two saved points: straight line between them
const m = makeModel({ points: { m1: -60, m2: -70, m4: -76 } });
assert.ok(near(m.toM(-65), 1.5), m.toM(-65));
// weaker than the farthest point: continue the best-fit curve, never closer than that point
const past = m.toM(-82);
assert.ok(Number.isFinite(past) && past > 4, past);
assert.ok(m.toM(-90) > past, "weaker signal must read farther");
// too few points beyond 0.5 m for a fit: weaker than the last point is "beyond", at least that far
const few = makeModel({ points: { m0: -40, m1: -60 } });
const far = approx(-80, few, cfg);
assert.ok(far.far && far.floor === 1, JSON.stringify(far));
// radar range caps every estimate
assert.ok(approx(-95, m, { ...cfg, maxRange: 4 }).far);

// pairs recalibrated on firmware 1.2 read the average; older pairs keep the strongest packet
assert.equal(signalOf({ rssi: -70, avg: -74.2 }, "avg"), -74.2);
assert.equal(signalOf({ rssi: -70, avg: -74.2 }, "rssi"), -70);
assert.equal(signalOf({ rssi: -70 }, "avg"), -70); // old firmware: no avg yet
console.log("distance model: ok");
