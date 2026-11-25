# Asset Tracker — Project Handover

**Prepared:** 23 November 2026  
**Project root:** `D:\Projects\Assest tracking`  
**Current status:** BLE tags are being received and pair-specific calibration is available. The dashboard now applies a longer RSSI smoothing window and waits for stable evidence before changing a tag’s zone.

## 1. Purpose and current behavior

This is a small BLE asset-tracking prototype. Battery-powered ESP32 tags advertise their IDs. ESP32 receivers scan for those advertisements and write signal readings to Firebase Realtime Database. The React dashboard subscribes to those records and estimates distance, nearest receiver, zone, and—when receiver geometry supports it—an approximate 2D position.

RSSI is affected by walls, people, antenna orientation, reflections, and interference. The displayed distances and positions are estimates. A calibrated distance can help choose the nearest receiver, but a single receiver cannot determine direction. Two receivers still leave two possible sides; the position solver requires at least three usable, non-collinear receiver positions.

## 2. Repository layout

```text
Assest tracking/
├── dashboard/                  React + Vite + Firebase web app
│   ├── src/
│   │   ├── components/          Map, zone board, charts, assets, UI controls
│   │   ├── hooks/useTracker.js  Live subscriptions and derived tracking state
│   │   ├── lib/                 Firebase access, distance and position math
│   │   ├── tabs/Tabs.jsx        Overview, receivers, calibration, settings, etc.
│   │   ├── App.jsx              Navigation and page composition
│   │   └── config.js            Defaults and editable setting definitions
│   ├── .env.example             Firebase web configuration template
│   ├── package.json
│   └── DESIGN.md                Existing visual direction and map conventions
├── receiver/receiver.ino        ESP32 receiver firmware 
├── tag/tag.ino                  ESP32 BLE advertising firmware
├── Asset-tracking-project.zip   Source archive; excludes local env/dependencies
└── handover.md                  This document
```

The receiver folder is named `receiver` (renamed from the old `reciever` spelling).

## 3. Run the dashboard locally

From `dashboard/`:

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in the Firebase web app values in `.env` (`VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_DATABASE_URL`, `VITE_FB_PROJECT_ID`, and `VITE_FB_APP_ID`).
4. Start the Vite server with `npm run dev` and open the URL it prints, usually `http://localhost:5173`.
5. Create a production build with `npm run build`; preview it with `npm run preview` if needed.

The dashboard intentionally reports missing Firebase variables rather than allowing the Firebase SDK to fail during startup. `.env` is local configuration and must not be copied into a public archive. Vercel deployment also needs the same `VITE_FB_*` values in its environment-variable settings.

## 4. Firmware and device IDs

### Tag firmware

`tag/tag.ino` derives a stable `TAG_XXXXXX` ID from the ESP32 MAC, advertises that ID as the BLE device name, sets advertising power to `ESP_PWR_LVL_P9`, and advertises at a nominal 100 ms interval. It prints the ID to Serial every five seconds.

### Receiver firmware

`receiver/receiver.ino` derives an `RX_XXXXXX` ID from the receiver MAC, connects to Wi-Fi, and scans BLE advertisements for names beginning with `TAG_` **continuously in the background**; uploads run on a one-second timer without pausing the scan (firmware 1.1 paused scanning during each upload, which cost about a quarter of all packets). For each tag heard in that second, it reports the **strongest packet** (`rssi`), the **mean of all packets** (`avg`, firmware 1.2+), the packet count, and a Firebase server timestamp. `avg` does not get stronger just because more packets were caught, so receivers that hear fewer packets aren't biased toward "farther". It sends a receiver heartbeat about every ten seconds with last-seen time, IP, Wi-Fi RSSI, and firmware version (`1.3`). Since 1.3 it also restarts itself after 2 minutes of failed uploads, frees a tag's slot after 60 silent seconds (so a new tag is never locked out by the 16-tag limit), and ignores nameless Bluetooth devices before doing any work.

