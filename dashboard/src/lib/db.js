import { useEffect, useState } from "react";
import { ref, onValue, set, update } from "firebase/database";
import { db } from "../firebase";

// Subscribe to a Realtime Database path; returns its value (or the fallback when empty)
export function useDb(path, fallback = {}) {
  const [val, setVal] = useState(fallback);
  useEffect(() => onValue(ref(db, path), (s) => setVal(s.val() ?? fallback)), [path]);
  return val;
}

export const write = (path, value) => set(ref(db, path), value);
export const writeMany = (updates) => update(ref(db), updates); // multi-path atomic update

// Forget tags: their names and every receiver's live reading. Calibration stays, so a tag that comes back keeps it.
export const removeTags = (rxIds, tagIds) =>
  writeMany(Object.fromEntries(tagIds.flatMap((id) => [[`devices/${id}`, null], ...rxIds.map((rx) => [`live/${rx}/${id}`, null])])));
