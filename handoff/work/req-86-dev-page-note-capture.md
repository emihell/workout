# req-86 — dev-only "note on this page" capture button (N8, gym-flow batch 2)

**Status: NEEDS DECISION — saved 2026-09-14, not scheduled. Dev tooling, not product.** From
Emilio's 2026-09-14 notes: *"A new button only for development — a little, very unimposing button
where, while doing an exercise and seeing a flaw or improvement, I can add a note saved connected
to that page, so you can see what it's connected to and create a req from it."*

**Gate: infra / dev-only** — must **never** ship to the live GitHub Pages build.

## Why

Emilio wants an in-app pipe into this backlog: a tiny, unimposing button that jots a note tied to
the current page/route while using the app, so a req can be made from it later — instead of
capturing verbally after the fact.

## Open decision (Emilio)

Build it? And if so:
- **persistence** — a separate `localStorage` key (recommended: **never** touch `workout-mvp-v8`);
- **retrieval** — a dev screen listing notes, and/or **export-to-clipboard / JSON**;
- **gating** — a dev flag / env so it is absent from the production build.

*Recommended:* dev-flag-gated, a separate localStorage key, capture `{route, timestamp, text}`,
export-to-clipboard as JSON. No dev screen needed at first if export suffices.

## Data-trust guard

The dev notes store **must not** read or write `workout-mvp-v8` — never risk the user's real
history for a dev convenience.

## Scope / acceptance

Written once approved. Provisional acceptance:
- **Dev on (browser):** a small button on each screen captures a note tagged with the current
  route; notes are retrievable/exportable.
- **Prod off (failure case):** with the dev flag off (the production build), the button does not
  render and **no** dev key is written.
- Existing workout data (`workout-mvp-v8`) is never touched by this feature.
- `./check` green.

## Decisions

- Build vs keep capturing verbally; persistence/retrieval/gating shape (Emilio) — blocks READY.
