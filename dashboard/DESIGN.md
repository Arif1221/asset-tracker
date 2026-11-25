---
name: Asset Tracker
description: One-screen BLE asset tracking console built from tight, ruled modules.
colors:
  ink: "#111316"
  ink-2: "#4F555D"
  ink-3: "#6B7179"
  paper: "#FFFFFF"
  grey: "#E6E8EB"
  grey-2: "#F3F4F6"
  line: "#C9CDD3"
  red: "#D7261E"
  red-ink: "#B01E17"
  red-tint: "#FCEBEA"
  ok: "#1E7F3C"
  ok-tint: "#E6F3EA"
  warn: "#9A6412"
  warn-tint: "#FBF1DF"
  focus: "#1D5FD1"
  sel: "#EAF1FC"
typography:
  figure:
    fontFamily: "Noto Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 900
    lineHeight: 1.1
  brand:
    fontFamily: "Noto Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 900
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Noto Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  body:
    fontFamily: "Noto Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Noto Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  module-tab:
    fontFamily: "Noto Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.06em"
  micro:
    fontFamily: "Noto Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  none: "0px"
spacing:
  gap: "8px"
  cell: "10px"
  row: "5px 8px"
components:
  module:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
  module-head:
    backgroundColor: "{colors.grey}"
    height: "28px"
  module-tab:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
    typography: "{typography.module-tab}"
    padding: "0 10px"
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: "28px"
    padding: "0 12px"
  button-hover:
    backgroundColor: "{colors.grey}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    height: "28px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "#2E3238"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
  button-danger-hover:
    backgroundColor: "{colors.red-ink}"
  nav-tab:
    backgroundColor: "{colors.grey}"
    textColor: "{colors.ink}"
    height: "34px"
    padding: "0 16px"
  nav-tab-active:
    backgroundColor: "{colors.paper}"
  count-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "0 5px"
  count-badge-bad:
    backgroundColor: "{colors.red}"
  status-chip-lost:
    backgroundColor: "{colors.red}"
    textColor: "{colors.paper}"
    padding: "0 6px"
  pill:
    backgroundColor: "{colors.paper}"
    height: "26px"
    padding: "0 10px"
  pill-bad:
    backgroundColor: "{colors.red-tint}"
    textColor: "{colors.red-ink}"
  input-inline:
    backgroundColor: "transparent"
    padding: "3px 6px"
---

# Design System: Asset Tracker

## Overview

**Creative North Star: "The Ruled Control Sheet"**

Everything that matters sits on one screen, packed into tight modules ruled off by hairlines, the way a dense Japanese portal or a printed control sheet packs a page. White ground, black ink, cool grey heads, and one utility red that marks module tabs, the active section and anything lost. The density is the point: an operator should read where every tag is, which receivers are up and what just happened without scrolling or opening a panel.

Surfaces are flat paper. Structure comes from rules (1px hairlines, 1px black rules under table heads and the top bar) and from grey fills, never from shadow, blur, translucency or rounding. Figures are set heavy (900) so counts read from across a room; everything else is 12 to 13px.

This world replaced an earlier frosted-glass direction. Nothing from it carries over except the map conventions in Components.

**Key Characteristics:**
- Square corners everywhere; the only round shapes are 7-8px status dots and map tag dots.
- Every module wears a solid red tab head on a grey strip.
- Section tabs carry live counts; a count turns red when something is wrong.
- Numbers use tabular figures throughout.
- No shadows, no blur, no gradients.

## Colors

A white-and-ink sheet with cool greys for structure and a single utility red reserved for structure markers and the lost state.

### Primary
- **Utility Red** (red): module tab heads, the 3px cap on the active nav tab (2px on sub-tabs), lost tags on the map, lost status chips, red count badges, offline receivers, destructive buttons, the brand full stop, text selection.
- **Deep Red Ink** (red-ink): red text on white or on Red Tint (lost labels, "Reconnecting" pill), and danger-button hover.
- **Red Tint** (red-tint): fill behind a bad pill.

### Neutral
- **Ink** (ink): body text, primary button fill, 1px rules under the top bar and table heads, map receivers and located tags, the floor outline.
- **Graphite** (ink-2): secondary text, table head text, module meta, zone names.
- **Slate** (ink-3): labels, ticks, placeholders, distance rings. 4.9:1 on white, the floor for any readable text.
- **Paper** (paper): page ground, module bodies, the map floor.
- **Head Grey** (grey): module head strips, nav row, button hover, row dividers inside tables and lists, bar tracks, map grid.
- **Quiet Grey** (grey-2): row hover, readout cells, card heads in the zone board.
- **Hairline** (line): module borders, cell rules, quiet button and input borders.

