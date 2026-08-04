# Perspective Create And Delete: Declined

Date: 2026-08-04

## What was proposed

Complete `manage_perspectives` by adding `create` and `delete` alongside the
existing `list`, `get`, and `update`. The tool currently states in its own
description that it "never creates or deletes a perspective", which reads like an
unfinished surface rather than a decision.

## Why it stays declined

### There is no OmniJS API for either operation

Confirmed by live experiment during the v2.1.0 work and recorded in
`2026-07-31-perspective-rule-management-design.md`:

| Capability | Result | Channel |
| --- | --- | --- |
| Read rules and aggregation | works | OmniJS `archivedFilterRules` |
| Write rules | works, persists | OmniJS assignment |
| Rename | works, persists | OmniJS `name` |
| **Create** | **no API** | only by importing a `.ofocus-perspective` bundle |
| **Delete** | **no OmniJS API** | only AppleScript `delete` |

`Perspective.Custom` exposes `all`, `byName`, and `byIdentifier` only. It is not
a constructor, and neither the class nor the instance prototype offers an add or
remove method.

### Delete would reintroduce the channel the server is leaving

Deletion is reachable only through AppleScript. Eleven primitives still use
AppleScript and all of them are legacy single-item writes; every tool added since
has used OmniJS. `RESEARCH.md` records why: AppleScript on OmniFocus 4.x produces
timeouts and broken behaviour, and Omni Group maintains it for compatibility
only. Probing AppleScript's review-interval support during the v2.2.0 work ran
straight into that fragility — reserved-word collisions, references that will not
coerce to values, and locale-dependent error text.

Adding an AppleScript-only delete path would move the server backwards on the one
architectural decision it has been consistently applying.

### Create cannot preserve the identifier

Creation requires importing a `.ofocus-perspective` bundle. That produces a new
perspective with a new identifier, which breaks the property the whole
`manage_perspectives` design was built around: writes are in-place so a
perspective's identifier never changes and name-based lookup stays stable. A
create-by-import path would also mean generating and writing a plist bundle,
which is a materially larger surface than the rule DSL that already exists.

### The gap it leaves is small

A user who needs a new perspective creates it once in OmniFocus, where the UI is
better at it anyway; from that point the assistant can read, explain, and rewrite
its rules completely. Deletion is rare, unrecoverable, and equally easy by hand.

## Recommendation

Leave `manage_perspectives` at `list`, `get`, and `update`. The tool description
should keep stating that it never creates or deletes, and should say why, so the
absence reads as a capability boundary rather than an oversight.

Revisit only if Omni ships a real OmniJS constructor or remove method.
