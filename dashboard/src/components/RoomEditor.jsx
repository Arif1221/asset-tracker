import { write } from "../lib/db";
import { WALLS, WALL_TYPES } from "../lib/room";
import { EditNum, EditText } from "./ui";

const NEW = {
  door: { type: "door", wall: "top", at: 0.5, len: 0.9, label: "Door" },
  opening: { type: "opening", wall: "bottom", at: 1, len: 2, label: "Gate" },
  window: { type: "window", wall: "right", at: 1, len: 1.2, label: "Window" },
  block: { type: "block", x: 1, y: 1, w: 1.2, h: 0.6, label: "Table" },
};

/* Room size and features, edited in place under the map. Every change saves to
   /settings/room, so all open dashboards redraw at once. */
export function RoomEditor({ t }) {
  const { W, H, features } = t.room;
  const base = "settings/room/features";
  const set = (id, key, v) => write(`${base}/${id}/${key}`, v);
  const add = (kind) => write(`${base}/${Date.now().toString(36)}`, NEW[kind]);
  const list = Object.entries(features).sort(([a], [b]) => a.localeCompare(b));
  const along = (wall) => (wall === "left" || wall === "right" ? "from top" : "from left");

  return (
    <div className="fp-edit">
      <div className="fp-edit-size">
        <b>Room size</b>
        <label>Width <EditNum value={W} step={0.1} min={1} onSave={(v) => write("settings/room/w", v)} ariaLabel="Room width" /> m</label>
        <label>Length <EditNum value={H} step={0.1} min={1} onSave={(v) => write("settings/room/h", v)} ariaLabel="Room length" /> m</label>
      </div>

      <div className="table-wrap">
        <table className="table stack-sm">
          <thead><tr><th>Name</th><th>Type</th><th>Where</th><th>Size</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="empty">No doors, windows or furniture yet. Add them below so the map matches the real room.</td></tr>}
            {list.map(([id, f]) => (
              <tr key={id}>
                <td><EditText value={f.label} placeholder="Name" ariaLabel="Feature name" onSave={(v) => set(id, "label", v || null)} /></td>
                <td>
                  {f.type === "block" ? "Furniture" : (
                    <select value={f.type} aria-label="Type" onChange={(e) => set(id, "type", e.target.value)}>
                      {Object.entries(WALL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                </td>
                <td className="nowrap">
                  {f.type === "block" ? (
                    <>x <EditNum value={f.x} step={0.1} min={0} ariaLabel="From left wall" onSave={(v) => set(id, "x", v)} /> y <EditNum value={f.y} step={0.1} min={0} ariaLabel="From top wall" onSave={(v) => set(id, "y", v)} /> m</>
                  ) : (
                    <>
                      <select value={f.wall} aria-label="Wall" onChange={(e) => set(id, "wall", e.target.value)}>
                        {Object.entries(WALLS).map(([k, v]) => <option key={k} value={k}>{v} wall</option>)}
                      </select>{" "}
                      <EditNum value={f.at} step={0.1} min={0} ariaLabel={`Position ${along(f.wall)}`} onSave={(v) => set(id, "at", v)} /> m {along(f.wall)}
                    </>
                  )}
                </td>
                <td className="nowrap">
                  {f.type === "block" ? (
                    <><EditNum value={f.w} step={0.1} min={0.1} ariaLabel="Width" onSave={(v) => set(id, "w", v)} /> × <EditNum value={f.h} step={0.1} min={0.1} ariaLabel="Depth" onSave={(v) => set(id, "h", v)} /> m</>
                  ) : (
                    <><EditNum value={f.len} step={0.1} min={0.1} ariaLabel="Width" onSave={(v) => set(id, "len", v)} /> m wide</>
                  )}
                </td>
                <td className="r"><button className="btn quiet" onClick={() => write(`${base}/${id}`, null)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fp-edit-add">
        <button className="btn" onClick={() => add("door")}>+ Door</button>
        <button className="btn" onClick={() => add("opening")}>+ Gate / opening</button>
        <button className="btn" onClick={() => add("window")}>+ Window</button>
        <button className="btn" onClick={() => add("block")}>+ Furniture</button>
      </div>
      <p className="hint">Positions are in metres, measured along the wall from its left or top end. Walls and furniture are drawn for orientation only; they don’t change the distance estimates.</p>
    </div>
  );
}