### State
- **Tracking Green** (ok) with **Green Tint** (ok-tint): online, tracking, best receiver row.
- **Ambiguous Amber** (warn) with **Amber Tint** (warn-tint): uncertain zone, out-of-range band on charts, attention notes. Amber means "uncertain", never "lost".
- **Focus Blue** (focus): focus outline, links, receiver drag handle. **Selection Blue** (sel): selected rows, focused-input halo.

### Named Rules
**The Red Means Structure Or Lost Rule.** Red marks module tabs, the active section, lost tags, offline receivers and destructive actions. It never decorates, and it never marks "uncertain" (that is amber).

**The Grey Zones Rule.** Map zones are tinted only in ink greys (#4F555D, #111316 at 6% fill, 35% stroke). Colour on the map belongs to state: amber for ambiguous, red for lost.

## Typography

**Body Font:** Noto Sans 400/500/700/900 (Google Fonts), falling back to system-ui, Segoe UI, sans-serif
**Mono Font:** ui-monospace, Cascadia Mono, Consolas, for tag IDs only

**Character:** One plain humanist sans at small sizes, with figures pushed to 900 weight so numbers carry the page. Tabular numerals on the body.

### Hierarchy
- **Figure** (900, 28px, 1.1): KPI strip counts and readout cells; 36px for the live calibration reading, 20px for zone card counts. Units beside a figure drop to 15px 700 in Slate.
- **Brand** (900, 20px, -0.02em): the wordmark only.
- **Title** (700, 15-18px): selected tag name, expanded row name, clock (18px).
- **Body** (400, 13px, 1.5): tables, lists, settings.
- **Label** (700, 12px): table heads, buttons, pills, legends and hints at 400.
- **Module Tab** (700, 12px, 0.06em, uppercase): only inside the red module tab and the in-module sub-head rule.
- **Micro** (400, 11px): ID sub-lines, chart ticks, map sub-labels, count badges at 700.

### Named Rules
**The Heavy Figures Rule.** A number an operator reads at a glance is 900 weight; prose and labels never are.

## Layout

A full-width app with no max width. The top is a two-row nav: a 48px bar (brand, room size, live pill, receivers-online pill, clock, Calibrate) ruled off in ink, then a 34px grey row of section tabs with counts and a right-aligned note on how estimates are made.

The main area pads 8px, and every module gap is the same 8px. The Map section is a mosaic: the map module spans the left column at full height (min 420px, 1.15fr), assets (count strip plus table) spans the top right, then selected tag beside activity, receivers beside calibration, and zones across the full width. Modules pad 10px; table cells pad 5px 8px.

Responsive: below 1240px the mosaic becomes two columns; below 900px everything stacks to one column, the top bar wraps, module meta hides, the KPI strip becomes 2x2 and wide tables restack into ruled blocks with inline labels; below 480px non-alert pills hide and the nav becomes a 3-column grid of tabs.

## Elevation & Depth

Flat. There is no elevation shadow, blur or translucency anywhere. Depth is tonal and ruled: grey heads over white bodies, hairline borders, 1px ink rules where a stronger division is needed. The only `box-shadow` uses are non-elevating: the inset red cap on active tabs and the 2px Selection Blue halo on a focused input.

### Named Rules
**The Paper Sheet Rule.** If a surface needs to stand apart, give it a hairline or a grey fill, never a shadow.

## Shapes

Square corners (0px) on every module, button, input, pill, badge, chip, avatar and progress bar. Circles are reserved for meaning: status dots (7-8px), map tag dots and uncertainty circles. Lost tags are squares, so shape alone separates "lost" from "located".

## Components

### Module (signature)
The building block of every screen: a hairline-bordered white box with a 28px grey head strip. The title sits in a solid red tab flush left (white, 12px uppercase, 0.06em); an optional sub-label in the tab drops to sentence case at 400. Meta and actions sit right-aligned in Graphite. Body pads 10px with 10px gaps; tables inside a module run edge to edge.

### Navigation
- **Top bar:** 48px, white, ink rule below.
- **Section tabs:** grey row, tabs divided by hairlines, 500 weight. Hover lightens to Quiet Grey. Active is white, 700, with a 3px red inset cap on top. Each tab carries a square count badge (ink, or red with text like "2 lost" when something is wrong).
- **Sub-tabs** (in an expanded asset row) repeat the pattern with a 2px cap.

### Buttons
- **Shape:** square (0px), 28px tall, 12px 700, padding 0 12px, 150ms background and colour transition.
- **Default:** white with an ink border; hover fills Head Grey.
- **Primary:** ink fill, white text; hover #2E3238. Used for the one main action in a context (Calibrate).
- **Quiet:** hairline border; hover borders in ink.
- **Danger:** red fill, appears only after a two-step confirm (first click arms, second confirms, Cancel beside it).
- **Disabled:** 40% opacity.

### Pills and status
- **Pill:** 26px, hairline border, 12px 700, a status dot before the word. Bad pills turn Red Tint with Deep Red Ink and a red border.
- **Status:** coloured dot plus a word ("Online", "Offline").
- **Status chip:** 11px uppercase outline chip in state colour; Lost is solid red with white text.

### Tables
Ink rule under the head row, Head Grey dividers between rows, Quiet Grey row hover, Selection Blue for the selected row, Green Tint for the best receiver. Tag IDs in mono 12px Graphite.

### Inputs / Fields
- **Inline edit:** borderless until hover (hairline), ink border plus a 2px Selection Blue halo on focus; saves on Enter or blur. Number edits are 76px, right-aligned, always bordered.
- **Select / search:** 28px, hairline border, ink on hover or focus.
- **Segmented control:** hairline-ruled; the active segment is solid ink with white text.

### Floor plan
- **Room and zones:** white floor with a 2px ink outline and a Head Grey 1m grid. Zones are closest-receiver regions clipped to the room, tinted in greys only.
- **Receivers:** ink squares; offline is a white square with a red outline; unplaced is dashed.
- **Located tag:** ink dot with a white edge and a dashed uncertainty circle, radius = fit error + 0.5 m, clamped to 0.6-2.5 m (configurable in Settings).
- **Distance-only tag:** hollow marker on a dashed Slate ring around its nearest receiver; distance known, direction unknown.
- **Ambiguous zone:** the dot, ring or circle turns amber.
- **Lost tag:** a 10px red square inside a dashed red ring, placed beside the receiver it was last nearest to and labelled "Lost · last near X". It is never drawn as a located point.
- **Selected tag:** red 3px stroke and a sub-label with error radius and bearing.
- **Heat layer:** optional, time spent per 0.25 m cell, kept in this browser's memory only.
- **Labels:** 12px 700 with a white halo stroke so they read over the grid.
- **Room features** (architectural plan conventions, ink only): a door is a gap in the wall with a 2px leaf and a dashed Slate swing arc; a gate/opening is a gap with two short jambs; a window is a gap crossed by two 1px parallel lines; furniture is a Head Grey box with a Slate outline and a 700 11px name. Feature names are 11px Graphite, rotated along side walls. They are orientation only and never change the estimates.
- **Grid step** grows with the room (1, 2, 5 or 10 m) so any room size keeps 5-12 labelled lines.
- **Tag filter:** a segmented control under the map shows all tags, only the selected one, or a chosen set; the count of hidden tags is always stated.
- **Room editor:** "Edit room" opens a grey-2 panel under the map with the size and a feature table; edits save to the database immediately.
- **Position solver:** each receiver weighs 1/d², because RSSI distance error grows with distance; a lone receiver reading under the "very near" setting pins the tag to itself.

### Charts
Ink 2.5px line on white inside a Head Grey border, grey grid, Slate tick labels, an Amber Tint band for "beyond range", gaps where a tag was lost, and a red dot on the latest reading.

## Do's and Don'ts

### Do:
- **Do** put every block of content in a Module with a red tab head.
- **Do** keep corners square (0px) and separate surfaces with hairlines (#C9CDD3) or grey fills.
- **Do** set glanceable numbers at 900 weight with tabular figures.
- **Do** keep module gaps and page padding at 8px.
- **Do** put live counts on section tabs, red when something needs attention.
- **Do** keep amber for "uncertain" and red for "lost / offline / destructive".

### Don't:
- **Don't** use shadows for elevation, blur, translucency, gradients or rounded corners.
- **Don't** colour map zones; they stay grey.
- **Don't** draw a lost tag as a located dot or give it a position; it sits beside its last receiver.
- **Don't** fall back to airy KPI cards; counts live in a ruled strip inside a module.
- **Don't** set text lighter than Slate (#6B7179) on white.
