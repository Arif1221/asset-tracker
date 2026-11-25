import { useEffect, useRef, useState } from "react";
import { bearing, posRadius, whyNoPosition } from "../lib/position";
import { clampBox, doorSwing, gridStep, wallSpan } from "../lib/room";
import { RoomEditor } from "./RoomEditor";

/* Floor-plan zone map.
   - Room outline from settings/room; receivers from /layout.
   - Zones = the part of the room closest to each receiver (Voronoi, clipped to the room).
   - A tag with a 2D solution (3+ receivers hear it) is a dot with a dashed uncertainty circle.
   - A tag without one is a hollow marker on a ring around the receiver it is closest to:
     the distance is known, the direction is not.
   - Optional heat layer: time spent per 0.25 m cell, kept in this browser only. */

const ZONE_COLORS = ["#4F555D", "#111316"]; // greys only: amber is reserved for "ambiguous"
const BASE = 440; // viewBox units across the longer room side

// keep the half-plane a*x + b*y <= c
function clip(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = a * p[0] + b * p[1] - c, fq = a * q[0] + b * q[1] - c;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const k = fp / (fp - fq);
      out.push([p[0] + k * (q[0] - p[0]), p[1] + k * (q[1] - p[1])]);
    }
  }
  return out;
}

export function zonePolygons(receivers, W, H) {
  return receivers.map((rx, i) => {
    let poly = [[0, 0], [W, 0], [W, H], [0, H]];
    receivers.forEach((o, j) => {
      if (i === j) return;
      const dx = o.x - rx.x, dy = o.y - rx.y;
      if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;
      poly = clip(poly, dx, dy, (o.x * o.x + o.y * o.y - rx.x * rx.x - rx.y * rx.y) / 2);
    });
    return poly;
  });
}

const centroid = (poly) => poly.length
  ? [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length]
  : null;

