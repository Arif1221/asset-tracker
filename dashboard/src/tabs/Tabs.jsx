import { useEffect, useRef, useState } from "react";
import { calDistances, DEFAULTS, SETTINGS_META } from "../config";
import { approx, fitFormula, makeModel, median, pointKey, signalOf } from "../lib/distance";
import { ago, clock, dateTime } from "../lib/format";
import { removeTags, write, writeMany } from "../lib/db";
import { ReceiverDistances, RoomPlot } from "../components/RoomPlot";
import { FloorPlan } from "../components/FloorPlan";
import { ConfirmButton, EditNum, EditText, Module, Status } from "../components/ui";

/* ---------------- Activity ---------------- */
export function ActivityTab({ t, onSelect }) {
  return (
    <Module title="Activity" sub="since this page opened" meta={`${t.events.length} events`}>
      {t.events.length === 0 ? (
        <p className="empty">Nothing has changed yet. Tags appearing, getting lost, coming back and moving zones show up here as they happen.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th className="w-time">Time</th><th>Item</th><th>Event</th><th className="r">Ago</th></tr></thead>
            <tbody>
              {t.events.map((e, i) => (
                <tr key={i} className={`ev ${e.kind}`}>
                  <td className="num">{clock(e.ts)}</td>
                  <td><button className="link strong" onClick={() => onSelect(e.id)}>{t.label(e.id)}</button></td>
                  <td>{e.text}</td>
                  <td className="num r muted">{ago(t.serverNow - e.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Module>
  );
}

/* Status cell shared by the asset tables */
export function TagStatus({ tag }) {
  if (!tag.fresh) return <span className="st ls">Lost</span>;
  if (tag.zoneUncertain) return <span className="st wn">Uncertain</span>;
  return <span className="st ok">Tracking</span>;
}
export const zoneText = (t, x) => !x.fresh ? `${t.zoneLabel(x.zone)} (last)` : x.zoneUncertain ? (x.zoneCandidates || []).map((id) => t.zoneLabel(id)).join(" / ") : t.zoneLabel(x.zone);

/* ---------------- Map (home) ---------------- */
export function MapTab({ t, sel, onSelect, onOpen, onNavigate }) {
  const tracked = t.tags.filter((x) => x.fresh).length;
  const lost = t.tags.length - tracked;
  const online = t.receivers.filter((r) => r.online).length;
  const unnamed = t.tags.filter((x) => !t.isNamed(x.id)).length;
  const uncalibrated = t.tags.reduce((n, tag) => n + t.receivers.filter((rx) => !t.calibration[rx.id]?.tags?.[tag.id]).length, 0);
  const pairs = t.tags.length * t.receivers.length;
  const recent = t.events.slice(0, 8);

  return (
    <div className="mosaic">
      <Module className="a-map" title="Map" sub={`${t.room.W} × ${t.room.H} m floor plan`} meta={`${t.receivers.filter((r) => r.positioned).length} of ${t.receivers.length} receivers placed`}>
        <FloorPlan t={t} selected={sel?.id} onSelect={onSelect} onPlace={(id, x, y) => write(`layout/${id}`, { x, y })} />
      </Module>

      <Module className="a-assets" title="Assets" sub={`${t.tags.length} tags`} meta={<button className="link" onClick={() => onNavigate("Assets")}>Filter and history</button>}>
        <div className="kpis">
          <div className="kpi"><span>Tracked</span><b>{tracked}</b></div>
          <div className={`kpi ${lost ? "bad" : ""}`}><span>Lost</span><b>{lost}</b></div>
          <div className={`kpi ${online < t.receivers.length ? "bad" : ""}`}><span>Receivers online</span><b>{online}<small>/{t.receivers.length}</small></b></div>
          <div className={`kpi ${unnamed ? "warn" : ""}`}><span>Unnamed tags</span><b>{unnamed}</b></div>
        </div>
        <div className="table-wrap">
          <table className="table select">
            <thead><tr><th>Asset</th><th>Tag ID</th><th>Zone</th><th className="r">Dist.</th><th className="r">Last seen</th><th>Status</th></tr></thead>
            <tbody>
              {t.tags.length === 0 && <tr><td colSpan={6} className="empty">No tags yet. Power on a tag near a receiver and it appears within a few seconds.</td></tr>}
              {t.tags.map((x) => (
                <tr key={x.id} className={`${sel?.id === x.id ? "on" : ""} ${x.fresh ? "" : "lost"}`} onClick={() => onSelect(x.id)}>
                  <td><button className="link strong" onClick={(e) => { e.stopPropagation(); onSelect(x.id); }} aria-pressed={sel?.id === x.id}>{t.label(x.id)}</button></td>
                  <td className="id">{x.id}</td>
                  <td>{zoneText(t, x)}</td>
                  <td className="num r">{x.fresh ? x.dist.short : "–"}</td>
                  <td className="num r">{x.fresh ? "now" : ago(t.serverNow - x.ts)}</td>
                  <td><TagStatus tag={x} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Module>

      <Module className="a-sel" title="Selected" sub={sel ? t.label(sel.id) : "none"} meta={sel && <button className="link" onClick={() => onOpen(sel.id)}>Open details</button>}>
        {sel ? <ReceiverDistances t={t} tag={sel} title={false} /> : <p className="empty">Select an asset on the map or in the table to see what each receiver hears.</p>}
      </Module>

      <Module className="a-log" title="Activity" sub="live" meta={<button className="link" onClick={() => onNavigate("Activity")}>View all</button>}>
        {recent.length ? (
          <ul className="log">
            {recent.map((e, i) => (
              <li key={`${e.ts}-${i}`} className={e.kind}>
                <time>{clock(e.ts).slice(0, 5)}</time>
                <button className="link strong" onClick={() => onOpen(e.id)}>{t.label(e.id)}</button>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        ) : <p className="empty">No changes since this page opened.</p>}
      </Module>

      <Module className="a-rx" title="Receivers" sub="ESP32" meta={`${online} / ${t.receivers.length} online`}>
        <table className="table">
          <thead><tr><th>Name</th><th className="r">Tags</th><th className="r">Wi-Fi</th><th className="r">Last heard</th></tr></thead>
          <tbody>
            {t.receivers.length === 0 && <tr><td colSpan={4} className="empty">No receivers yet. Flash the receiver firmware and power it on.</td></tr>}
            {t.receivers.map((r) => (
              <tr key={r.id} className={r.online ? "" : "lost"}>
                <td><i className={`dot ${r.online ? "ok" : "bad"}`} />{t.label(r.id)}{!r.positioned && <span className="muted"> · not placed</span>}</td>
                <td className="num r">{r.heard}</td>
                <td className="num r">{r.hb.wifiRssi != null ? `${r.hb.wifiRssi} dBm` : "–"}</td>
                <td className="num r">{r.lastSeen ? ago(t.serverNow - r.lastSeen) : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Module>

      <Module className="a-cal" title="Calibration" sub="per tag and receiver" meta={<button className="link" onClick={() => onNavigate("Calibration")}>Calibrate</button>}>
        <div className="cells">
          <div><span>Pairs measured</span><b>{pairs - uncalibrated}<small>/{pairs}</small></b></div>
          <div className={uncalibrated ? "warn" : ""}><span>Using default estimate</span><b>{uncalibrated}</b></div>
        </div>
        <p className="hint">Unmeasured pairs use the receiver’s older profile or the default formula, so their distances are rougher.</p>
      </Module>

      <Module className="a-zones" title="Zones" sub="nearest receiver per asset">
        <RoomPlot t={t} selected={sel?.id} onSelect={onSelect} />
      </Module>
    </div>
  );
}

/* ---------------- Receivers ---------------- */
export function ReceiversTab({ t, onOpen }) {
  const [rxId, setRxId] = useState(null);
  const active = t.receivers.find((r) => r.id === rxId) || t.receivers.find((r) => r.online) || t.receivers[0];
  const remove = (id) => writeMany({ [`live/${id}`]: null, [`receivers/${id}`]: null, [`layout/${id}`]: null, [`calibration/${id}`]: null, [`devices/${id}`]: null });
  return (
    <div className="stack">
      <Module title="Receivers" sub="names, positions, health" meta={`${t.receivers.filter((r) => r.online).length} / ${t.receivers.length} online`}>
        <div className="table-wrap">
          <table className="table stack-sm">
            <thead>
              <tr><th>Receiver name</th><th>Zone name</th><th>ID</th><th>From left</th><th>From top</th><th className="r">Tags</th><th className="r">Wi-Fi</th><th>IP</th><th>Firmware</th><th>Calibration</th><th className="r">Last heard</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {t.receivers.length === 0 && <tr><td colSpan={13} className="empty">No receivers yet. Flash the receiver firmware and power it on.</td></tr>}
              {t.receivers.map((r) => {
                const legacy = t.modelOf(r.id);
                const pairProfiles = Object.values(t.calibration[r.id]?.tags || {}).filter((c) => Object.keys(c?.points || {}).length >= 2).length;
                return (
                  <tr key={r.id}>
                    <td><EditText value={t.devices[r.id]?.label} placeholder="Name this receiver" onSave={(v) => write(`devices/${r.id}/label`, v || null)} /></td>
                    <td><EditText value={t.devices[r.id]?.zoneLabel} placeholder={`Zone ${t.label(r.id)}`} onSave={(v) => write(`devices/${r.id}/zoneLabel`, v || null)} /></td>
                    <td className="id">{r.id}</td>
                    {r.positioned ? <>
                      <td className="nowrap" data-l="From left"><EditNum value={+r.x.toFixed(2)} min={0} onSave={(v) => write(`layout/${r.id}`, { x: v, y: r.y })} ariaLabel="Distance from left wall" /> m</td>
                      <td className="nowrap" data-l="From top"><EditNum value={+r.y.toFixed(2)} min={0} onSave={(v) => write(`layout/${r.id}`, { x: r.x, y: v })} ariaLabel="Distance from top wall" /> m</td>
                    </> : (
                      // its spot is only a placeholder: typing one coordinate would save the other one made up
                      <td colSpan={2} className="muted" data-l="Position">Not placed yet: drag it on the Map first</td>
                    )}
                    <td className="num r" data-l="Tags">{r.heard}</td>
                    <td className="num r" data-l="Wi-Fi">{r.hb.wifiRssi != null ? `${r.hb.wifiRssi} dBm` : "–"}</td>
                    <td className="id" data-l="IP">{r.hb.ip || "–"}</td>
                    <td data-l="Firmware">{r.hb.fw || "–"}</td>
                    <td>{pairProfiles ? `${pairProfiles} calibrated pairs` : legacy.pts.length ? "Older shared profile" : "Default estimate"}</td>
                    <td className="num r" data-l="Last heard">{r.lastSeen ? ago(t.serverNow - r.lastSeen) : "never"}</td>
                    <td><Status ok={r.online}>{r.online ? "Online" : "Offline"}</Status></td>
                    <td><ConfirmButton confirmText="Remove" onConfirm={() => remove(r.id)}>Remove</ConfirmButton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Module>

      <Module title="Readings" sub={active ? `what ${t.label(active.id)} hears` : "per receiver"}
        meta={t.receivers.length > 1 && (
          <select value={active?.id || ""} onChange={(e) => setRxId(e.target.value)} aria-label="Receiver">
            {t.receivers.map((r) => <option key={r.id} value={r.id}>{t.label(r.id)}</option>)}
          </select>
        )}>
        <div className="table-wrap">
          <table className="table stack-sm">
            <thead><tr><th>Asset</th><th>Status</th><th className="r">Signal</th><th>Distance from {active ? t.label(active.id) : "receiver"}</th><th>Nearest estimate</th><th /></tr></thead>
            <tbody>
              {t.tags.length === 0 && <tr><td colSpan={6} className="empty">No tags discovered yet.</td></tr>}
              {t.tags.map((x) => {
                const rd = x.reads?.find((r) => r.rx === active?.id);
                return (
                  <tr key={x.id} className={x.fresh ? "" : "lost"}>
                    <td className="strong">{t.label(x.id)}</td>
                    <td><TagStatus tag={x} /></td>
                    <td className="num r" data-l="Signal">{rd?.fresh ? `${Math.round(rd.rssi)} dBm` : "–"}</td>
                    <td data-l="Distance">{rd?.fresh ? rd.dist.text : "not heard"}</td>
                    <td data-l="Nearest">{zoneText(t, x)}</td>
                    <td className="r"><button className="link" onClick={() => onOpen(x.id)}>Open asset</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">Signal strength estimates range, not direction.</p>
      </Module>
    </div>
  );
}

/* ---------------- Calibrate ---------------- */
export function CalibrateTab({ t, defaultRx, defaultTag }) {
  const [rxId, setRxId] = useState(null);
  const [tagId, setTagId] = useState(null);
  const [cap, setCap] = useState(null); // {d, start, samples:[], lastTs}
  const [msg, setMsg] = useState(null);
  const capRef = useRef(null);
  capRef.current = cap;

  const rx = t.receivers.find((r) => r.id === rxId) || defaultRx;
  const tag = (tagId && t.tags.find((x) => x.id === tagId)) || defaultTag;
  const base = rx && tag ? `calibration/${rx.id}/tags/${tag.id}` : null;
  const reading = rx && tag ? t.live[rx.id]?.[tag.id] : null;
  const fresh = reading && t.serverNow - (reading.ts || 0) < t.cfg.lostSec * 1000;
  const smoothed = rx && tag ? t.smooth[`${rx.id}|${tag.id}`] : null;

  // collect raw readings while capturing
  useEffect(() => {
    const c = capRef.current;
    if (!c || !reading || reading.ts === c.lastTs) return;
    setCap({ ...c, samples: [...c.samples, signalOf(reading, c.measure)], lastTs: reading.ts });
  }, [reading?.ts]);

  // finish capture after captureSec
  useEffect(() => {
    if (!cap || t.serverNow - cap.start < t.cfg.captureSec * 1000) return;
    const where = cap.d === 0 ? "touching" : `${cap.d} m`;
    if (cap.samples.length < 3) {
      setMsg({ kind: "warn", text: `Only ${cap.samples.length} readings in ${t.cfg.captureSec} s at ${where}. Check the tag is on and try again.` });
    } else {
      const m = median(cap.samples);
      const point = { rssi: m, samples: cap.samples.length, at: t.serverNow };
      const pair = t.calibration[rx.id]?.tags?.[tag.id] || {};
      if (cap.measure === (pair.measure || "rssi")) {
        write(`${base}/points/${pointKey(cap.d)}`, point);
        setMsg({ kind: "ok", text: `Saved ${m} dBm at ${where} (median of ${cap.samples.length} readings).` });
      } else {
        // Points from the other measure don't mix with this one: park them (not deleted) and start fresh
        writeMany({ [`${base}/measure`]: cap.measure, [`${base}/points`]: { [pointKey(cap.d)]: point }, [`${base}/pointsOld`]: pair.points || null });
        setMsg(pair.points
          ? { kind: "warn", text: `Saved ${m} dBm at ${where}. This receiver measures signal differently since its firmware update, so this pair starts a new calibration: capture the other distances again. Earlier points are kept as a backup (pointsOld).` }
          : { kind: "ok", text: `Saved ${m} dBm at ${where} (median of ${cap.samples.length} readings).` });
      }
    }
    setCap(null);
  }, [t.serverNow]);

  if (!rx || !tag) return <Module title="Calibration"><p className="empty">Calibration needs one receiver and one tag switched on.</p></Module>;

  const raw = t.calibration[rx.id]?.tags?.[tag.id] || {};
  const legacy = t.calibration[rx.id] || {};
  const model = t.modelOf(rx.id, tag.id);
  const pairModel = makeModel(raw);
  const saved = Object.fromEntries(pairModel.pts.map((p) => [p.d, p]));
  const fit = fitFormula(pairModel.pts);
  const est = fresh && smoothed != null ? approx(smoothed, model, t.cfg) : null;
  const mode = raw.mode ?? (raw.points ? "table" : legacy.mode ?? "table");
  const progress = cap ? Math.min(1, (t.serverNow - cap.start) / (t.cfg.captureSec * 1000)) : 0;

  const start = (d) => { setMsg(null); setCap({ d, start: t.serverNow, samples: [], lastTs: reading?.ts, measure: typeof reading?.avg === "number" ? "avg" : "rssi" }); };

  return (
    <div className="pair">
      <Module title="Calibration" sub={`${t.label(tag.id)} at ${t.label(rx.id)}`} meta="each tag and receiver pair keeps its own profile">
        <div className="cal-pick">
          <label>Receiver
            <select value={rx.id} onChange={(e) => setRxId(e.target.value)} disabled={!!cap}>
              {t.receivers.map((r) => <option key={r.id} value={r.id}>{t.label(r.id)}</option>)}
            </select>
          </label>
          <label>Asset tag
            <select value={tag.id} onChange={(e) => setTagId(e.target.value)} disabled={!!cap}>
              {t.tags.map((x) => <option key={x.id} value={x.id}>{t.label(x.id)}</option>)}
            </select>
          </label>
          <label>Distance model
            <select value={mode} onChange={(e) => write(`${base}/mode`, e.target.value)}>
              <option value="table">Saved points</option>
              <option value="formula">Formula</option>
            </select>
          </label>
        </div>

        <h3 className="sub">Saved points</h3>
        <div className="table-wrap">
        <table className="table cal-table stack-sm">
          <thead><tr><th>Tag position</th><th>Saved signal</th><th>Readings</th><th>Saved</th><th /></tr></thead>
          <tbody>
            {[...new Set([...calDistances(t.cfg.maxRange), ...pairModel.pts.map((p) => p.d)])].sort((a, b) => a - b).map((d) => {
              const p = saved[d];
              const busy = cap?.d === d;
              return (
                <tr key={d} className={busy ? "busy" : ""}>
                  <td>{d === 0 ? "Touching the receiver" : `${d} m away`}</td>
                  <td>{p ? `${p.r} dBm` : <span className="muted">Not saved</span>}</td>
                  <td data-l={p ? "Readings" : undefined}>{p?.samples ?? (p ? "–" : "")}</td>
                  <td className="muted">{p?.at ? dateTime(p.at) : ""}</td>
                  <td className="actions">
                    {busy ? (
                      <span className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${progress * 100}%` }} />
                        <em>{cap.samples.length} readings</em>
                      </span>
                    ) : (
                      <>
                        <button className="btn" disabled={!fresh || !!cap} onClick={() => start(d)}>{p ? "Capture again" : "Capture"}</button>
                        {p && <button className="btn quiet" disabled={!!cap} onClick={() => write(`${base}/points/${pointKey(d)}`, null)}>Clear</button>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {msg && <p className={`note ${msg.kind}`} role="status">{msg.text}</p>}
        {pairModel.bad.length > 0 && mode === "table" && (
          <p className="note warn">The signal didn’t drop between {pairModel.bad.join(" and ")}. Distances in that band will be rough. Capture again with nobody near the tag or the receiver.</p>
        )}

        <h3 className="sub">Formula</h3>
        <div className="formula">
          <label className="field">Signal at 1 m <span><EditNum value={model.tx} step={0.5} onSave={(v) => write(`${base}/tx`, v)} ariaLabel="Signal at 1 metre" /> dBm</span></label>
          <label className="field">Path-loss exponent n <span><EditNum value={model.n} step={0.1} min={1} onSave={(v) => write(`${base}/n`, v)} ariaLabel="Path loss exponent" /></span></label>
          {fit ? (
            <p className="hint">
              Best fit from your saved points: {fit.tx} dBm at 1 m, n = {fit.n} (typical error ±{fit.err} dB).{" "}
              <button className="link" onClick={() => writeMany({ [`${base}/tx`]: fit.tx, [`${base}/n`]: fit.n })}>Use these values</button>
            </p>
          ) : (
            <p className="hint">Save at least two points at 0.5 m or more to get a best-fit suggestion.</p>
          )}
        </div>
        <div className="cal-foot">
          {t.receivers.filter((r) => r.id !== rx.id && t.calibration[r.id]?.tags?.[tag.id]).map((r) => (
            <ConfirmButton key={r.id} confirmText={`Copy from ${t.label(r.id)}`} onConfirm={() => write(base, t.calibration[r.id].tags[tag.id])}>
              Copy this tag’s calibration from {t.label(r.id)}
            </ConfirmButton>
          ))}
          {(raw.points || raw.tx || raw.n || raw.mode) && <ConfirmButton confirmText="Delete calibration" onConfirm={() => write(base, null)}>Reset this tag + receiver calibration</ConfirmButton>}
        </div>
      </Module>

      <Module title="Live reading" sub={fresh ? "receiving" : "no signal"}>
        <p className="cal-now">{fresh && smoothed != null ? `${smoothed.toFixed(1)} dBm` : "No signal"}</p>
        <p className="cal-est">{est ? (est.range ? `${est.text}, likely ${est.range}` : est.text) : "Bring the tag closer to the receiver."}</p>
        <p className="hint">Now using {mode === "table" && model.kind === "table" ? `${model.pts.length} saved points` : "the formula"}{mode === "table" && model.kind !== "table" ? " (save two points to switch to them)" : ""}{!Object.keys(raw).length && t.calibration[rx.id] && !t.calibration[rx.id]?.tags?.[tag.id] ? "; using the receiver’s older shared calibration until you capture this pair" : ""}.</p>
        <h3 className="sub">How to calibrate</h3>
        <ol className="steps">
          <li>Fix {t.label(rx.id)} where it will stay.</li>
          <li>Put the tag at a position from the list, then step at least 1 m away from both.</li>
          <li>Press Capture. It records for {t.cfg.captureSec} s and saves the median.</li>
          <li>Repeat for each position. Check the live estimate after each one.</li>
        </ol>
      </Module>
    </div>
  );
}

/* ---------------- Settings ---------------- */
export function SettingsTab({ t }) {
  const lostIds = t.tags.filter((x) => !x.fresh).map((x) => x.id);
  const removeLost = () => removeTags(Object.keys(t.live), lostIds);
  return (
    <div className="pair">
      <Module title="Settings" sub="saved to the database; every open dashboard updates at once">
      <div className="table-wrap">
      <table className="table settings">
        <tbody>
          <tr className="group-row"><th colSpan={3}>Room</th></tr>
          <tr><td>Room width (left to right)</td><td><EditNum value={t.room.W} step={0.1} min={1} onSave={(v) => write("settings/room/w", v)} ariaLabel="Room width" /> <span className="unit">m</span></td><td className="muted">Default 5</td></tr>
          <tr><td>Room length (top to bottom)</td><td><EditNum value={t.room.H} step={0.1} min={1} onSave={(v) => write("settings/room/h", v)} ariaLabel="Room length" /> <span className="unit">m</span></td><td className="muted">Default 5</td></tr>
          {SETTINGS_META.map((s, i) => [
            (i === 0 || SETTINGS_META[i - 1].group !== s.group) && <tr key={`g-${s.group}`} className="group-row"><th colSpan={3}>{s.group}</th></tr>,
            <tr key={s.key}>
              <td>{s.name}</td>
              <td><EditNum value={t.cfg[s.key]} step={s.step} min={s.min} onSave={(v) => write(`settings/app/${s.key}`, v)} ariaLabel={s.name} /> <span className="unit">{s.unit}</span></td>
              <td className="muted">Default {DEFAULTS[s.key]}</td>
            </tr>,
          ])}
        </tbody>
      </table>
      </div>
      </Module>
      <Module title="Maintenance">
        <p className="hint">Nothing here needs reflashing. Receiver positions: drag them on the Map (turn on “Edit receiver layout”), or type them in Receivers.</p>
        <ConfirmButton confirmText="Reset settings" onConfirm={() => write("settings/app", null)}>Reset all settings to defaults</ConfirmButton>
        <h3 className="sub">Clean up</h3>
        <p className="hint">{lostIds.length ? `${lostIds.length} lost tag${lostIds.length > 1 ? "s" : ""} still listed.` : "No lost tags listed."}</p>
        {lostIds.length > 0 && <ConfirmButton confirmText={`Remove ${lostIds.length}`} onConfirm={removeLost}>Remove all lost tags</ConfirmButton>}
      </Module>
    </div>
  );
}
