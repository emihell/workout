# Backlog

Things to build. **Nothing here is a requirement yet** — each becomes a
`work/req-NN-name.md` when it comes up, and only a `READY` requirement (behaviour
questions answered) goes to Claude Code (`rules/WORKFLOW.md`).

Seeded 2026-09-06; revised 2026-09-07 (code review + Emilio's direction). Ordered
against the milestone below, not a flat list.

## The order Emilio set (2026-09-07)

> *"before we build anything heavy, i want the actual flow of using the app in the
> gym to be flawless. then the flow to create programs — that is probably the most
> difficult flow."*

So the phases are deliberate, and the heavy items wait:

```
Phase 1  the in-gym usage flow is flawless        ← now (stays browser-only)
Phase 2  the program-creation flow                ← next (the hard one)
Phase 3  the heavy build                          ← gated on the backend decision
         (database + users, own exercise DB, animations, AI, full styling)
```

---

## Phase 1 — the in-gym flow, flawless  (now)

The bar: starting a workout, logging every set, handling warm-ups / extra sets /
skips, resting, and finishing — with zero friction, zero lost input, zero
ambiguity — on a phone, in a gym, one-handed. This is UX hardening on the
**existing** browser-only app; no backend, no new data model.

- **`req-01` guard `saveState`** (in flight, READY) — the persist path can throw and
  lose data silently. The floor under "flawless": if a save can vanish, nothing above
  it is trustworthy. `work/req-01-guard-savestate.md`.
- **Next planning step: a hands-on gym-flow review.** Walk the real
  `Start → Today → Workout → log → Finish` flow (the same treatment the code got),
  find the friction, and turn each into a small `req`. Do this before writing any
  Phase-1 feature reqs — "flawless" has to be found by using it, not guessed
  (`rules/DESIGN.md` §5, `rules/WORKFLOW.md` "a UI requirement is not finished when
  it is written").
- **Save-failure banner** — folds into `req-01`.
- **`window.alert('Pick effort.')`** (`views/Workout.jsx`) — a modal mid-log is
  friction; inline validation reads better. Candidate Phase-1 fix.
- **History recalc from a non-latest workout** — correcting an old session silently
  overwrites the routine's current loads. Behaviour call: apply only when the edited
  workout is the latest, or always? Decide, then spec.
- **Auto-backup before a destructive import** — import replaces all state after a
  confirm but doesn't offer to download current state first. Cheap safety net.
- **Legacy `localStorage` key cleanup** — `workout-mvp-v5..v7` are read for migration
  but never removed. Low severity.
- **Gym-flow styling** — the slice of "style the app" that makes the *logging* flow
  clear and thumb-friendly (hit targets, current-set focus, legibility). The full
  design pass is Phase 3; only what serves the flow rides along here.

## Phase 2 — the program-creation flow  (next; the hard one)

Emilio's "we should start creating programs." Today the app has **routines**
(reusable templates) and a **schedule** (weekly slots). A "program" is the layer
above: a multi-week structure that owns routines and their placement. Note the code
still carries legacy `programs`/`programName` remnants (`model.js`,
`storage.js`) — a program layer existed once and was flattened away; reintroducing
it is a redesign, not a fresh start.

- **Define the model first.** program vs routine vs schedule — what a program owns,
  how it maps onto the weekly loop, how progression flows through it. This is a
  decision doc before any build (`rules/WORKFLOW.md`, readiness).
- **Then the creation UX** — the hardest flow in the app. Expect heavy iteration and
  the "use it" gate; budget the review, not just the build.

## Phase 3 — the heavy build  (gated on ONE decision)

**The fork that gates most of this: does the app stay browser-only (localStorage), or
gain a backend (client–server)?** "A database" and "users" are effectively the same
decision — real accounts need a server-side store, and an AI API key cannot live in a
browser. Decide the target before starting any of these; each is a milestone, not a
`req`.

- **Database (backend).** Move off `localStorage` to a persistent store. Enables
  multi-device and users. Biggest architectural change in the app; needs a migration
  path from existing local data.
- **Users / accounts.** Depends on the database. Reopens deferred scope (`README.md`).
  When built, the "leave a door, serve one user" schema notes finally cash in.
- **Own exercise database + tagging.** Curate our own exercise library (seed from a
  free open DB), tagged with muscles, equipment, movement pattern, etc. **This is the
  enabler** for filters, recommendations, *and* AI generation — do it before those.
  Key decisions: which source DB and **its licence** (verify each — "copy the free
  ones" is a licence question, not a given); the tag schema; where it lives (bundled
  JSON vs backend).
- **Animations for basic exercises.** Exercise demos keyed to the library. Decisions:
  source (make / licence / generate), format (video / gif / lottie), and hosting —
  bundling bloats the app, hosting wants a backend/CDN. Depends on the exercise DB.
- **AI program generation.** An AI API that composes programs from *our* tagged
  exercises. Depends on the exercise DB **and** the program model **and** a backend
  (API key + cost control can't sit client-side). Falls under CLAUDE.md's external-
  call ask-gate. The `exchange.js` assistant-prompt/import already prototypes the
  "AI edits the database" idea manually — the API version automates that path.
- **Full visual-design pass.** A real design language across the app (not just the
  gym-flow polish in Phase 1). Its own milestone; decide target first.

---

## Dependency map (why the order is what it is)

```
req-01 (save safety) ─ under everything
gym-flow review ─ turns "flawless" into Phase-1 reqs
program model ─→ program-creation UX (Phase 2)
              └─→ AI generation (Phase 3)
own exercise DB ─→ filters/recommendations
                └─→ animations
                └─→ AI generation
backend (database) ─→ users ─→ (multi-device)
                   └─→ AI generation (key can't live in browser)
```

## Already built — do not re-spec (review check, `NOTES.md` rail 1)

- **Export / backup + AI-coaching import.** `src/exchange.js` + Settings `Export`/
  `Import` already export the full database as `workout-mvp-backup` JSON (optionally
  with an assistant prompt) and re-import it with a replace-confirm. What's missing is
  only the auto-backup-before-import net (Phase 1).

## Current shape (reference, not a task list)

```
src/
  model.js          entities + invariants; carries legacy programs/programName remnants
  storage.js        localStorage load/save + v5–v8 migrations
  progress.js       load recommendation (valid increments; Easy→up, Mod/Hard→hold, Failure/miss→down)
  schedule.js       recurring week/day slots
  route.js          view routing
  workout-log.js    live workout / set logging + skipped-at-finish
  exchange.js       backup export + AI-assistant import contract
  store.jsx         the single store (all mutations) + localStorage persistence
  ids.js            id minting + enums (RPE_OPTIONS, weekdays, types, roles)
  exerciseCatalog.js / exerciseExtras.js   exercise library (bundled)
  views/            Exercises, Routine, Schedule, Start, Today, Workout, History, Settings
```