`tag/tag.ino` advertises its `TAG_XXXXXX` name every 100 ms at +9 dBm as a broadcast-only (non-connectable) beacon.

**Signal measure per pair.** Each calibration pair stores `measure` (`"rssi"` = strongest, the default for old calibrations, or `"avg"`). The dashboard reads that number from live readings, so existing calibrations keep working after a firmware update. Capturing a point while the receiver sends `avg` switches the pair to `"avg"`; if the pair had strongest-signal points, they move to `pointsOld` (kept, not deleted) and the other distances must be captured again.

The receiver reports measurements; distance and zone calculations stay in the browser. Keep this measurement method consistent with calibration: changing from per-scan peak RSSI to a different statistic would change the signal distribution and could invalidate saved calibration points.

### Firmware setup and security notes

- The receiver source currently contains Wi-Fi configuration directly in the sketch. Do not publish those values. Move them to a private configuration file or a provisioning flow before sharing source publicly.
- TLS verification is disabled in the receiver (`setInsecure()`). This is convenient for the prototype but does not authenticate the database server. Replace it with the appropriate trusted root certificate before production use.
- Firebase web configuration is supplied through `.env`; database authorization still depends on Realtime Database security rules. No rules file is present in this project tree, so confirm the rules in Firebase Console. Do not leave an open/test-mode database for real assets.
- `arduino-cli` was not available in the inspected environment. The firmware source has not been compiled as part of this handover.

## 5. Firebase Realtime Database schema

| Path | Writer | Purpose / shape |
|---|---|---|
| `/live/{RX}/{TAG}` | Receiver firmware | Latest reading: `{ rssi, avg, pkts, ts }` (`avg` from receiver firmware 1.2); `ts` is a server timestamp. The receiver only patches a tag when it heard it during that scan, so an old value remains until it ages out in the dashboard. |
| `/receivers/{RX}` | Receiver firmware | Heartbeat: `{ lastSeen, ip, wifiRssi, fw }`, roughly every 10 seconds. |
| `/devices/{ID}` | Dashboard | Friendly `label` and optional `zoneLabel` for tags or receivers. |
| `/layout/{RX}` | Dashboard | Saved receiver position `{ x, y }` in metres, from the room’s left and top walls. |
| `/calibration/{RX}/tags/{TAG}` | Dashboard | Pair-specific signal profile: mode, optional formula values, and distance points. |
| `/calibration/{RX}` | Legacy data | Older receiver-wide profile used as a fallback when a tag/receiver pair has no pair-specific profile. |
| `/settings/room` | Dashboard | Room width and height in metres (`w`, `h`), defaults 5 × 5 m; `features/{id}` holds doors, gates, windows (on a wall) and furniture boxes, drawn on the map only. |
| `/settings/app` | Dashboard | Tracking thresholds and display parameters; saved values override defaults in `src/config.js`. |

Firebase’s `.info/connected` and `.info/serverTimeOffset` paths are also subscribed to by the dashboard for connection status and server-synchronized time.

## 6. Distance, calibration, and zone logic

### Per-pair calibration

Each tag/receiver combination has its own profile at `/calibration/{RX}/tags/{TAG}` because different receivers and tags can have different RSSI characteristics. The Calibration page captures readings at 0, 0.5, 1, 2, 3, and 4 metres. A capture runs for the configured interval (default five seconds) and saves the median of the received readings at that distance.

In **Saved points** mode, the app uses a monotonic piecewise-linear table between captured points. A reading weaker than the farthest captured point is treated as beyond the calibrated range. In **Formula** mode, distance is estimated from `tx` and path-loss exponent `n`. The page can suggest a least-squares formula fit from saved points at 0.5 metres and farther. Missing pair profiles can fall back to a legacy receiver-wide profile or the default formula; the Receivers page reports which situation applies.

To calibrate reliably, keep the receiver fixed, place only the selected tag at the named distance, avoid people standing between/near the radio path, wait for fresh readings, and capture every useful distance for each tag/receiver pair. Recalibrate if the hardware, antenna orientation, receiver placement, or firmware RSSI measurement method changes.

