import { useEffect, useMemo, useRef, useState } from "react";
import { useDb } from "../lib/db";
import { DEFAULTS } from "../config";
import { approx, makeModel, signalOf, trimmedMean } from "../lib/distance";
import { solvePosition } from "../lib/position";

/*
  All live state of the system, derived in one place:
  - raw Firebase data (live readings, devices, receivers, layout, calibration, settings)
  - smoothed RSSI per receiver+tag (trimmed mean of last N)
  - receivers with online status, tags with zone / distance / status
  - per-tag history (distance + RSSI) and an activity log, kept in the browser
*/
export function useTracker() {
  const live = useDb("live");
  const devices = useDb("devices");
  const heartbeats = useDb("receivers");
  const layout = useDb("layout");
  const calibration = useDb("calibration");
  const room = useDb("settings/room", { w: 5, h: 5 });
  const appSettings = useDb("settings/app");
  const offset = useDb(".info/serverTimeOffset", 0);
  const connected = useDb(".info/connected", false);

  const cfg = useMemo(() => ({ ...DEFAULTS, ...appSettings }), [appSettings]);
  const smoothN = Math.max(1, Math.round(cfg.smoothN));
  const lostMs = cfg.lostSec * 1000;
  const tie = (d) => Math.max(cfg.tieAbsM, (d * cfg.tiePct) / 100); // two receivers this close count as a tie

  // ---- server-synced clock (ticks twice a second) ----
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const serverNow = now + (typeof offset === "number" ? offset : 0);

  const label = (id) => devices[id]?.label || id;
  const zoneLabel = (id) => devices[id]?.zoneLabel || `Zone ${label(id)}`;
  const isNamed = (id) => !!devices[id]?.label;

  // ---- distance model per tag + receiver ----
  // The pair's own calibration, falling back to the receiver's older shared profile for
  // pairs not measured yet. New captures are always pair-specific.
  const buildModel = (rx, tag) => {
    const legacy = calibration[rx] || {};
    const pair = calibration[rx]?.tags?.[tag] || {};
    return makeModel({ ...legacy, ...pair, mode: pair.mode ?? (pair.points ? "table" : legacy.mode) });
  };
  const models = useMemo(() => {
    const m = {};
    for (const rx of new Set([...Object.keys(live), ...Object.keys(calibration), ...Object.keys(heartbeats)])) {
      const tagIds = new Set([
        ...Object.keys(live[rx] || {}),
        ...Object.keys(calibration[rx]?.tags || {}),
      ]);
      for (const tag of tagIds) m[`${rx}|${tag}`] = buildModel(rx, tag);
    }
    return m;
  }, [live, calibration, heartbeats]);
  const modelOf = (rx, tag) => models[`${rx}|${tag}`] || buildModel(rx, tag);

  const measureOf = (rx, tag) => calibration[rx]?.tags?.[tag]?.measure || "rssi";

  // ---- smoothing: trimmed mean of the last N readings per receiver+tag ----
  const rawRef = useRef({});
  const zoneStateRef = useRef({});
  const [smooth, setSmooth] = useState({});
  useEffect(() => {
    const h = rawRef.current;
    const out = {};
    for (const [rx, tagMap] of Object.entries(live)) {
      for (const [tag, r] of Object.entries(tagMap || {})) {
        const k = `${rx}|${tag}`;
        let arr = (h[k] || []).filter((a) => r.ts - a.ts < 20000);
        if (!arr.length || arr[arr.length - 1].ts !== r.ts) arr.push({ ts: r.ts, rssi: signalOf(r, measureOf(rx, tag)) });
        if (arr.length > smoothN) arr = arr.slice(-smoothN);
        h[k] = arr;
        out[k] = trimmedMean(arr.map((a) => a.rssi));
      }
    }
    setSmooth(out);
  }, [live, smoothN, calibration]);

  // ---- receivers ----
  const W = Number(room.w) || 5;
  const H = Number(room.h) || 5;
  const receivers = useMemo(() => {
    const ids = [...new Set([...Object.keys(live), ...Object.keys(heartbeats), ...Object.keys(layout)])].sort();
    return ids.map((id, i) => {
      const tsList = Object.values(live[id] || {}).map((r) => r.ts || 0);
      const lastSeen = Math.max(heartbeats[id]?.lastSeen || 0, ...tsList, 0);
      // No saved position yet: spread placeholders around the room (never in a straight line) so the map reads as a sketch
      const ang = (-90 + (i * 360) / Math.max(ids.length, 1)) * (Math.PI / 180);
      const pos = layout[id] || { x: W / 2 + 0.32 * W * Math.cos(ang), y: H / 2 + 0.32 * H * Math.sin(ang) };
      const heard = Object.values(live[id] || {}).filter((r) => serverNow - (r.ts || 0) < lostMs).length;
      return {
        id, lastSeen, heard, x: pos.x, y: pos.y, positioned: !!layout[id], hb: heartbeats[id] || {},
        online: lastSeen > 0 && serverNow - lastSeen < cfg.rxOfflineSec * 1000,
      };
    });
  }, [live, heartbeats, layout, serverNow, W, H, cfg.rxOfflineSec, lostMs]);

  // ---- position smoothing: each new scan moves the dot only part of the way toward the new fix ----
  const posRef = useRef({});
  const smoothPos = (id, fix, sig) => {
    const prev = posRef.current[id];
    if (!fix) return null; // keep the old track so a short gap doesn't make the dot jump on return
    if (prev && prev.sig === sig) return prev.pos; // clock tick, no new scan: keep the dot still
    const fresh = !prev || serverNow - prev.at > lostMs;
    const a = fresh ? 1 : 1 - Math.min(0.95, Math.max(0, cfg.posSmooth));
    const track = fresh ? fix : { x: prev.track.x + a * (fix.x - prev.track.x), y: prev.track.y + a * (fix.y - prev.track.y) };
    // Stillness: the drawn dot only moves once the smoothed track has left a small circle around it
    const still = !fresh && Math.hypot(track.x - prev.pos.x, track.y - prev.pos.y) < cfg.posStillM;
    const pos = still ? { ...fix, x: prev.pos.x, y: prev.pos.y } : { ...fix, ...track };
    posRef.current[id] = { sig, pos, track, at: serverNow };
    return pos;
  };

  // ---- tags: choose the fresh receiver with the shortest calibrated distance ----
  const tags = useMemo(() => {
    const out = {};
    for (const [rx, tagMap] of Object.entries(live)) {
      for (const [id, r] of Object.entries(tagMap || {})) {
        const fresh = serverNow - (r.ts || 0) < lostMs;
        const rssi = smooth[`${rx}|${id}`] ?? signalOf(r, measureOf(rx, id));
        const cur = out[id];
        // zone = receiver the tag is CLOSEST to (calibrated distance), not the raw strongest signal:
        // receivers are calibrated separately, so their dBm values aren't directly comparable
        const d = modelOf(rx, id).toM(rssi);
        const closer = cur && (d < cur.dRaw || (d === cur.dRaw && rssi > cur.rssi));
        if (!cur || (fresh && (!cur.fresh || closer)) || (!fresh && !cur.fresh && r.ts > cur.ts)) {
          out[id] = { id, zone: rx, rssi, pkts: r.pkts, ts: r.ts || 0, fresh, dRaw: d, dist: approx(rssi, modelOf(rx, id), cfg) };
        }
      }
    }
    // every receiver's view of each tag (for room positioning)
    // only receivers whose position you saved count; placeholder spots must never produce a dot
    const rxPos = Object.fromEntries(receivers.filter((r) => r.positioned).map((r) => [r.id, { x: r.x, y: r.y }]));
    for (const tag of Object.values(out)) {
      tag.reads = Object.entries(live)
        .filter(([, tagMap]) => tagMap?.[tag.id])
        .map(([rx, tagMap]) => {
          const r = tagMap[tag.id];
          const rssi = smooth[`${rx}|${tag.id}`] ?? signalOf(r, measureOf(rx, tag.id));
          const model = modelOf(rx, tag.id);
          return { rx, rssi, ts: r.ts || 0, fresh: serverNow - (r.ts || 0) < lostMs, d: model.toM(rssi), dist: approx(rssi, model, cfg) };
        })
        .sort((a, b) => b.rssi - a.rssi);
      const recentReads = tag.reads.filter((r) => r.fresh);
      const best = recentReads.reduce((a, b) => (a && a.d <= b.d ? a : b), null);
      if (best) {
        const previous = zoneStateRef.current[tag.id];
        const signature = recentReads.map((r) => `${r.rx}:${r.ts}`).sort().join("|");
        const previousRead = previous && recentReads.find((r) => r.rx === previous.zone);
        let assigned = best.rx;
        let settling = false;

        // A new receiver must win 3 distinct scans by a clear margin before the
        // visible zone changes. This filters distance jitter around zone borders.
        if (previous && previous.zone !== best.rx && previousRead) {
          const bothOutOfRange = !Number.isFinite(previousRead.d) && !Number.isFinite(best.d);
          const margin = previousRead.d - best.d;
          const clearlyCloser = (!Number.isFinite(previousRead.d) && Number.isFinite(best.d)) || (Number.isFinite(margin) && margin > tie(best.d));
          if (bothOutOfRange || !clearlyCloser) {
            assigned = previous.zone;
            settling = assigned !== best.rx;
            zoneStateRef.current[tag.id] = { zone: assigned, challenger: null, count: 0, signature };
          } else {
            const changedScan = signature !== previous.signature;
            const count = (previous.challenger === best.rx ? previous.count : 0) + (changedScan ? 1 : 0);
            settling = count < 3;
            assigned = settling ? previous.zone : best.rx;
            zoneStateRef.current[tag.id] = {
              zone: assigned,
              challenger: settling ? best.rx : null,
              count: settling ? count : 0,
              signature,
            };
          }
        } else {
          zoneStateRef.current[tag.id] = { zone: best.rx, challenger: null, count: 0, signature };
        }

        tag.zone = assigned;
        // distance/RSSI must describe the zone shown, not the challenger
        const held = recentReads.find((r) => r.rx === assigned);
        if (held) Object.assign(tag, { rssi: held.rssi, pkts: live[assigned][tag.id].pkts, ts: held.ts, dRaw: held.d, dist: held.dist });
        const competingFar = recentReads.some((r) => r.rx !== best.rx && r.dist.far && r.dist.limit <= best.d);
        const similarEstimate = recentReads.some((r) => r.rx !== best.rx && !r.dist.far && Number.isFinite(r.d) && Math.abs(r.d - best.d) <= tie(best.d));
        tag.zoneUncertain = competingFar || similarEstimate || !Number.isFinite(best.d) || settling;
        const candidates = recentReads.filter((r) => r.rx === best.rx || r.dist.far && r.dist.limit <= best.d || !r.dist.far && Math.abs(r.d - best.d) <= tie(best.d)).map((r) => r.rx);
        tag.zoneCandidates = tag.zoneUncertain
          ? [...new Set([...candidates, ...(settling ? [assigned, best.rx] : [])])]
          : [best.rx];
      } else {
        tag.zoneUncertain = false;
        tag.zoneCandidates = [];
      }
      const fix = tag.fresh ? solvePosition(tag.reads, rxPos, cfg.maxRange, { w: W, h: H }, cfg.nearM, posRef.current[tag.id]?.pos) : null;
      tag.pos = smoothPos(tag.id, fix, tag.reads.filter((r) => r.fresh).map((r) => `${r.rx}:${r.ts}`).join("|"));
    }
    return Object.values(out).sort((a, b) =>
      a.fresh === b.fresh ? label(a.id).localeCompare(label(b.id)) : a.fresh ? -1 : 1
    );
  }, [live, smooth, serverNow, models, cfg, devices, receivers]);

  // ---- history (per tag) + first-seen ----
  const histRef = useRef({});
  const firstSeenRef = useRef({});
  const [histTick, setHistTick] = useState(0);
  useEffect(() => {
    const h = histRef.current;
    const cutoff = serverNow - cfg.historySec * 1000;
    let changed = false;
    for (const t of tags) {
      if (!firstSeenRef.current[t.id]) firstSeenRef.current[t.id] = t.ts;
      const arr = h[t.id] || (h[t.id] = []);
      if (t.fresh && (!arr.length || arr[arr.length - 1].ts !== t.ts)) {
        arr.push({ ts: t.ts, d: t.dist.d, rssi: t.rssi, zone: t.zone });
        changed = true;
      }
      while (arr.length && arr[0].ts < cutoff) arr.shift();
    }
    if (changed) setHistTick((n) => n + 1);
  }, [tags]);

  // ---- activity log: found / lost / back / moved zone / receiver online-offline ----
  const prevRef = useRef({ tags: null, rx: null });
  const [events, setEvents] = useState([]);
  // Last zone the tag held with certainty; settling/uncertain ticks keep the old one, so "moved" fires once when the new zone settles
  const confirmed = (t, p) => (t.fresh && !t.zoneUncertain) || !p ? t.zone : p.zone;
  useEffect(() => {
    const prev = prevRef.current;
    // First snapshot after load is the baseline: don't log what already existed
    if (!prev.tags) {
      if (!tags.length && !receivers.length) return;
      prev.tags = Object.fromEntries(tags.map((t) => [t.id, { fresh: t.fresh, zone: confirmed(t, prev.tags?.[t.id]) }]));
      prev.rx = Object.fromEntries(receivers.map((r) => [r.id, r.online]));
      return;
    }
    const ev = [];
    if (prev.tags) {
      for (const t of tags) {
        const p = prev.tags[t.id];
        if (!p) ev.push({ ts: serverNow, kind: "found", id: t.id, text: t.zoneUncertain ? "appeared; zone uncertain" : `appeared in ${zoneLabel(t.zone)}` });
        else if (p.fresh && !t.fresh) ev.push({ ts: serverNow, kind: "lost", id: t.id, text: `lost (last in ${zoneLabel(p.zone)})` });
        else if (!p.fresh && t.fresh) ev.push({ ts: serverNow, kind: "back", id: t.id, text: `back in ${zoneLabel(t.zone)}` });
        else if (t.fresh && !t.zoneUncertain && p.zone !== t.zone) ev.push({ ts: serverNow, kind: "moved", id: t.id, text: `moved to ${zoneLabel(t.zone)}` });
      }
    }
    if (prev.rx) {
      for (const r of receivers) {
        const p = prev.rx[r.id];
        if (p !== undefined && p !== r.online) ev.push({ ts: serverNow, kind: r.online ? "back" : "lost", id: r.id, text: r.online ? "receiver online" : "receiver offline" });
      }
    }
    prev.tags = Object.fromEntries(tags.map((t) => [t.id, { fresh: t.fresh, zone: confirmed(t, prev.tags?.[t.id]) }]));
    prev.rx = Object.fromEntries(receivers.map((r) => [r.id, r.online]));
    if (ev.length) setEvents((e) => [...ev.reverse(), ...e].slice(0, 200));
  }, [tags, receivers]);

  return {
    live, devices, calibration, cfg, serverNow, connected, room: { W, H, features: room.features || {} },
    receivers, tags, smooth, events, label, zoneLabel, isNamed, modelOf,
    history: histRef.current, histTick, firstSeen: firstSeenRef.current,
  };
}
