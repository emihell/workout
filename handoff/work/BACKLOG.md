# Backlog

Things to build. **Nothing here is a requirement yet** — each becomes a
`work/req-NN-name.md` when it comes up, and only a `READY` requirement (behaviour
questions answered) goes to Claude Code (`rules/WORKFLOW.md`).

Seeded 2026-09-06; revised 2026-09-07 (code review, gym-flow view review, Emilio's
direction). Ordered against the milestone below, not a flat list.

## The order Emilio set (2026-09-07)

> *"before we build anything heavy, i want the actual flow of using the app in the
> gym to be flawless. then the flow to create programs — that is probably the most
> difficult flow."*

```
Phase 1  the in-gym usage flow is flawless        ← now (stays browser-only)
Phase 2  the program-creation flow                ← next (the hard one)
Phase 3  the heavy build                          ← gated on the backend decision
         (database + users, own exercise DB, animations, AI, full styling)
```

---

## Phase 1 — the in-gym flow, flawless  (now)

The bar: starting a workout, logging every set, warm-ups / extra sets / skips,
resting, finishing — zero friction, zero lost input, zero ambiguity — on a phone, in
a gym, one-handed. UX hardening on the **existing** browser-only app; no backend, no
new data model.

**Grounded in the 2026-09-07 gym-flow review** (views + live-workout flow). Finding:
the logic layer is sound — the state machine, rest timing, snapshot-on-start,
skipped-at-finish and draft-on-switch all work. "Flawless" is mostly a **design/UX
pass on ~4 screens** plus a few gym-ergonomic gaps. These are the candidates:

- **`req-01` guard `saveState`** (in flight, READY) — the persist path can throw and
  lose data silently; the floor under "flawless". `work/req-01-guard-savestate.md`.
- **Style the live-workout screens — the core of "flawless".** The app currently has
  **zero CSS** (raw HTML; set-to-set navigation is small text links). One-handed in a
  gym that is the biggest friction there is. Big tap targets, current-set focus, thumb
  reach, legible numbers across `Start → Workout → log → rest → Finish`. Here "style
  the app" and "flawless gym flow" are one job; the full app-wide design language
  stays Phase 3. Expect heavy iteration + the "use it" gate (`rules/WORKFLOW.md`).
- **Rest-end cue + keep the screen awake.** Rest is a stored endpoint + a 250ms
  interval that only ticks while the log screen is foregrounded — no sound / vibration
  / notification when rest ends, and no wake-lock (screen can sleep mid-set). Add a
  rest-done cue and hold a wake-lock during an active workout. Behaviour Qs: which
  cue(s), and how to respect silent mode.
- **Replace native `alert`/`confirm` with inline UI.** 13 `window.alert`/`window.confirm`
  across the flow (Abandon?, Save draft?, Replace all data?, and a *dead* "Pick effort"
  guard). Jarring on mobile, breaks the one-screen-per-action feel. Inline confirms /
  toasts instead.
- **Abandon should offer save-as-draft** (behaviour call). Switching routines mid-
  workout saves a draft, but **Abandon** hard-deletes the active workout + its logged
  sets behind one confirm — asymmetric for a data-trust app. Decide: offer "save as
  draft" on Abandon?
- **Make "effort = hold" legible** (behaviour call). Effort defaults to **Moderate**,
  and Moderate/Hard hold — so weight only climbs when the user marks a set **Easy**
  and only drops on **Failure**/missed reps. Safe default, but worth surfacing: should
  Finish show "held — effort was Moderate" so loads sitting still is never a surprise?
  (Also remove the unreachable `alert('Pick effort')` guard — dead given the default.)
- **History recalc from a non-latest workout** — correcting an old session silently
  overwrites the routine's current loads. Behaviour call: only-if-latest, or always?
- **Auto-backup before a destructive import** — import replaces all state after a
  confirm without offering to download current state first. Also **consolidate the
  duplicated import path** (Today empty-state + Settings both do confirm + applyBackup).
  Speced READY: `work/req-07-backup-before-import.md` (DEC-004: auto-download current state first).
