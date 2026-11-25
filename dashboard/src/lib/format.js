export const ago = (ms) => {
  const v = Math.max(0, ms); // client/server clock jitter can make this slightly negative
  if (v < 60000) return `${Math.round(v / 1000)} s ago`;
  if (v < 3600000) return `${Math.round(v / 60000)} min ago`;
  return `${Math.round(v / 3600000)} h ago`;
};

export const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const dateTime = (ts) =>
  new Date(ts).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
