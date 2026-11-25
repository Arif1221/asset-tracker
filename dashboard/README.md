# Asset Tracker Dashboard

React + Vite + Firebase Realtime Database dashboard for the BLE asset tracker.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in all five values
   (Firebase console → Project settings → Your apps → Web).
3. `npm run dev` → open the printed URL (usually http://localhost:5173).

## Deploy (Vercel)
Import the repo in Vercel, add the same `VITE_FB_*` variables under Environment Variables, deploy.

## Data model
| Path | Written by | Content |
|---|---|---|
| `/live/{RX}/{TAG}` | receiver firmware | `{rssi, avg, pkts, ts}`: strongest and mean signal of that second (`avg` from firmware 1.2), ts = server timestamp |
| `/receivers/{RX}` | receiver firmware (optional heartbeat) | `{lastSeen}` |
| `/devices/{ID}` | dashboard | `{label}` friendly name for tags and receivers |
| `/layout/{RX}` | dashboard | `{x, y}` receiver position in metres |
| `/calibration/{RX}/tags/{TAG}` | dashboard | Pair-specific `{mode, tx, n, points}` signal profile |
| `/settings/room` | dashboard | `{w, h}` room size in metres, plus `features/{id}`: doors, gates, windows on a wall `{type, wall, at, len, label}` or furniture `{type: "block", x, y, w, h, label}` |
| `/settings/app` | dashboard | Tracking thresholds and display settings |

## Rules
- Tag **LIVE** if updated in the last 6 s (Settings → "Mark tag lost after"), else **LOST**.
- Tag **zone** = fresh receiver with the shortest estimated distance using that tag/receiver pair’s calibration.
- Receiver **ONLINE** if anything from it in the last 15 s.
- New tags/receivers appear automatically as "New device – name it".
- Older receiver-wide calibration under `/calibration/{RX}` remains a fallback until each pair is calibrated.

## Self-checks

Run from `dashboard/` after changing the tracking math (no install needed):

```
node src/lib/distance.test.mjs
node src/lib/position.test.mjs
node src/lib/room.test.mjs
```
