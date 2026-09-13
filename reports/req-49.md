# req-49 — Back goes to the logical parent, not the last-visited page

Branch `req-49`. Gate: **functional** (nav behaviour / route logic). Domino guard
applied (touches `route.js` + `shared.jsx`). Built, **not merged**.

## Technical

**The change.** `Back` (`views/shared.jsx`) gained a `to` prop and now navigates to
that fixed path via `go(to)` — a route move, not a visit-stack pop. Every one of the
33 `<Back>` sites passes its logical parent. The visit-stack "go back" primitive
(`back()` + `applyBack`) is **removed** from `route.js`; the visit stack itself and
`applyVisit`/`recordScreen` stay (screen-view analytics, a separate concern).

**`Back` element unchanged (deliberate).** It's still the quiet `<button>` — only the
destination changed. The visual/link-vs-button treatment (DEC-016 anchor conversion)
is explicitly req-50's scope; this req is behaviour-only. **Coupling note for req-50:**
when it folds `Back` into the NavLink/component treatment, it must keep the `to` prop —
don't revert to a no-arg stack pop.

**Parent map (confirmed against each view, not just the spec's inferred table).**
For the Routine screens (reused under `/routines`, schedule slots, `/workout/.../setup`,
and history recalc), the parent is read from the existing per-context `nav` object
(`navForBase(base, done)`), so each context resolves correctly:

| screen | Back → | source |
|---|---|---|
| routine-new | `/routines` | literal (standalone only) |
| routine (detail) | `nav.done` | context |
| routine-edit | `nav.base` | context (= its Cancel) |
| routine-exercise-pick | `nav.base` | context |
| routine-exercise-new | `nav.pick` | context (= its Cancel) |
| routine-exercise (edit) | `parent` (`nav.base`) | context (= its Cancel) |
| schedule-loop | `/schedule` | literal |
| schedule-day | `/schedule` | literal |
| schedule-day-add | `dayPath` (`/schedule/:w/:d`) | context |
| exercises-type | `/exercises` | literal |
| exercise-new (chooser) | `paths.pick` | context (`/exercises` or routine pick) |
| exercise-new-manual / -search | `paths.hub` | context (= their Cancel) |
| exercise-edit | `/exercises/:id` | literal (= its Cancel) |
| exercise (detail) | `/exercises` | literal |
| history (root) | `/` | literal |
| history-month | `/history` | literal |
| history-detail | `/history` | literal |
| history-exercises | `/history` | literal |
| history-exercise | `/history/exercises` | literal |
| history-workout-exercise | `/history/:id` | literal |
| history-edit | `/history/:id` | literal (= its Cancel) |
| history-set-new | `/history/:id` | literal |
| history-set | `/history/:id/exercise/:exId` | **deviates from table — see below** |
| history-recalculate | `/history/:id` | literal |
| workout preview / overview / empty | `/` | **CC's call — see below** |
| workout-item-exercise | item's log/done screen | context (= its Cancel) |
| workout-set (edit) | `itemPath` (item's log/done) | context (= its Cancel) |
| workout-finish | `/workout/:id` | literal |
| Missing | `/` (Today) | fallback |

The in-workout in-exercise screens keep the existing `ExercisesLink` ("‹ Exercises")
idiom untouched (`item.jsx:382`); only the generic `<Back>` sites there changed.

**Choices the spec left to CC (all noted per WORKFLOW):**
- **`history-set` → the exercise screen**, not `/history/:id` as the inferred table
  suggested. A set is opened *from* its workout-exercise screen (which lists the sets),
  so its true logical parent is that screen — and it matches the set form's existing
  `cancelTo`. Going two levels up to the workout detail would skip the screen you came
  from. → candidate `DEC-`.
- **`workout` overview / preview / empty-active → `/` (Today).** The preview route
  (`workout-preview`) has no in-app link that constructs it (Today starts via
  `startOrContinue`, not a preview link), so its launch surface is genuinely ambiguous;
  Today is the Workouts-tab landing and the safe single parent. For the active in-workout
  hub, Back steps out to Today with the workout left **active** (resumable via Continue) —
  Abandon remains the explicit discard. → candidate `DEC-`.

**Domino guard (`back()`/`applyBack` removal).** [measured] Grep for importers before
removal found only `Back` (`shared.jsx`) and `route.test.js` — no other consumer. Both
functions removed; `route.test.js` updated. `applyVisit`/`recordScreen`/`go` untouched.
`FinishScreen` now takes `routineId` (passed from `WorkoutFinish`) to build its parent.

## Verification (receipts)

- `./check` → **green**: `check: green — lint, 19 test file(s), and the build all passed.`
- Unit tests: **218 pass / 0 fail** (`node --test`, all `src/**/*.test.js`).
- New/updated tests (`node --test src/route.test.js src/views/shared.test.js` → 18 pass / 0 fail):
  - `route.test.js` — asserts `route.back` and `route.applyBack` are `undefined`
    (removed; parent resolution no longer stack-derived), and that `applyVisit`
    still records visit order for analytics.
  - `src/views/shared.test.js` (new, static-source style like `BottomMenu.test.js`) —
    asserts `Back({ to = '/' })`, `onClick={() => go(to)}`, import is `{ go, toHash }`
    not `back`, and `Missing` uses `<Back to="/" />`.
- **[measured] Every site covered:** `grep -rn "<Back />" src/` → no matches (exit 1);
  all 33 `<Back>` sites carry a `to`.

## What could not be verified here (needs Emilio in the browser)

Navigation *feel* and the ambiguous parents. The gate proves the wiring; it can't prove
the destinations feel right. See the ready-to-look-at list in the terminal.

## Workflow

- **Scope held.** Behaviour only; `Back` stays a `<button>` (element/visual treatment
  left to req-50, per this req's out-of-scope note). No route-parsing changes.
- **Added vs. plan:** removed `back()`/`applyBack` outright (the spec's "remove OR
  demote" — chose remove, no importers). Added `src/views/shared.test.js` (none existed).
  Passed `routineId` into `FinishScreen` (it previously took none) so Finish could build
  its parent — trivial, no behaviour change elsewhere.
- **Two decisions to record as `DEC-`:** (1) `history-set` Back → the exercise screen,
  not the workout detail; (2) the in-workout `Back` → Today with the workout left active.
  Both are noted above with rationale; neither was in a requirement/`DEC-`/`rules/`.
- **No decisions needed mid-build from Emilio** — the ambiguous cases had a defensible
  default and are flagged for his eyeball rather than blocking.
