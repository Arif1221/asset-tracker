import { bearing, whyNoPosition } from "../lib/position";
import { ago } from "../lib/format";

/* Zone board: one card per receiver/zone, tags listed inside it.
   Each tag shows its distance to the zone's receiver, a closeness bar, and what the
   OTHER receivers hear, so you can see why a tag was placed where it was.
   Ambiguous tags go to "Between zones" with every candidate listed. Lost tags stay
   in their last zone, dimmed. Layout only; no coordinates are implied. */

function Closeness({ read, max }) {
  // full bar = at the receiver, empty = at/after max range or not heard
  const pct = !read || !read.fresh || read.dist.far ? 0 : Math.max(6, Math.round((1 - Math.min(read.d, max) / max) * 100));
  return <span className="zb-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>;
}

function TagRow({ t, tag, rxId, selected, onSelect, between }) {
  const max = t.cfg.maxRange;
  const own = tag.reads?.find((r) => r.rx === rxId);
  const others = (tag.reads || []).filter((r) => r.rx !== rxId && r.fresh);
  const status = !tag.fresh ? `lost · ${ago(t.serverNow - tag.ts)}` : between ? "between" : own?.dist.near ? "very near" : "tracking";
  return (
    <li className={`zb-tag ${!tag.fresh ? "lost" : ""} ${selected === tag.id ? "sel" : ""}`}>
      <button className="zb-tag-main" onClick={() => onSelect?.(tag.id)}>
        <span className="zb-name">{t.label(tag.id)}</span>
        <Closeness read={own} max={max} />
        <span className="zb-dist">{own ? own.dist.short : "–"}</span>
      </button>
      <small className="zb-sub">
        {status}
        {others.length > 0 && <> · also heard by {others.map((r) => `${t.label(r.rx)} ${r.dist.short}`).join(", ")}</>}
        {tag.fresh && others.length === 0 && t.receivers.length > 1 && !between && " · only this receiver hears it"}
      </small>
    </li>
  );
}

export function RoomPlot({ t, selected, onSelect }) {
  if (!t.receivers.length && !t.tags.length) return <p className="empty">No tags or receivers to show yet.</p>;

  const confident = (tag, rxId) => tag.zone === rxId && !tag.zoneUncertain;
  const placed = new Set();
  const cards = t.receivers.map((rx) => {
    const tags = t.tags.filter((tag) => confident(tag, rx.id) || (!tag.fresh && tag.zone === rx.id));
    tags.forEach((x) => placed.add(x.id));
    return { rx, tags };
  });
  const between = t.tags.filter((tag) => tag.fresh && tag.zoneUncertain);
  between.forEach((x) => placed.add(x.id));
  const orphan = t.tags.filter((tag) => !placed.has(tag.id));

  return (
    <div className="zb-wrap">
      <div className="zb-grid">
        {cards.map(({ rx, tags }) => {
          const live = tags.filter((x) => x.fresh).length;
          return (
            <section key={rx.id} className={`zb-card ${rx.online ? "" : "offline"}`}>
              <header>
                <span className="zb-dot" />
                <div><h4>{t.zoneLabel(rx.id)}</h4><small>{t.label(rx.id)} · {rx.online ? "online" : "offline"}</small></div>
                <b>{live}<small> tracked</small></b>
              </header>
              {tags.length
                ? <ul>{tags.map((tag) => <TagRow key={tag.id} t={t} tag={tag} rxId={rx.id} selected={selected} onSelect={onSelect} />)}</ul>
                : <p className="zb-empty">{rx.online ? "No assets here" : "Receiver offline; no assets can be placed here"}</p>}
            </section>
          );
        })}
        {between.length > 0 && (
          <section className="zb-card between">
            <header><span className="zb-dot" /><div><h4>Between zones</h4><small>Two receivers hear it about equally</small></div><b>{between.length}</b></header>
            <ul>{between.map((tag) => (
              <li key={tag.id} className={`zb-tag ${selected === tag.id ? "sel" : ""}`}>
                <button className="zb-tag-main" onClick={() => onSelect?.(tag.id)}><span className="zb-name">{t.label(tag.id)}</span></button>
                <small className="zb-sub">{(tag.reads || []).filter((r) => r.fresh).map((r) => `${t.zoneLabel(r.rx)} ${r.dist.short}`).join(" · ")}</small>
              </li>
            ))}</ul>
          </section>
        )}
        {orphan.length > 0 && (
          <section className="zb-card orphan">
            <header><span className="zb-dot" /><div><h4>No receiver estimate</h4><small>Not heard by any known receiver</small></div><b>{orphan.length}</b></header>
            <ul>{orphan.map((tag) => <TagRow key={tag.id} t={t} tag={tag} rxId="" selected={selected} onSelect={onSelect} />)}</ul>
          </section>
        )}
      </div>
      <p className="legend">Each asset sits in the zone of the receiver it is closest to. The bar shows how close (full = at the receiver, empty = beyond {t.cfg.maxRange} m). “Also heard by” lists the other receivers and their distances. Distances are RSSI estimates; this board shows zones, not coordinates.</p>
    </div>
  );
}

// Per-receiver signal + distance for one tag
export function ReceiverDistances({ t, tag, title = true }) {
  return (
    <div className="room-sel">
      {title && <h2>{t.label(tag.id)}</h2>}
      <p className="hint">{tag.pos?.pinned ? `Very near ${t.label(tag.pos.pinned)}, so it is placed at that receiver. A close signal is far more exact than the farther ones, which are ignored here.` : tag.pos ? `Approx. position from ${tag.pos.used.length} receivers: ${tag.pos.x.toFixed(1)} m from left, ${tag.pos.y.toFixed(1)} m from top (fit error ±${tag.pos.err.toFixed(1)} m).` : !tag.fresh ? "Lost; distances are from its last reading." : "Distance estimates do not show direction. A 2D position needs at least 3 non-collinear receivers."}</p>
      {tag.fresh && !tag.pos && (() => {
        const why = whyNoPosition(tag, t.receivers, t.label, t.room);
        return why ? <p className="bearing"><b>No direction:</b> {why}</p> : null;
      })()}
      {tag.pos && tag.fresh && (() => {
        const rx = t.receivers.find((r) => r.id === tag.zone);
        if (!rx) return null;
        const b = bearing(rx, tag.pos, t.cfg);
        return <p className="bearing">{b.reliable
          ? <><b>{b.dir}</b> of {t.label(rx.id)}, {b.dist.toFixed(1)} m <span>({Math.round(b.deg)}° ±{Math.round(b.half)}°; 0° = toward the top wall, 90° = right wall)</span></>
          : <>Too close to {t.label(rx.id)} to give a direction. The position error (±{b.r.toFixed(1)} m) is bigger than the distance.</>}</p>;
      })()}
      <table className="table">
        <thead><tr><th>Receiver</th><th>Signal</th><th>Est. distance</th></tr></thead>
        <tbody>
          {t.receivers.map((r) => {
            const rd = (tag.reads || []).find((x) => x.rx === r.id);
            const heard = rd?.fresh;
            return <tr key={r.id} className={tag.zone === r.id && tag.fresh && !tag.zoneUncertain ? "best" : ""}>
              <td>{t.label(r.id)}{tag.zone === r.id && tag.fresh && !tag.zoneUncertain && <em className="best-tag">nearest estimate</em>}</td>
              <td>{heard ? `${Math.round(rd.rssi)} dBm` : "–"}</td>
              <td>{heard ? rd.dist.text : "not heard"}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