export function FloorPlan({ t, selected, onSelect, onPlace }) {
  const { W, H } = t.room;
  const cell = Math.max(0.05, Number(t.cfg.heatCellM) || 0.25);
  const heat = useRef(new Map());
  const lastCell = useRef(null);
  const svgRef = useRef(null);
  const [showHeat, setShowHeat] = useState(false);
  const [edit, setEdit] = useState(false);
  const [drag, setDrag] = useState(null); // {id, x, y} while a receiver is being moved
  const [editRoom, setEditRoom] = useState(false);
  const [show, setShow] = useState("all"); // which tags the map draws: all | selected | pick
  const [picked, setPicked] = useState([]);
  const wrapRef = useRef(null);
  const [full, setFull] = useState(false);
  // Full screen = the map covers the window (works in every browser); real browser full screen is a bonus where allowed
  useEffect(() => {
    if (!full) return;
    const esc = (e) => e.key === "Escape" && setFull(false);
    const left = () => !document.fullscreenElement && setFull(false);
    document.addEventListener("keydown", esc);
    document.addEventListener("fullscreenchange", left);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("fullscreenchange", left); };
  }, [full]);
  const toggleFull = () => {
    if (full) { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); setFull(false); }
    else { setFull(true); document.documentElement.requestFullscreen?.().catch(() => {}); }
  };

  // every state tick (about 0.5 s) adds one count to the cell each positioned tag is in
  useEffect(() => {
    if (lastCell.current !== cell) { heat.current.clear(); lastCell.current = cell; } // new cell size: old counts no longer line up
    for (const tag of t.tags) {
      if (!tag.fresh || !tag.pos) continue;
      const k = `${Math.floor(tag.pos.x / cell)},${Math.floor(tag.pos.y / cell)}`;
      heat.current.set(k, (heat.current.get(k) || 0) + 1);
    }
  }, [t.tags]);

  const rxs = t.receivers.map((r) => (drag?.id === r.id ? { ...r, x: drag.x, y: drag.y } : r));
  if (!rxs.length) return <p className="empty">No receivers yet. Power one on and it will appear here.</p>;

  const pad = 30;
  const s = Math.min(BASE / W, BASE / H);
  const vw = W * s + pad * 2, vh = H * s + pad * 2;
  const X = (x) => pad + x * s, Y = (y) => pad + y * s;
  const polys = zonePolygons(rxs, W, H);
  const rxById = Object.fromEntries(rxs.map((r) => [r.id, r]));
  const step = gridStep(W, H);
  const visible = (tag) => show === "all" || (show === "selected" ? tag.id === selected : picked.includes(tag.id));
  const P = ([x, y]) => [X(x), Y(y)];

  const items = [];
  const ringIdx = {};
  for (const tag of t.tags) {
    if (!visible(tag)) continue;
    if (!tag.fresh) {
      // lost: mark it beside the receiver it was last nearest to, never as a located point
      const rx = rxById[tag.zone];
      if (!rx) continue;
      const k = ringIdx[rx.id] ?? 0;
      ringIdx[rx.id] = k + 1;
      // beside the receiver, toward the room's middle, stacked; zone names sit above/below receivers, so this side stays clear
      const side = rx.x < W / 2 ? 1 : -1;
      items.push({ tag, kind: "lost", rx, side, x: X(rx.x) + side * 28, y: Y(rx.y) - 16 - k * 30 }); // above the receiver label line
      continue;
    }
    if (tag.pos) {
      items.push({ tag, kind: "pos", x: X(tag.pos.x), y: Y(tag.pos.y), rPx: posRadius(tag.pos.err, t.cfg) * s,
        bearing: rxById[tag.zone] ? { rx: rxById[tag.zone], ...bearing(rxById[tag.zone], tag.pos, t.cfg) } : null });
      continue;
    }
    const reads = tag.reads || [];
    const read = reads.find((r) => r.rx === tag.zone && r.fresh) || reads.find((r) => r.fresh);
    const rx = read && rxById[read.rx];
    if (!rx) continue;
    const k = ringIdx[rx.id] ?? 0;
    ringIdx[rx.id] = k + 1;
    const ringM = read.dist.far ? read.dist.limit : Math.max(read.d, 0);
    const ringPx = Math.max(14, ringM * s);
    const ang = ((-90 + k * 55) * Math.PI) / 180;
    items.push({
      tag, kind: "ring", cx: X(rx.x), cy: Y(rx.y), ringPx, far: read.dist.far, text: read.dist.short,
      x: X(rx.x) + ringPx * Math.cos(ang), y: Y(rx.y) + ringPx * Math.sin(ang),
    });
  }

  const cells = [...heat.current.entries()];
  const maxHeat = cells.reduce((m, [, c]) => Math.max(m, c), 1);
  const lost = t.tags.filter((x) => visible(x) && !x.fresh && !rxById[x.zone]).length;
  const hidden = t.tags.filter((x) => !visible(x)).length;
  const placeholders = rxs.filter((r) => !r.positioned).length;
  const whyList = t.tags.filter(visible).map((tag) => ({ tag, why: whyNoPosition(tag, t.receivers, t.label, t.room) })).filter((x) => x.why);
  const saveSpots = () => rxs.filter((r) => !r.positioned).forEach((r) => onPlace(r.id, r1(r.x), r1(r.y)));
  const toRoom = (e) => {
    const svg = svgRef.current, m = svg?.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: Math.min(W, Math.max(0, (p.x - pad) / s)), y: Math.min(H, Math.max(0, (p.y - pad) / s)) };
  };
  const r1 = (v) => Math.round(v * 10) / 10;
  const nudge = (rx, dx, dy) => onPlace(rx.id, r1(Math.min(W, Math.max(0, rx.x + dx))), r1(Math.min(H, Math.max(0, rx.y + dy))));
  const ticks = Array.from({ length: Math.floor(W / step) + 1 }, (_, i) => i * step);
  const ticksY = Array.from({ length: Math.floor(H / step) + 1 }, (_, i) => i * step);

  return (
    <div className={`fp-wrap${full ? " full" : ""}`} ref={wrapRef}>
      {placeholders > 0 && (
        <div className="fp-warn">
          <p>{placeholders === rxs.length ? "No receiver has a saved position" : `${placeholders} receiver${placeholders > 1 ? "s have" : " has"} no saved position`}. The dashed squares are placeholders, so tags can’t get a position or direction yet.</p>
          {onPlace && <p className="fp-warn-actions">
            <button className="btn" onClick={() => setEdit(true)}>Place receivers on the map</button>
            <button className="btn quiet" onClick={saveSpots}>Save the spots shown</button>
          </p>}
        </div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${vw} ${vh}`} className="fp-svg" role="img" aria-label={`Floor plan ${W} by ${H} metres with ${rxs.length} receivers and ${items.length} located tags`}>
        <defs><clipPath id="fp-clip"><rect x={pad} y={pad} width={W * s} height={H * s} /></clipPath></defs>
        <rect className="fp-floor" x={pad} y={pad} width={W * s} height={H * s} />
        {ticks.slice(1, -1).map((m) => <line key={`gx${m}`} className="fp-grid" x1={X(m)} y1={pad} x2={X(m)} y2={pad + H * s} />)}
        {ticksY.slice(1, -1).map((m) => <line key={`gy${m}`} className="fp-grid" x1={pad} y1={Y(m)} x2={pad + W * s} y2={Y(m)} />)}
        {ticks.map((m) => <text key={`tx${m}`} className="fp-tick" x={X(m)} y={pad - 9} textAnchor="middle">{m}</text>)}
        {ticksY.map((m) => <text key={`ty${m}`} className="fp-tick" x={pad - 8} y={Y(m) + 4} textAnchor="end">{m}</text>)}

        {polys.map((poly, i) => poly.length > 2 && (
          <polygon key={`z${rxs[i].id}`} className="fp-zone" points={poly.map((p) => `${X(p[0])},${Y(p[1])}`).join(" ")}
            fill={ZONE_COLORS[i % ZONE_COLORS.length]} stroke={ZONE_COLORS[i % ZONE_COLORS.length]} />
        ))}

        {Object.entries(t.room.features).map(([id, f]) => {
          if (f.type === "block") {
            const b = clampBox(f, W, H);
            return (
              <g key={id} className="fp-block">
                <rect x={X(b.x)} y={Y(b.y)} width={b.w * s} height={b.h * s} />
                {f.label && <text x={X(b.x + b.w / 2)} y={Y(b.y + b.h / 2) + 4} textAnchor="middle">{f.label}</text>}
              </g>
            );
          }
          const w = wallSpan(f, W, H);
          const a = P(w.P), b = P([w.P[0] + w.u[0] * w.len, w.P[1] + w.u[1] * w.len]);
          const mid = [(a[0] + b[0]) / 2 + w.n[0] * 14, (a[1] + b[1]) / 2 + w.n[1] * 14];
          const vertical = f.wall === "left" || f.wall === "right";
          return (
            <g key={id} className={`fp-feat ${f.type}`}>
              <line className="fp-gap" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
              {f.type === "window" && <>
                <line className="fp-glass" x1={a[0] - w.n[0] * 2.5} y1={a[1] - w.n[1] * 2.5} x2={b[0] - w.n[0] * 2.5} y2={b[1] - w.n[1] * 2.5} />
                <line className="fp-glass" x1={a[0] + w.n[0] * 2.5} y1={a[1] + w.n[1] * 2.5} x2={b[0] + w.n[0] * 2.5} y2={b[1] + w.n[1] * 2.5} />
              </>}
              {f.type === "door" && (() => {
                const d = doorSwing(f, W, H), [hx, hy] = P(d.P), [ex, ey] = P(d.end), [ox, oy] = P(d.open), r = d.len * s;
                return <><line className="fp-leaf" x1={hx} y1={hy} x2={ox} y2={oy} /><path className="fp-swing" d={`M${ex},${ey} A${r},${r} 0 0 ${d.sweep} ${ox},${oy}`} /></>;
              })()}
              {f.type === "opening" && <>
                <line className="fp-jamb" x1={a[0]} y1={a[1]} x2={a[0] + w.n[0] * 6} y2={a[1] + w.n[1] * 6} />
                <line className="fp-jamb" x1={b[0]} y1={b[1]} x2={b[0] + w.n[0] * 6} y2={b[1] + w.n[1] * 6} />
              </>}
              {f.label && <text className="fp-feat-name" x={mid[0]} y={mid[1] + 4} textAnchor="middle"
                transform={vertical ? `rotate(-90 ${mid[0]} ${mid[1] + 4})` : undefined}>{f.label}</text>}
            </g>
          );
        })}

        {showHeat && <g clipPath="url(#fp-clip)" aria-hidden="true">
          {cells.map(([k, c]) => {
            const [cx, cy] = k.split(",").map(Number);
            return <rect key={k} className="fp-heat" x={X(cx * cell)} y={Y(cy * cell)} width={cell * s} height={cell * s} opacity={0.1 + 0.6 * (c / maxHeat)} />;
          })}
        </g>}

        {polys.map((poly, i) => {
          const c = centroid(poly);
          // keep the zone name on the side of the centroid away from the receiver's own label
          return c && poly.length > 2 && <text key={`zn${rxs[i].id}`} className="fp-zone-name" x={X(c[0])} y={Y(c[1]) + (rxs[i].y > c[1] ? -10 : 34)} textAnchor="middle">{t.zoneLabel(rxs[i].id)}</text>;
        })}

        <g clipPath="url(#fp-clip)">
          {items.filter((i) => i.kind === "ring").map((i) => <circle key={`rg${i.tag.id}`} className={`fp-ring ${i.tag.zoneUncertain ? "uncertain" : ""}`} cx={i.cx} cy={i.cy} r={i.ringPx} />)}
          {items.filter((i) => i.kind === "pos").map((i) => <circle key={`un${i.tag.id}`} className={`fp-uncert ${i.tag.zoneUncertain ? "uncertain" : ""}`} cx={i.x} cy={i.y} r={i.rPx} />)}
        </g>

        {rxs.map((rx) => (
          <g key={`rx${rx.id}`} className={`fp-rx ${rx.online ? "" : "offline"} ${edit ? "edit" : ""} ${rx.positioned ? "" : "unplaced"}`}
            {...(edit ? {
              tabIndex: 0, role: "slider", "aria-label": `${t.label(rx.id)} position: ${rx.x.toFixed(1)} m from left, ${rx.y.toFixed(1)} m from top. Arrow keys move it 0.1 m.`,
              onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: rx.id, x: rx.x, y: rx.y }); },
              onPointerMove: (e) => { if (drag?.id === rx.id) { const p = toRoom(e); if (p) setDrag({ id: rx.id, x: r1(p.x), y: r1(p.y) }); } },
              onPointerUp: () => { if (drag?.id === rx.id) { onPlace(rx.id, drag.x, drag.y); setDrag(null); } },
              onKeyDown: (e) => {
                const k = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
                if (k) { e.preventDefault(); nudge(rx, k[0], k[1]); }
              },
            } : {})}>
            {edit && <circle className="fp-rx-handle" cx={X(rx.x)} cy={Y(rx.y)} r="16" />}
            <rect x={X(rx.x) - 6} y={Y(rx.y) - 6} width="12" height="12" rx="2" />
            <text className="fp-rx-name" x={X(rx.x)} y={Y(rx.y) + 20} textAnchor="middle">{t.label(rx.id)}{rx.online ? "" : " · offline"}{rx.positioned ? "" : " · not placed"}{edit ? ` · ${rx.x.toFixed(1)}, ${rx.y.toFixed(1)} m` : ""}</text>
          </g>
        ))}

        {items.map((i) => {
          const sel = selected === i.tag.id;
          const name = t.label(i.tag.id);
          const flip = i.kind === "lost" ? i.side < 0 : i.x > vw - 150; // read away from the receiver / right wall
          const lx = flip ? i.x - 14 : i.x + 14, anchor = flip ? "end" : "start";
          const ly = i.kind === "lost" ? i.y - 1 : i.y < pad + 18 ? i.y + 18 : i.y - 8;
          const sy = i.kind === "lost" ? i.y + 12 : i.y < pad + 18 ? i.y + 32 : i.y + 6;
          return (
            <g key={`tg${i.tag.id}`} className={`fp-tag ${i.tag.zoneUncertain ? "uncertain" : ""} ${sel ? "sel" : ""}`}
              onClick={() => onSelect?.(i.tag.id)} role="button" tabIndex={0} aria-label={`${name}: ${i.kind === "pos" ? "located" : i.kind === "lost" ? `lost, last near ${t.label(i.rx.id)}` : `near ${i.text}, direction unknown`}`}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(i.tag.id)}>
              {i.kind === "pos" && <circle className="fp-dot" cx={i.x} cy={i.y} r="6" />}
              {i.kind === "ring" && <circle className="fp-marker" cx={i.x} cy={i.y} r="6" />}
              {i.kind === "lost" && <><circle className="fp-lost-ring" cx={i.x} cy={i.y} r="11" /><rect className="fp-lost" x={i.x - 5} y={i.y - 5} width="10" height="10" /></>}
              <text className={`fp-label ${i.kind === "lost" ? "lost" : ""}`} x={lx} textAnchor={anchor} y={ly}>{name}</text>
              {i.kind === "lost" && <text className="fp-label-sub lost" x={lx} textAnchor={anchor} y={sy}>Lost · last near {t.label(i.rx.id)}</text>}
              {sel && i.kind !== "lost" && <text className="fp-label-sub" x={lx} textAnchor={anchor} y={sy}>{i.kind === "pos" ? `±${(i.rPx / s).toFixed(1)} m${i.bearing?.reliable ? ` · ${i.bearing.dir} of ${t.label(i.bearing.rx.id)}, ${i.bearing.dist.toFixed(1)} m` : ""}` : `${i.text}, direction unknown`}</text>}
            </g>
          );
        })}
      </svg>
      <div className="fp-tools">
        <button className="btn quiet fp-full" onClick={toggleFull} aria-pressed={full}>{full ? "Exit full screen" : "Full screen"}</button>
        {onPlace && <label><input type="checkbox" checked={edit} onChange={(e) => setEdit(e.target.checked)} /> Edit receiver layout</label>}
        <label><input type="checkbox" checked={editRoom} onChange={(e) => setEditRoom(e.target.checked)} /> Edit room</label>
        <label><input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} /> Heat (time spent)</label>
        {showHeat && <button className="link" onClick={() => heat.current.clear()}>Clear heat</button>}
        {lost > 0 && <span>{lost} lost tag{lost > 1 ? "s" : ""} with no known receiver, not shown</span>}
      </div>
      <div className="fp-show">
        <span className="side-label">Show tags</span>
        <div className="seg" role="radiogroup" aria-label="Show tags">
          {[["all", `All ${t.tags.length}`], ["selected", "Selected"], ["pick", "Choose"]].map(([k, v]) => (
            <button key={k} role="radio" aria-checked={show === k} className={show === k ? "on" : ""} onClick={() => setShow(k)}>{v}</button>
          ))}
        </div>
        {show === "selected" && <span className="muted">{selected ? t.label(selected) : "Select a tag in the table"}</span>}
        {show === "pick" && t.tags.map((x) => (
          <label key={x.id} className="check">
            <input type="checkbox" checked={picked.includes(x.id)}
              onChange={(e) => setPicked(e.target.checked ? [...picked, x.id] : picked.filter((id) => id !== x.id))} />
            {t.label(x.id)}
          </label>
        ))}
        {hidden > 0 && <span className="muted">{hidden} hidden</span>}
      </div>
      {editRoom && <RoomEditor t={t} />}
      {whyList.length > 0 && (
        <div className="fp-why">
          <b>No direction yet</b>
          <ul>{whyList.map(({ tag, why }) => <li key={tag.id}><span>{t.label(tag.id)}</span> {why}</li>)}</ul>
        </div>
      )}
      {edit && <p className="fp-hint">Drag a receiver to where it really is in the room; it saves when you let go. Or focus one and use the arrow keys (0.1 m per press). Positions are measured from the left wall and the top wall.</p>}
      <ul className="fp-key" aria-label="Map key">
        <li><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="var(--ink)" /></svg>Receiver</li>
        <li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="var(--ink)" /></svg>Located (dashed circle = possible error)</li>
        <li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="#fff" stroke="var(--ink)" strokeWidth="2" /></svg>Distance only, direction unknown</li>
        <li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="var(--warn)" /></svg>Zone ambiguous</li>
        <li><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="var(--red)" /></svg>Lost, beside its last receiver (not a position)</li>
      </ul>
    </div>
  );
}