### Smoothing and zone stability

`src/hooks/useTracker.js` keeps a short RSSI history per receiver/tag and uses a median to reduce spikes before converting RSSI into distance. The current defaults in `src/config.js` are:

| Setting | Default | Effect |
|---|---:|---|
| `smoothN` | 3 readings (≈4 s) | Trimmed mean (drops the top and bottom quarter) per receiver/tag. More smoothing is steadier but slower to react. |
| `lostSec` | 6 s | Time without a fresh reading before a tag is marked lost. |
| `rxOfflineSec` | 15 s | Time without receiver activity before it is marked offline. |
| `maxRange` | 4 m | Display limit for calibrated distance. Raise it for rooms bigger than 4 m; the Calibration tab then offers a capture point at every whole metre up to it, and saved-point models extend past the last point along the best-fit curve. |
| `nearM` | 0.3 m | Below this, distance is shown as very near. |
| `spreadDb` | ±8 dB | RSSI spread used to show a likely distance range. |
| `historySec` | 180 s | In-browser chart history window. |
| `captureSec` | 5 s | Duration of one calibration capture. |
| `tieAbsM` / `tiePct` | 0.5 m / 25% | Receiver distance margin for an uncertain zone. |
| `posPadM` / `posMinM` / `posMaxM` | 0.5 / 0.6 / 2.5 m | Bounds for the displayed position-uncertainty radius. |
| `posSmooth` | 0.5 | Map dot moves 50% of the way to each new position fix, so it glides instead of jumping. 0 = no smoothing; higher = steadier but slower to follow a moving tag. |
| `posStillM` | 0.5 m | The dot stays put until the smoothed position moves more than this, so a resting tag looks still. The solver also keeps the answer nearest the last position unless another fits at least 30% better, so it no longer flips between two mirror-image spots. With these defaults a moved tag's dot is 90% of the way there within about 3.5–5 s (noise-free simulation). |
| `heatCellM` | 0.25 m | Cell size for the optional map heat layer. |

Stored values under `/settings/app` override those defaults. If an earlier setting was saved there, changing the default in `config.js` alone will not replace it; change it in Settings or use “Reset all settings to defaults.”

The README’s older rules section still says a tag becomes lost after three seconds. The current source default is six seconds; an explicit saved `/settings/app/lostSec` value overrides it.

The nearest zone is selected by **shortest calibrated distance**, not strongest RSSI, because receiver calibrations are independent. If another receiver becomes clearly closer, the dashboard waits for three distinct reading scans before switching the displayed zone. During that settling period it marks the zone uncertain and shows candidate receivers. When estimates are within the tie margin, the zone remains uncertain rather than claiming a confident winner.

### 2D positioning and map meaning

`src/lib/position.js` estimates coordinates only when at least three fresh, calibrated receiver distances are usable, their saved positions are non-collinear, and the resulting estimate falls inside the configured room. Placeholder receiver spots do not count toward a position. A single very-near receiver can pin the estimate to that receiver; otherwise closer receivers receive more weight because RSSI distance error generally grows with distance.

The map is bounded by `/settings/room`; it represents the physical room and does not automatically expand. A calculated point more than 0.5 m outside the configured room is rejected (closer ones are clamped to the wall) and the map explains that the room dimensions or receiver positions should be checked. When direction is unknown, a hollow marker is placed around the closest receiver for visual separation; its angle is a display choice, **not a measured bearing**. Do not read that marker as an exact tag location.

The shaded receiver areas are geometric nearest-receiver regions (Voronoi regions) clipped to the room. Live zone assignment is based on calibrated RSSI distance, so RF effects can make a tag’s assigned zone differ from the map’s geometric area. The map’s heat layer is an in-memory visualization for located tags and resets when the page reloads.

## 7. Dashboard pages and routine tasks

