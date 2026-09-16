# req-87 — feedback notes: ship to the live site, gated by a Settings toggle (default off)

**Status: READY — Emilio, 2026-09-16.** Revises req-86 (which shipped the feedback capture as
**dev-only**, build-time stripped from production). Emilio: *"run it on the live site — only I am using
it — but make it so I can turn it off in settings, and it should be default turned off."*

**Gate: functional** (no persisted-data change — the toggle lives in its own key, not `workout-mvp-v8`).

## Why / what changes from req-86

[measured] req-86 gates the capture button on a **build-time** flag: `App.jsx:227`
`{import.meta.env.DEV ? <DevNotes /> : null}`, and Vite DCE strips `src/dev/*` from the production
build. Emilio now wants it **available on the live GitHub Pages site** (he is the only user), but
**off by default** and **toggleable in Settings**. So the gating moves from build-time (absent in prod)
to **runtime** (present in prod, shown only when the user turns it on).

## The behaviour (decided, Emilio 2026-09-16)

- The capture button (the "✎") and its panel **ship in the production build** and render **only when
  the feedback toggle is ON**. Default **OFF** → nothing renders, nothing is captured.
- **Settings gets a toggle** ("Feedback notes" / "Page notes" — Builder picks the clearest label) that
  turns it on/off. The state **persists** across reloads/sessions.
- Everything else about req-86 is unchanged: notes still go to the separate `workout-dev-notes-v1` key,
  Copy-JSON / Clear still work, `{route, timestamp, text, context}` still captured.

## Scope

- `App.jsx:227` — replace the `import.meta.env.DEV` gate with a **runtime** read of the feedback flag.
- **Settings.jsx** — add the on/off toggle.
- The flag's persistence: a **separate localStorage key** (e.g. `workout-feedback-enabled-v1`),
  read/written through the `src/dev/dev-notes.js` store (or a tiny sibling) — **never** `workout-mvp-v8`.
- Remove the now-unused build-time `import.meta.env.DEV` gate for this feature (the DCE dead-code guard
  is no longer the mechanism). The `__APP_VERSION__` define from req-86 stays (still used in context).

## Out of scope

- Any change to `workout-mvp-v8` / the user's workout history.
- The notes' capture shape, export, or storage (req-86, unchanged).
- A general app-settings framework — this is one isolated toggle in its own key.

## Data-trust guard

- The toggle flag and the notes store **must not** read or write `workout-mvp-v8`. A separate key only.
- Default OFF is the absence of the key (an unset flag reads false), so a fresh visitor/site gets nothing.

## Acceptance criteria

- **Default off (browser):** on a fresh state (no flag key), the ✎ button does **not** render on any
  screen, including the live/production build; no `workout-dev-notes-*` or flag key is written until the
  user acts.
- **Toggle on (browser):** flip the Settings toggle on → the ✎ button appears on every screen; capture /
  Copy-JSON / Clear work as in req-86.
- **Persists (browser):** with the toggle on, reload → still on; flip off → button gone, and stays gone
  across reload.
- **Ships to prod (failure-case inversion of req-86):** `npm run build` (production) **includes** the
  feature now (the opposite of req-86's dist grep) — but it is inert until toggled on.
- **History untouched:** enabling/using feedback notes never reads or writes `workout-mvp-v8`
  (unit test: the only keys touched are the feedback flag + `workout-dev-notes-v1`).
- **No regression:** `./check` green.

## Decisions

- Ship to prod + Settings toggle + default off (Emilio, 2026-09-16).
- Toggle persisted in a **separate key**, not `workout-mvp-v8` — implementation choice (Planner), to
  keep the user's real data untouched and avoid a schema change. Reversible.
- Toggle label + exact key name + whether to rename the now-misnamed `src/dev/*` ("dev" → "feedback")
  — implementation (CC); a rename is optional cleanup, not required.
