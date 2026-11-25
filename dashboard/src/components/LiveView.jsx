import { useState } from "react";
import { ago, clock, dateTime } from "../lib/format";
import { removeTags, write } from "../lib/db";
import { ReceiverDistances, RoomPlot } from "./RoomPlot";
import { LineChart } from "./Charts";
import { ConfirmButton, EditText, Module } from "./ui";

const initials = (s) => {
  const words = s.replace(/^TAG_/, "").split(/[\s_-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
};

/* Left filter sidebar */
function Filters({ t, f, setF }) {
  const zones = [...new Set(t.tags.map((x) => x.zone))];
  const max = t.cfg.maxRange;
  const counts = { all: t.tags.length, tracking: t.tags.filter((x) => x.fresh).length, lost: t.tags.filter((x) => !x.fresh).length };
  return (
    <Module className="filters" title="Filter" aria-label="Filters">
      <label className="side-label" htmlFor="q">Find a tag</label>
      <input id="q" className="search" type="search" placeholder="Name or ID" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />

      <p className="side-label">Status</p>
      <div className="seg" role="radiogroup" aria-label="Status">
        {["all", "tracking", "lost"].map((s) => (
          <button key={s} role="radio" aria-checked={f.status === s} className={f.status === s ? "on" : ""} onClick={() => setF({ ...f, status: s })}>
            {s[0].toUpperCase() + s.slice(1)} <span>{counts[s]}</span>
          </button>
        ))}
      </div>

      <label className="side-label" htmlFor="dist">Within distance</label>
      <input id="dist" type="range" min={0.5} max={max + 0.5} step={0.5} value={f.within}
        onChange={(e) => setF({ ...f, within: +e.target.value })} className="slider" />
      <div className="slider-scale"><span>0.5 m</span><b>{f.within > max ? "Any distance" : `≤ ${f.within} m`}</b><span>{max} m+</span></div>

      {zones.length > 0 && (
        <details open className="group">
          <summary>Zones</summary>
          {zones.map((z) => (
            <label key={z} className="check">
              <input type="checkbox" checked={!f.hiddenZones.includes(z)}
                onChange={(e) => setF({ ...f, hiddenZones: e.target.checked ? f.hiddenZones.filter((x) => x !== z) : [...f.hiddenZones, z] })} />
              {t.zoneLabel(z)}
            </label>
          ))}
        </details>
      )}
      <details className="group">
        <summary>Naming</summary>
        <label className="check">
          <input type="checkbox" checked={f.unnamedOnly} onChange={(e) => setF({ ...f, unnamedOnly: e.target.checked })} />
          Only unnamed tags
        </label>
      </details>
    </Module>
  );
}

/* Expanded tag: details timeline + charts on the left, radar on the right */
function Expanded({ t, tag }) {
  const [sub, setSub] = useState("Details");
  const hist = t.history[tag.id] || [];
  const evs = t.events.filter((e) => e.id === tag.id).slice(0, 6);
  const remove = () => removeTags(Object.keys(t.live), [tag.id]);
  const recent = hist.filter((p) => p.ts > t.serverNow - 10000).length;
  const multi = t.receivers.length > 1;

  return (
    <div className="expanded">
      <div className="exp-head">
        <div className="subtabs" role="tablist">
          {["Details", "Distance", "Signal", "Activity"].map((s) => (
            <button key={s} role="tab" aria-selected={sub === s} className={sub === s ? "on" : ""} onClick={() => setSub(s)}>{s}</button>
          ))}
        </div>
        <ConfirmButton confirmText="Remove tag" onConfirm={remove}>Remove</ConfirmButton>
      </div>

      <div className="exp-body">
        <div className="exp-left">
          {sub === "Details" && (
            <>
              <label className="side-label" htmlFor={`name-${tag.id}`}>Name</label>
              <EditText className="exp-name" value={t.devices[tag.id]?.label} placeholder="Name this tag" ariaLabel="Tag name"
                onSave={(v) => write(`devices/${tag.id}/label`, v || null)} />
              <ol className="timeline">
                <li>
                  <time>{t.firstSeen[tag.id] ? clock(t.firstSeen[tag.id]) : "–"}</time>
                  <div><b>First seen</b><span>{t.firstSeen[tag.id] ? dateTime(t.firstSeen[tag.id]) : "Before this page opened"}</span></div>
                </li>
                <li className="now">
                  <time>{clock(tag.ts)}</time>
                  <div>
                    <b>{tag.fresh ? tag.zoneUncertain ? `Zone uncertain · best estimate ${t.zoneLabel(tag.zone)}` : `${tag.dist.text} from ${t.zoneLabel(tag.zone)}` : `Lost near ${t.zoneLabel(tag.zone)}`}</b>
                    <span>{tag.fresh ? (tag.dist.range ? `Likely ${tag.dist.range}` : "Signal steady") : `Last seen ${ago(t.serverNow - tag.ts)}`}</span>
                  </div>
                </li>
              </ol>
              {multi && <ReceiverDistances t={t} tag={tag} title={false} />}
              <dl className="facts">
                <div><dt>{tag.fresh ? "Signal" : "Last signal"}</dt><dd>{Math.round(tag.rssi)} dBm</dd></div>
                <div><dt>Updates</dt><dd>{tag.fresh ? `${(recent / 10).toFixed(1)} per s` : "–"}</dd></div>
                <div><dt>Packets</dt><dd>{tag.fresh ? `${tag.pkts} last scan` : "–"}</dd></div>
                <div><dt>Tag ID</dt><dd>{tag.id}</dd></div>
              </dl>
            </>
          )}
          {sub === "Distance" && (
            <LineChart points={hist.map((p) => ({ ts: p.ts, v: p.d }))} now={t.serverNow} spanSec={t.cfg.historySec}
              yMin={0} yMax={t.cfg.maxRange + 0.5} ticks={Array.from({ length: Math.ceil(t.cfg.maxRange) + 1 }, (_, i) => i)}
              fmt={(v) => `${v} m`} gapMs={t.cfg.lostSec * 1000} band={[t.cfg.maxRange, t.cfg.maxRange + 0.5]} height={300} ariaLabel="Distance over time" />
          )}
          {sub === "Signal" && (
            <LineChart points={hist.map((p) => ({ ts: p.ts, v: p.rssi }))} now={t.serverNow} spanSec={t.cfg.historySec}
              yMin={-100} yMax={-30} ticks={[-100, -85, -70, -55, -40]} fmt={(v) => `${v} dBm`} gapMs={t.cfg.lostSec * 1000} height={300} ariaLabel="Signal over time" />
          )}
          {sub === "Activity" && (
            evs.length ? (
              <ol className="timeline">
                {evs.map((e, i) => (
                  <li key={i} className={e.kind}><time>{clock(e.ts)}</time><div><b>{e.text}</b><span>{ago(t.serverNow - e.ts)}</span></div></li>
                ))}
              </ol>
            ) : <p className="muted">No changes for this tag since the page opened.</p>
          )}
        </div>

        <div className="exp-view">
          <div className="exp-radar">
            <h3 className="chart-title">Zones</h3>
            <RoomPlot t={t} selected={tag.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Live tab: filters + tag rows, selected row expands */
export default function LiveView({ t, selected, onSelect }) {
  const [f, setF] = useState({ q: "", status: "all", within: t.cfg.maxRange + 0.5, hiddenZones: [], unnamedOnly: false });
  const shown = t.tags.filter((x) =>
    (f.status === "all" || (f.status === "tracking" ? x.fresh : !x.fresh)) &&
    `${t.label(x.id)} ${x.id}`.toLowerCase().includes(f.q.toLowerCase()) &&
    (f.within > t.cfg.maxRange || (x.fresh && x.dist.d <= f.within)) &&
    !f.hiddenZones.includes(x.zone) &&
    (!f.unnamedOnly || !t.isNamed(x.id))
  );

  return (
      <div className="live">
        <Filters t={t} f={f} setF={setF} />
        <Module className="rows" title="Assets" sub={`${shown.length} of ${t.tags.length} shown`} meta="select a row for details and history">
        {shown.length === 0 && (
          <div className="empty">
            {t.tags.length ? "No tags match these filters." : "No tags yet. Power on a tag near a receiver and it appears here within a few seconds."}
          </div>
        )}
        {shown.map((x) => {
          const open = x.id === selected;
          return (
            <article key={x.id} className={`row ${open ? "open" : ""} ${x.fresh ? "" : "lost"}`}>
              <button className="row-main" onClick={() => onSelect(open ? null : x.id)} aria-expanded={open}>
                <span className="row-id">
                  <span className={`avatar ${x.fresh ? (x.dist.far ? "far" : "ok") : "bad"}`} aria-hidden="true">{initials(t.label(x.id))}</span>
                  <span>
                    <b>{t.label(x.id)}</b>
                    <small>{t.isNamed(x.id) ? x.id : "Unnamed"}</small>
                  </span>
                </span>
                <span className="row-stat">
                  <b>{Math.round(x.rssi)}<em> dBm</em></b>
                  <small>{x.fresh ? "Signal" : "Last signal"}</small>
                </span>
                <span className="row-rx" aria-label="Distance from each receiver">
                  {t.receivers.map((r) => {
                    const rd = (x.reads || []).find((q) => q.rx === r.id);
                    const heard = rd?.fresh && x.fresh;
                    const w = heard ? (rd.dist.far ? 100 : Math.min(100, (rd.dist.d / t.cfg.maxRange) * 100)) : 0;
                    return (
                      <span key={r.id} className={`rx-line ${heard ? "" : "off"} ${x.zone === r.id && x.fresh && !x.zoneUncertain ? "best" : ""} ${heard && rd.dist.far ? "far" : ""}`}>
                        <small>{t.label(r.id)}</small>
                        <span className="track"><i style={{ width: `${w}%` }} /></span>
                        <small className="rx-d">{heard ? rd.dist.short : "–"}</small>
                      </span>
                    );
                  })}
                </span>
                <span className="row-stat">
                  <b>{clock(x.ts).slice(0, 5)}</b>
                  <small>{x.fresh ? "Live" : ago(t.serverNow - x.ts)}</small>
                </span>
                <span className="row-dist">
                  <b>{x.fresh ? x.dist.short : "–"}</b>
                  <small>{x.fresh ? (x.dist.range ? `likely ${x.dist.range}` : x.dist.text) : "Last seen"}</small>
                </span>
              </button>
              {open && <Expanded t={t} tag={x} />}
            </article>
          );
        })}
        </Module>
      </div>
  );
}
