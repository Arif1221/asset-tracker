# ADR-001: Where processing happens in the Asset Tracker

**Status:** Accepted
**Date:** 2026-11-20
**Deciders:** the developer (internship project)

## Context
ESP32 receivers scan BLE tags and push `{rssi, avg, pkts, ts}` (strongest and mean signal) once a second to Firebase Realtime Database (`/live/{rx}/{tag}`), plus a heartbeat (`/receivers/{rx}`). Field tests showed RSSI swings 5–15 dB at a fixed spot and does not follow distance beyond ~2 m in the test room. The system needs smoothing, zone choice, distance estimation with an honest range, calibration per receiver, history and alerts, on a free tier, built by one person.

## Decision
Keep receivers **thin** (report max RSSI per second) and do all interpretation **in the dashboard (browser)**. Configuration (names, positions, calibration, settings) lives in the database so it changes live without reflashing.

## Options considered

### A. Firmware does the math (distance on the ESP32)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cost | Free |
| Scalability | Poor: every calibration change needs a reflash per receiver |
| Familiarity | High (C++) |
**Pros:** less data sent. **Cons:** can't compare receivers (zone choice needs all of them), calibration is painful.

### B. Browser does the math (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | Free (Spark plan) |
| Scalability | Good to ~10 receivers × 50 tags per open dashboard |
| Familiarity | High (React, Firebase) |
**Pros:** live calibration and settings, one firmware for all boards, zone choice sees all receivers. **Cons:** history and activity exist only while a browser is open; every viewer computes the same thing.

### C. Cloud Functions do the math, write results back
| Dimension | Assessment |
|---|---|
| Complexity | Medium–High |
| Cost | Needs the Blaze (pay-as-you-go) plan |
| Scalability | Best; permanent history and server-side alerts |
**Pros:** persistent history, alerts with nobody watching. **Cons:** billing account, more moving parts for an internship prototype.

## Consequences
- Easier: adding devices (auto-discovered by MAC-based ID), calibrating tag/receiver pairs independently, tuning thresholds.
- Older receiver-wide `/calibration/{rx}` values remain readable as a fallback until each pair has its own profile.
- Harder: long-term history and alerts when no dashboard is open.
- Revisit: move to option C if the client needs permanent logs, e-mail/phone alerts, or more than ~10 receivers.

## Data model
| Path | Writer | Content |
|---|---|---|
| `/live/{rx}/{tag}` | receiver | `{rssi, avg, pkts, ts}` (server timestamp; `avg` from firmware 1.2) |
| `/receivers/{rx}` | receiver | `{lastSeen, ip, wifiRssi, fw}` every 10 s |
| `/devices/{id}` | dashboard | `{label}` |
| `/layout/{rx}` | dashboard | `{x, y}` metres from top-left |
| `/calibration/{rx}/tags/{tag}` | dashboard | `{mode, measure, tx, n, points: {m0, m0_5, m1, …: {rssi, samples, at}}, pointsOld?}` for this tag/receiver pair; `measure` is `"rssi"` (strongest, default) or `"avg"` and says which live value the points were captured with |
| `/settings/app`, `/settings/room` | dashboard | tunables, room size |

## Code map
- `src/hooks/useTracker.js`: all derived state (smoothing, zones, distance, history, activity).
- `src/lib/distance.js`: calibration model (saved-points table or formula), best-fit, distance range.
- `src/components/`: Radar, charts, top bar, tag panel/list, shared inputs.
- `src/tabs/Tabs.jsx`: Activity, History, Room, Receivers, Calibrate, Settings.

## Action items
1. [ ] Lock database rules before the demo (test mode is open to anyone with the URL).
2. [ ] Replace `setInsecure()` in firmware with the Google root certificate.
3. [ ] Decide with the client whether option C (persistent history, alerts) is needed.

## Addendum: zone map and settings (2026-11-23)
- `src/components/FloorPlan.jsx`: floor-plan zone map (Overview and Zone map tab). Receivers can be dragged to set `/layout/{rx}` (Zone map tab, "Edit receiver layout").
- New keys in `/settings/app` (all editable in Settings, defaults in `config.js`): `posPadM`, `posMinM`, `posMaxM` (uncertainty circle), `heatCellM` (heat cell size), `tieAbsM`, `tiePct` (zone tie margins, previously hard-coded in `useTracker.js`).
- Room size is `/settings/room/{w,h}`, editable in Settings or under the map (Edit room). Doors, gates, windows and furniture live in `/settings/room/features`; they are drawn for orientation only and do not affect distance or position estimates.
- `lib/position.js`: `bearing()` gives direction from the nearest receiver; it says "too close" when the distance is within the position error radius.
