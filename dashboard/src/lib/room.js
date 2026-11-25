/* Room features: doors, gates/openings and windows sit on a wall; furniture is a box.
   Stored at /settings/room/features/{id}:
     wall item: { type: "door" | "opening" | "window", wall: "top" | "right" | "bottom" | "left", at, len, label? }
     box:       { type: "block", x, y, w, h, label? }
   All values in metres; `at` runs from the wall's left end (top/bottom) or top end (left/right). */

export const WALL_TYPES = { door: "Door", opening: "Gate / opening", window: "Window" };
export const WALLS = { top: "Top", right: "Right", bottom: "Bottom", left: "Left" };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));

// Where a wall item lies: start point P, unit vector u along the wall, unit normal n into the room.
// Position and width are clamped so an item never runs past its wall, even after the room shrinks.
export function wallSpan(f, W, H) {
  const horiz = f.wall === "top" || f.wall === "bottom";
  const L = horiz ? W : H;
  const len = clamp(f.len, 0.1, L);
  const at = clamp(f.at, 0, L - len);
  const P = { top: [at, 0], bottom: [at, H], left: [0, at], right: [W, at] }[f.wall] || [at, 0];
  const u = horiz ? [1, 0] : [0, 1];
  const n = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[f.wall] || [0, 1];
  return { P, u, n, len, at };
}

// Door leaf hinged at P, drawn open 90° into the room. Returns points in metres plus the SVG sweep flag.
export function doorSwing(f, W, H) {
  const { P, u, n, len } = wallSpan(f, W, H);
  const end = [P[0] + u[0] * len, P[1] + u[1] * len];   // closed leaf tip
  const open = [P[0] + n[0] * len, P[1] + n[1] * len];  // open leaf tip
  // y grows downward, so a positive cross product is a clockwise turn from u to n
  const sweep = u[0] * n[1] - u[1] * n[0] > 0 ? 1 : 0;
  return { P, end, open, len, sweep };
}

export const clampBox = (f, W, H) => {
  const w = clamp(f.w, 0.1, W), h = clamp(f.h, 0.1, H);
  return { x: clamp(f.x, 0, W - w), y: clamp(f.y, 0, H - h), w, h };
};

// Grid step that keeps roughly 5-12 labelled lines across any room size
export const gridStep = (W, H) => { const m = Math.max(W, H); return m > 60 ? 10 : m > 25 ? 5 : m > 12 ? 2 : 1; };