- **Overview:** Summary metrics, zone map, asset-by-zone list with estimated distances, recent activity, and calibration coverage.
- **Assets:** Search and filter tags; inspect each receiver’s estimate; open a tag for details, activity, and short in-browser history.
- **Signal:** Per-tag RSSI and distance for the receiver selected in the global summary bar.
- **Activity:** Found/lost/back/moved and receiver status changes since the page was opened.
- **Zone map:** Room map, zone board, selected-asset receiver distances, room dimensions, and receiver-layout editing.
- **Receivers:** Rename devices and zones, set receiver coordinates, inspect heartbeat/network values and calibration coverage, or remove a receiver.
- **Calibration:** Select one receiver and one tag, choose table or formula mode, capture distance points, and inspect the live smoothed signal/distance.
- **Settings:** Room dimensions and live thresholds. Settings are saved to Firebase and apply without reflashing.

### Set receiver positions

Open **Zone map** and enable **Edit receiver layout** to drag each receiver to its real location. The map also offers keyboard movement when a receiver marker is focused. Alternatively, enter `x` and `y` in Receivers. If positions are still placeholders, use the map’s “Place receivers on the map” or “Save the spots shown” actions; saved placeholders are useful only for layout tests, not accurate positioning.

### Rename discovered hardware

New tags and receivers appear from their MAC-derived IDs. Set a friendly label under Assets or Receivers. Optional zone labels are also editable in Receivers. Calibration records remain keyed by the underlying IDs, so renaming a tag does not move its calibration profile.

## 8. Known limitations and troubleshooting

### Tag repeatedly switches between live and lost

Check that the receiver is online and that `/live/{RX}/{TAG}/ts` continues updating. A receiver sends no new record for a tag it did not hear during the scan, so poor RF reception or a stalled Wi-Fi/Firebase patch can age the previous timestamp. Check `settings/app/lostSec`; a saved value can override the six-second default. Review the receiver Serial Monitor for Wi-Fi skips and non-success PATCH codes.

### Distance or zone still looks noisy

BLE RSSI can move several dB without physical movement, especially around walls, bodies, and reflective surfaces. Confirm that every tag/receiver pair has its own useful calibration points and that the saved points generally weaken with distance. Keep receivers fixed. Increase `smoothN` for steadier readings (with slower response), and adjust the tie margins if boundary classifications are too eager. Do not compare raw dBm across receivers as if their hardware and calibration were identical.

### Tag appears near a receiver but has no 2D position

This is expected with fewer than three usable non-collinear receivers. Check that at least three receivers are online, their actual positions are saved, and each can produce a calibrated distance for the tag. Weak/out-of-range readings do not count as usable distances. A ring/hollow marker indicates distance without direction.

### Position estimate falls outside the map

Confirm the configured room width/length and the measured receiver coordinates in metres. The solver rejects out-of-room solutions rather than enlarging the physical room to fit a noisy estimate. The map’s shaded zones use receiver geometry; tag zone assignment uses calibrated distance.

### Blank dashboard or no Firebase updates

Check that `dashboard/.env` has all required web config values, that the browser can reach Firebase, and that Realtime Database rules permit the intended reads/writes. Never solve a rules issue by leaving the database public; set rules to the intended access model.

### Data retention

Tag history and activity are derived in browser memory while the dashboard is open. They are not durable event logs and reset on reload. The live readings, labels, calibration, layout, room settings, and app settings are stored in Firebase. Persistent history or alerts without an open dashboard would need backend processing (for example, a Cloud Function) and a separate retention plan.

## 9. Validation and suggested next steps

- `npm run build` passed after the recent dashboard stability changes.
- No automated test suite is defined in `dashboard/package.json`.
- Receiver firmware was inspected, but could not be compiled in this environment because `arduino-cli` was not available.
- Before field use, verify Firebase security rules and replace insecure TLS with certificate validation. Wi-Fi name, password and database URL live in `receiver/secrets.h` (git-ignored; copy `receiver/secrets.example.h`).
- Field-check zone settling, lost timeout, distance errors, room bounds, and all relevant tag/receiver calibration pairs with fixed receiver positions. Record the conditions for repeatable calibration.