- **Legacy `localStorage` key cleanup** — `workout-mvp-v5..v7` read for migration but
  never removed. Low severity. Speced READY: `work/req-06-legacy-key-cleanup.md`.

### Gym-flow notes — Emilio, 2026-09-10 (from real gym use)

Raw notes captured while using the styled app in the gym. All Phase 1 (gym-flow flawless).
Grounded against the code; disposition + open questions noted. **Not yet specced as reqs** —
several need a behaviour call from Emilio first. Sequencing insight below.

1. **Show the "upcoming" set's weight during rest, editable while resting.** While the rest
   timer runs, surface the next set's prescribed weight and let it be changed then (not only
   once you're back on the log screen). [measured] rest is a workout-level countdown shown by
   `RestBar` (`Workout.jsx:630+`); the next set's seed is `initialSetFields` (req-17). *Disp:*
   READY-able. *Q:* show upcoming only when the weight **changes** from the last set, or always?
2. **Remove the informational text under the buttons.** The lines under the log buttons
   (effort/held/target hints) are clutter mid-set. [measured] set-log form + hint lines in
   `WorkoutItemLive`/`SetLogForm` (`Workout.jsx:~455–460`, the `ExerciseSetupHeader`/cues lines).
   *Disp:* READY-able, small. Pairs with the "effort = hold legible" item above — decide together.
3. **Hide the note field behind an "Add note" button.** Note input is always shown; make it a
   button that reveals the field. [measured] `SetLogForm` renders the note `Textarea` inline.
   *Disp:* READY-able, small. Ties to req-18 (set-edit forms) — see sequencing.
4. **Spatial button rule — forward/primary right, back/previous left.** RECORDED as a rule in
   `rules/DESIGN.md §4` (2026-09-10). *Disp:* needs an **audit req** — sweep every two-action
   screen and fix sides. Touches the same rows/forms as req-20/23/18.
5. **BUG — rest timer doesn't fire on a re-done set after Previous.** "Go Previous after a set,
   then forward → no timer; and a timer that already ran won't run again for that set."
   [measured] `previousSet` (`Workout.jsx:379`) calls `removeActiveSet`, which clears
   `restEndsAt`/`restPausedRemaining` (`store.jsx:311`); re-completing calls `completeSet` →
   `restAfterSet(done)` (`Workout.jsx:321`), which returns **no rest when `done` is true**
   (`finishAfterThisSet`). Likely: after the restore the set counts as the last one, so `done`
   suppresses rest. *Disp:* real bug — spec as a fix req; CC to repro + root-cause. Relates to
   req-03 (persistent rest timer).
6. **Timed exercises (duration sets) — e.g. plank.** Any exercise should be able to carry a
   **weight and/or a timer**; a timed exercise shows a count-**down** during the set that you
   start, with a sound when done. [measured] exercises have `restSec` already (`model.js:41`) but
   no per-set *work* duration; `EXERCISE_TYPES = ['machine','free','bodyweight','cardio']`
   (`ids.js:51`) has no "timed" concept. *Disp:* **biggest of the batch — persisted-data +
   model + UI.** Needs a decision (below). The "sound when done" reuses the still-open rest-end-cue
   backlog item.
7. **Show completed routines on the main (Today) page.** [measured] `Today`/`WorkoutRow` already
   marks a slot `Done {date}` when a covering workout exists (`Today.jsx:29–38`); the ask is a
   visible list/section of what's been completed, not just the per-slot label. *Disp:* READY-able.
   *Q:* today's completed only, or a recent-history glance?

**#6 timed exercises — PARKED (Emilio, 2026-09-10).** Model shape (orthogonal weight/duration
flag vs a new `EXERCISE_TYPES` value) is **not decided yet**; captured as a Phase-1/2 feature but
not to be specced until Emilio picks the shape. Persisted-data ask-gate applies when it revives.

