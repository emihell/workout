# req-49 — Back goes to the logical parent, not the last-visited page

**Status: READY.** From Emilio 2026-09-12: *"There are still some back buttons that
send you literally back to last visited page, it should send you back to its logical
previous page - Scan the app for similar issues."*

**Gate: functional** — navigation behaviour, pure/route logic. Planning verifies +
merges (DEC-035). Touches shared routing (`route.js`) and a shared view helper
(`shared.jsx`) → **domino guard applies** (see below); spawn an independent reviewer
subagent before merge (DEC-035).

## Why — reproduction

There is one `Back` component (`shared.jsx:26-34`); it calls `back()`
(`route.js:96-104`) with **no argument**. `back()` pops a `sessionStorage`
visit-stack (`NAV_KEY = 'workout-mvp-nav-2'`, `route.js:44`) and navigates to
whatever the previous *visited* hash was — i.e. browser-history "back", not the
screen's logical parent. `Back` is used at **~35 call sites** across the app
(Schedule, Routine, Exercises, history/\*, workout/\*, Start, Missing), so **every**
back button behaves this way.

[measured] Reproduction: from the Workout tab open History (`/history`), open a
workout (`/history/:id`), then use the top nav to jump elsewhere and return, then
press Back — you return to the last *visited* screen, not `/history`. The visit stack
(`applyVisit`/`applyBack`, `route.js:16-32`) records visit order, so Back follows
history, not hierarchy.

## The behaviour (decided)

**Back always returns to the screen's logical parent — the screen one level up the
route hierarchy — regardless of how you arrived.** A workout detail's Back goes to
History even if you opened it from the Workout tab; a routine editor's Back goes to
that routine's detail.

`Back` gains a `to` prop (the parent path). Each call site passes its logical parent.
`Back` navigates there (via the nav primitive, honouring DEC-016: navigation is an
`<a href>`, not a stack pop). `Missing` (`shared.jsx:48-55`), which can't know a
parent, falls back to `/` (Today).

### Parent mapping (from the route tree, `route.js:142-306`)

[inferred from route.js — CC confirms each against the view before wiring]

```
screen (route name)              Back → parent
schedule                         /                 (Today/Workout tab)
schedule-loop                    /schedule
schedule-day                     /schedule
schedule-day-add                 /schedule/:w/:d
schedule-slot (+ nested)         /schedule/:w/:d/:slot  (nested → the slot detail)
routines                         /                 (Library landing / Today)
routine (detail)                 /routines
routine-edit                     /routines/:id
routine-exercise* (pick/new/edit)/routines/:id
exercises                        /                 (Library landing / Today)
exercises-type                   /exercises
exercise (detail)                /exercises
exercise-edit                    /exercises/:id
exercise-new*                    /exercises
history                          /
history-detail                   /history
history-edit                     /history/:id
history-recalculate              /history/:id
history-set, history-set-new     /history/:id
history-routine (+nested)        /history/:id
history-workout-exercise         /history/:id
history-exercises                /history
history-exercise                 /history/exercises
start                            /
workout-setup / preview          the workout overview or the surface that launches it
workout overview/item/finish     the in-workout overview (/workout/:id) — keep the
                                 existing ExercisesLink idiom for in-exercise screens
Missing                          /  (fallback)
```

The in-workout flow (`workout/*`) already uses `ExercisesLink` (`shared.jsx:40-46`)
for the "‹ Exercises" exit; keep that. Only the generic `<Back />` sites there switch
to a logical `to`.

## The domino guard (shared code)

- `route.js`: after this change, is the visit-stack still needed? `back()`,
  `applyBack`, and `applyVisit`'s stack-for-back purpose exist **only** to serve the
  no-arg `Back`. Once every `Back` passes `to`, the stack-pop `back()` has no caller.
  **Per "no stale code" (WORKFLOW): remove `back()`/`applyBack` and their tests if
  unused** — justified in the diff — OR keep `back()` only as `Back`'s internal
  fallback when `to` is absent. Decide and state which; don't leave a dead export.
  `applyVisit`/`recordScreen` analytics (`route.js:55-64`) are a **separate concern**
  (screen-view counting) and **stay**.
- Named dependents of `back()`/`applyBack`: only `Back` (`shared.jsx`) and
  `route.test.js`. Assert nothing else imports them (grep in the report).

## Scope

- `shared.jsx`: `Back` takes `to`; navigates to the parent (link semantics).
- ~35 call sites: each passes its logical parent per the table.
- `route.js`: remove or demote the now-unused stack-back path; keep visit analytics.
- Tests: `route.test.js` updated for whatever `back()`/`applyBack` fate is chosen.

## Out of scope

- The visual/link-vs-button treatment of `Back` (the "everything uses components"
  sweep) — that's req-50. **Order: build req-49 first (behaviour), then req-50 folds
  `Back` into the component treatment** — note the coupling so req-50 doesn't undo it.
- Screen-view analytics (`recordScreen`) — unchanged.
- Any route-parsing change in `parseRoute` — the parents are existing routes.

## Ordered steps

1. `shared.jsx`: add `to` to `Back`; navigate to it (nav primitive). `Missing` → `/`.
2. Wire each `<Back />` site to its logical parent (table above), confirming each
   against the view.
3. `route.js`: remove/demote the unused stack-back; keep `recordScreen`.
4. Update `route.test.js`; add a test that Back resolves to the parent, **not** the
   last visit.

## Acceptance criteria (written before implementation)

- **Logical parent, not referrer (the core case):** open `/history/:id` having last
  visited a different tab, press Back → land on `/history`, not the other tab —
  browser-check, and a unit test asserting parent resolution independent of visit
  order.
- **Every site covered:** no `<Back />` renders without a `to` (except `Missing`'s
  `/` fallback) — grep in the report shows zero bare `<Back />`.
- **No dead export (failure case):** `back()`/`applyBack` are either removed (grep
  shows no importer) or demoted to a used fallback — assert one, not "left in place
  unused."
- **Analytics intact:** `recordScreen` still fires on navigation — the analytics
  test still passes.
- **No regression:** `./check` green — paste the line; `route.test.js` output pasted.

## Decisions

- **behaviour (Emilio):** Back returns to the logical parent, independent of how you
  arrived.
- **implementation (CC's call):** the exact parent for any screen the table marks
  ambiguous (workout-setup/preview launch surface); whether to remove or demote
  `back()`; render mechanism (coordinated with req-50).
