# BLE Asset Tracker

Track where things are in a room with small Bluetooth tags.

- **Tags** (`tag/`) are ESP32 boards that broadcast their name every 100 ms.
- **Receivers** (`receiver/`) are ESP32 boards that listen for the tags and send their signal strength to Firebase once a second.
- **Dashboard** (`dashboard/`) is a React app. It turns signal strength into distances, zones and a position on a floor plan, and handles calibration and room setup.

Signal strength gives an estimate, not an exact position: expect about ±0.5–1 m in the middle of the room with three receivers, and more near the walls.

## Quick start

**Dashboard**
1. `cd dashboard && npm install`
2. Copy `.env.example` to `.env` and fill in your Firebase web app values.
3. `npm run dev`

**Receiver firmware** (Arduino IDE, ESP32 board package 3.x)
1. Copy `receiver/secrets.example.h` to `receiver/secrets.h` and fill in Wi-Fi (2.4 GHz only) and the database URL.
2. Board: ESP32 Dev Module. **Tools → Partition Scheme → Huge APP**. The default scheme is too small.
3. Upload. The Serial Monitor (115200 baud) should show `PATCH 200` about once a second.

**Tag firmware**: upload `tag/tag.ino`. It prints its `TAG_xxxxxx` ID on the Serial Monitor.

## More
- `handover.md`: how the whole system works, the data layout, the settings and troubleshooting.
- `dashboard/README.md`: dashboard details and self-checks.
- `TODO.md`: open work.

`.env` and `receiver/secrets.h` are git-ignored. Never commit them.
