// Defaults. Every value in DEFAULTS is editable live in Settings (stored at /settings/app).
export const DEFAULTS = {
  maxRange: 4,       // radar range (m); beyond this a tag shows as "far"
  nearM: 0.3,        // below this a tag shows as "very near"
  smoothN: 3,        // trimmed mean of the last N readings (receivers report about every 1.3 s)
  spreadDb: 8,       // ± dB used for the "likely" distance range
  lostSec: 6,        // tag lost if no reading for N s; tolerates brief BLE scan gaps
  rxOfflineSec: 15,  // receiver offline if silent for N s
  historySec: 180,   // history window kept in the browser (s)
  captureSec: 5,     // calibration capture: collect readings for N s
  posStillM: 0.5,    // map: the dot holds still until the tag seems to move more than this (m)
  posSmooth: 0.5,    // map: 0 = dot jumps to every new fix, 0.9 = very steady but slow to follow
  posPadM: 0.5,     // map: added to the position fit error to draw the uncertainty circle (m)
  posMinM: 0.6,      // map: smallest uncertainty circle (m)
  posMaxM: 2.5,      // map: largest uncertainty circle (m)
  heatCellM: 0.25,   // map: heat layer cell size (m)
  tieAbsM: 0.5,      // zone choice: two receivers within this many m count as a tie
  tiePct: 25,        // zone choice: ...or within this % of the best distance, whichever is larger
};

export const SETTINGS_META = [
  { group: "Tracking", key: "maxRange", name: "Radar range", unit: "m", step: 0.5, min: 1 },
  { group: "Tracking", key: "nearM", name: "Show “very near” below", unit: "m", step: 0.1, min: 0 },
  { group: "Tracking", key: "smoothN", name: "Smoothing window", unit: "readings", step: 1, min: 1 },
  { group: "Tracking", key: "spreadDb", name: "Likely-range spread", unit: "± dB", step: 1, min: 0 },
  { group: "Tracking", key: "lostSec", name: "Mark tag lost after", unit: "s", step: 1, min: 1 },
  { group: "Tracking", key: "rxOfflineSec", name: "Mark receiver offline after", unit: "s", step: 1, min: 5 },
  { group: "Tracking", key: "historySec", name: "History window", unit: "s", step: 30, min: 60 },
  { group: "Tracking", key: "captureSec", name: "Calibration capture time", unit: "s", step: 1, min: 2 },
  { group: "Zone choice", key: "tieAbsM", name: "Tie margin (distance)", unit: "m", step: 0.1, min: 0 },
  { group: "Zone choice", key: "tiePct", name: "Tie margin (percent of distance)", unit: "%", step: 5, min: 0 },
  { group: "Map and position", key: "posStillM", name: "Hold still within", unit: "m", step: 0.05, min: 0 },
  { group: "Map and position", key: "posSmooth", name: "Position smoothing (0–0.95)", unit: "", step: 0.05, min: 0 },
  { group: "Map and position", key: "posPadM", name: "Uncertainty added to fit error", unit: "m", step: 0.1, min: 0 },
  { group: "Map and position", key: "posMinM", name: "Smallest uncertainty circle", unit: "m", step: 0.1, min: 0.1 },
  { group: "Map and position", key: "posMaxM", name: "Largest uncertainty circle", unit: "m", step: 0.5, min: 0.5 },
  { group: "Map and position", key: "heatCellM", name: "Heat layer cell size", unit: "m", step: 0.05, min: 0.05 },
];

// Fallback formula until a receiver is calibrated (Phase 1 measurements)
export const DEFAULT_CAL = { tx: -50.5, n: 5.76 };

// Calibration capture positions (0 = touching the receiver)
// Every whole metre up to the radar range, so a bigger room can be calibrated as far as it reaches
export const calDistances = (maxRange) =>
  [0, 0.5, ...Array.from({ length: Math.max(1, Math.ceil(maxRange)) }, (_, i) => i + 1)];
