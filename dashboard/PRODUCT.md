# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primarily the developer, building and calibrating the system on a laptop next to the hardware. Secondary: the supervisor and the client watching a live demo of the prototype.

## Product Purpose
A BLE asset-tracking prototype. ESP32 tags advertise, ESP32 receivers report RSSI to Firebase, and this dashboard turns those readings into the nearest receiver (zone), an estimated distance and, with 3+ placed receivers, an approximate 2D position. Success: in a demo, anyone can see at a glance where each tag is and how sure the system is; while building, calibration and receiver setup are quick.

## Positioning
Honest about uncertainty: per receiver–tag calibration, zone hysteresis, and a solver that shows no point when the geometry cannot support one. Estimates are labelled as estimates, never as exact positions.

## Operating Context
Laptop on a desk in one room (default 5 × 5 m) with 3 receivers and a few tags. Readings arrive about once a second; a moved tag takes about 8–12 s to change zone. Data lives in Firebase Realtime Database.

## Capabilities and Constraints
- Sections: overview, assets (detail, history charts), signal per receiver, activity log, zone map, receivers (names, positions), calibration (capture per pair), settings.
- The room map with tags is the primary view.
- React + Vite, no UI library. Deep links by URL hash.
- Not real-time; RSSI distance is approximate.

## Evidence on Hand
Live Firebase data from real tags and receivers. No customer data, testimonials or logos.

## Product Principles
1. Where is it, and how sure are we: every location comes with its confidence.
2. The map is home; setup tools are one step away, not in the way.
3. Show nothing rather than something wrong.
4. Plain words for a demo audience; numbers in metres and dBm with units.
