# TODO

Open work, most useful first.

## Hardware and firmware
- [ ] **Flash R1 (`RX_8635D4`) to receiver firmware 1.3.** R2 and R3 already run it. Use the Huge APP partition scheme.
- [ ] **Tag sketch: set transmit power.** The NimBLE `tag/tag.ino` dropped the +9 dBm setting. Add `NimBLEDevice::setPower(9);` after `NimBLEDevice::init("")`, or every distance reads too far. Then compile it (needs the NimBLE-Arduino library) and flash every tag.
- [ ] **Label the boards with their IDs.** The board labelled R1 is `RX_860108`, which the dashboard calls R2. Rename in the dashboard's Receivers tab, or re-sticker the boards.
- [ ] **Wi-Fi coverage.** Receivers only use 2.4 GHz. R3 dropped off at −77 dBm Wi-Fi. Keep the hotspot or router close, and turn off hotspot auto-off.
- [ ] **Tag battery life.** Tags never sleep, so they only run on USB power. Add light sleep between broadcasts before using coin cells.

## Calibration and accuracy
- [ ] **Recalibrate every receiver–tag pair on firmware 1.3**, with each receiver mounted where it will stay. A pair switches to the steadier average signal on its first new capture; older points are kept under `pointsOld`.
- [ ] **TAG_616838 has only 0 m and 1 m points**, so it can't be measured beyond 1 m. Capture 2, 3 and 4 m too.
- [ ] **Carry test.** Walk Tag 1 between two known spots and time how long the dot takes to follow. The 3.5–5 s figure comes from simulation only.
- [ ] **Fourth receiver.** With three receivers, some spots in the 8 × 5 m room fit two positions almost equally. A receiver in the lower-right or the middle removes that.

## Security (before the field or a public repo)
- [ ] **Firebase rules are in test mode.** Anyone with the database URL (it ships inside the dashboard) can read, change or delete everything. Add rules plus authentication for the dashboard and the receivers.
- [ ] **Receivers skip TLS certificate checks** (`tls.setInsecure()`). Pin the Firebase root certificate.

## Code
- [ ] The "No direction yet" message (`whyNoPosition`) doesn't know that a weakly-heard receiver now helps place a tag, so it can blame the wrong cause.
- [ ] The zone-switching rule (wait for 3 scans before changing zone) has no self-check.
- [ ] The Impeccable design tooling reports setup issues: run `/impeccable doctor`.

## Repo
- [ ] Create the GitHub repository (private is safest until security is done) and push `main`.
