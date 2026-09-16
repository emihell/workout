# req-86 — dev-only "note on this page" capture button (N8, gym-flow batch 2)

**Status: READY — Emilio said build it, 2026-09-16.** Purpose (Emilio's words, 2026-09-16):
*"so I can add feedback directly on a page, fast, and you can add anything you need to be able to
create a req on that feedback."* From the 2026-09-14 notes: *"A new button only for development — a
little, very unimposing button where, while doing an exercise and seeing a flaw or improvement, I can
add a note saved connected to that page, so you can see what it's connected to and create a req from it."*

**Gate: infra / dev-only** — must **never** ship to the live GitHub Pages build.

## Why

Emilio wants an in-app pipe into this backlog: a tiny, unimposing button that jots a note tied to
the current page/route while using the app, so a req can be made from it later — instead of
capturing verbally after the fact.

## The behaviour (decided: build it, Emilio 2026-09-16)

A small, unimposing button present on every screen **in dev only**. Tapping it opens a minimal text
input; on save it stores a feedback note tied to the current page. The store is a **separate
`localStorage` key** (never `workout-mvp-v8`). Notes are **exportable** (copy-to-clipboard as JSON)
so they can be handed to the planning session to become reqs.

**Capture enough context to make a req from it** (Emilio's ask — "add anything you need"):
- `route` — the current hash route (so the note is tied to the exact screen).
- `timestamp` — when it was captured (local time; the app already has `dateKey`).
- `text` — Emilio's feedback.
- and any cheap, useful context CC judges helps req-creation: e.g. the active route params /
  exercise or workout id if on a workout screen, and the app version/build. **Never** copy the
  user's real history wholesale — just the small identifying context.

**Gating (hard requirement):** a dev flag (e.g. `import.meta.env.DEV` / a build-time flag) so the
button and its store are **entirely absent** from the production GitHub Pages build — no render, no
key written. This is the acceptance failure case.

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

- Build it (Emilio, 2026-09-16). Shape: dev-flag-gated, separate localStorage key, capture
  `{route, timestamp, text}` + cheap req-useful context, export-to-clipboard as JSON. No dev listing
  screen at first if export suffices (CC may add a trivial one if cheaper than clipboard).
- Exact dev-flag mechanism + which context fields — implementation (CC), within the guards above.
