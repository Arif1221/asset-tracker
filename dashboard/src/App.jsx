import { useEffect, useState } from "react";
import { useTracker } from "./hooks/useTracker";
import LiveView from "./components/LiveView";
import { clock } from "./lib/format";
import { ActivityTab, CalibrateTab, MapTab, ReceiversTab, SettingsTab } from "./tabs/Tabs";

const TABS = ["Map", "Assets", "Activity", "Receivers", "Calibration", "Settings"];
const slug = (s) => s.toLowerCase();
// old links keep working
const TAB_ALIASES = { overview: "Map", "zone map": "Map", room: "Map", "floor plan": "Map", live: "Assets", history: "Assets", signal: "Receivers", radar: "Receivers", calibrate: "Calibration" };
const fromHash = () => {
  const key = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
  return TAB_ALIASES[key] || TABS.find((x) => slug(x) === key) || "Map";
};

export default function App() {
  const t = useTracker();
  const [selectedId, setSelectedId] = useState(undefined); // undefined = auto-pick, null = none
  const [tab, setTabState] = useState(fromHash);
  useEffect(() => {
    const on = () => setTabState(fromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const setTab = (x) => { setTabState(x); window.history.replaceState(null, "", `#${slug(x)}`); };

  const autoTag = t.tags.find((x) => x.fresh) || t.tags[0];
  const sel = selectedId === undefined ? autoTag : t.tags.find((x) => x.id === selectedId) || null;
  const select = (id) => setSelectedId(id);
  const open = (id) => { select(id); setTab("Assets"); };

  const live = t.tags.filter((x) => x.fresh).length;
  const lost = t.tags.length - live;
  const online = t.receivers.filter((r) => r.online).length;
  const counts = {
    Map: live || null,
    Assets: lost ? { n: `${lost} lost`, bad: true } : t.tags.length || null,
    Activity: t.events.length || null,
    Receivers: t.receivers.length ? { n: `${online}/${t.receivers.length}`, bad: online < t.receivers.length } : null,
  };
  const defaultRx = t.receivers.find((r) => r.online) || t.receivers[0];

  return (
    <div className="app">
      <header className="n1">
        <a className="logo" href="#map" onClick={(e) => { e.preventDefault(); setTab("Map"); }}>Asset<b>.</b>Tracker</a>
        <span className="room">Room {t.room.W} × {t.room.H} m</span>
        <span className="sp" />
        <span className={`pill ${t.connected ? "" : "bad"}`}><i className={`dot ${t.connected ? "ok" : "warn"}`} />{t.connected ? "Live" : "Reconnecting…"}</span>
        <button className={`pill ${online < t.receivers.length ? "bad" : ""}`} onClick={() => setTab("Receivers")}>
          Receivers {online} / {t.receivers.length} online
        </button>
        <time className="clock">{clock(t.serverNow)}</time>
        <button className="btn p" onClick={() => setTab("Calibration")}>Calibrate</button>
      </header>

      <nav className="n2" aria-label="Sections">
        {TABS.map((x) => {
          const c = counts[x];
          return (
            <a key={x} href={`#${slug(x)}`} aria-current={tab === x ? "page" : undefined} className={tab === x ? "on" : ""}
              onClick={(e) => { e.preventDefault(); setTab(x); }}>
              {x}
              {c != null && <span className={`cnt ${c.bad ? "bad" : ""}`}>{c.n ?? c}</span>}
            </a>
          );
        })}
        <span className="crumb">Estimates from BLE signal strength · updates about every second</span>
      </nav>

      <main className="main">
        {tab === "Map" && <MapTab t={t} sel={sel} onSelect={select} onOpen={open} onNavigate={setTab} />}
        {tab === "Assets" && <LiveView t={t} selected={sel?.id ?? null} onSelect={select} />}
        {tab === "Activity" && <ActivityTab t={t} onSelect={open} />}
        {tab === "Receivers" && <ReceiversTab t={t} onOpen={open} />}
        {tab === "Calibration" && <CalibrateTab t={t} defaultRx={defaultRx} defaultTag={sel || autoTag} />}
        {tab === "Settings" && <SettingsTab t={t} />}
      </main>
    </div>
  );
}