**Sequencing — DECIDED (Emilio, 2026-09-10): refactor fully first, gym-flow notes after.** Finish
the refactor batch (req-16..19) as specced — **pure refactors, no UX change folded in** — then
spec these notes fresh against the refactored code. Cleaner diffs; accepts touching the same files
twice. So notes #1/#2/#3/#4/#5/#7 stay parked here until req-16..19 (at least req-18/23/20) land.
Note: bug #5 is a *logic* defect (rest timer), not a form-layout change, so it does **not** collide
with the UI refactor and could be pulled forward if the timer misbehaviour bites — default is still
after the batch.

**Status (2026-09-10):** bug #5 **shipped as req-25** (rest-on-overview; reproduced + fixed +
verified; see SHIPPED / DEC-013 refinement). The rest specced and queued (all ux-feel, serial):
#2+#3 → **req-26** (declutter set-log), #1 → **req-27** (upcoming weight during rest), #7 → **req-28**
(completed on Today), #4 → **req-29** (button-placement audit, DESIGN §4). Timed exercises (#6) still
PARKED on Emilio's model decision — note: Rowing already uses a "Duration" field (cardio), so a
duration concept partly exists; may inform #6.

## Phase 2 — the program-creation flow  (next; the hard one)

Emilio's "we should start creating programs." Today the app has **routines** (reusable
templates) and a **schedule** (weekly slots). A "program" is the layer above: a multi-
week structure that owns routines and their placement. The code still carries legacy
`programs`/`programName` remnants (`model.js`, `storage.js`) — a program layer existed
once and was flattened away; reintroducing it is a redesign, not a fresh start.

- **Define the model first** — program vs routine vs schedule; what a program owns, how
  it maps onto the weekly loop, how progression flows through it. A decision doc before
  any build (`rules/WORKFLOW.md`, readiness).
- **Then the creation UX** — the hardest flow in the app. Budget the review, not just
  the build.

## Phase 3 — the heavy build  (gated on ONE decision)

**The fork that gates most of this: browser-only (localStorage) vs a backend
(client–server)?** "A database" and "users" are effectively the same decision — real
accounts need a server store, and an AI API key can't live in a browser. Decide the
target before starting any of these; each is a milestone, not a `req`.

- **Database (backend).** Move off `localStorage`. Enables multi-device and users.
  Biggest architectural change; needs a migration path from existing local data.
- **Users / accounts.** Depends on the database. Reopens deferred scope (`README.md`).
- **Own exercise database + tagging.** Curate our own library (seed from a free open
  DB), tagged with muscles, equipment, movement pattern. **The enabler** for filters,
  recommendations, and AI generation — do it before those. Decisions: which source DB
  and **its licence** (verify each); the tag schema; bundled JSON vs backend.
- **Animations for basic exercises.** Demos keyed to the library. Decisions: source
  (make / licence / generate), format (video / gif / lottie), hosting (bundle bloat vs
  backend/CDN). Depends on the exercise DB.
- **AI program generation.** Composes programs from *our* tagged exercises. Depends on
  the exercise DB **and** the program model **and** a backend (key + cost can't sit
  client-side). Falls under CLAUDE.md's external-call ask-gate. `exchange.js` already
  prototypes the "AI edits the database" idea manually.
- **Full visual-design pass.** A real design language app-wide (beyond the Phase-1
  gym-flow polish). Its own milestone.

---

## Dependency map (why the order is what it is)

```
req-01 (save safety) ─ under everything
gym-flow polish ─ the bulk of Phase 1 (styling + ergonomics on a sound logic layer)
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
  schedule.js       recurring week/day slots + loop-week math
  route.js          hash routing (one screen per set/action)
  workout-log.js    live workout / set logging + skipped-at-finish
  exchange.js       backup export + AI-assistant import contract
  store.jsx         the single store (all mutations) + localStorage persistence
  ids.js            id minting + enums (RPE_OPTIONS, weekdays, types, roles)
  exerciseCatalog.js / exerciseExtras.js   exercise library (bundled)
  views/            Exercises, Routine, Schedule, Start, Today, Workout, History, Settings (no CSS yet)
```
