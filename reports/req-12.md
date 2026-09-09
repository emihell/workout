# req-12 — navigation consistency (nav is links, buttons are actions)

Branch: `req-12-nav-consistency`. Gate: functional (DEC-016). Behaviour-preserving.

## Technical

### The shared primitive

Added `NavLink({ to, children })` to `src/views/shared.jsx` — renders
`<a href={toHash(to)}>{children}</a>`, reusing `toHash` from `route.js`. `to` is a
route *path* (e.g. `/schedule`, `` `/history/${id}` ``), matching what `go()` already
takes, so conversions are `go(X)` → `to={X}` verbatim.

`ExercisesLink` (req-11's ad-hoc nav link) now renders through `NavLink` instead of a
bare `<a href={`#/workout/${id}`}>`, so there is **one** nav-link primitive, not several.
It keeps its own `<p>` wrapper and `‹ Exercises` label; only the inner element changed.
`NavLink` itself is bare inline (no wrapper) so it drops into existing
`<button>Save</button> …Cancel` rows without disturbing layout.

### Conversions (10 pure-nav buttons → NavLink)

Each was exactly `onClick={() => go(X)}` with no other statement — verified pure nav:

| File:line (pre) | Control | `to` |
|---|---|---|
| Exercises.jsx:195 | Cancel | `paths.hub` |
| Exercises.jsx:368 | Cancel | `` `/exercises/${ex.id}` `` |
| History.jsx:448 | Cancel | `` `/history/${workout.id}` `` |
| History.jsx:607 | Cancel | `` `/history/${workout.id}/exercise/${itemIdOf(set) || set.exerciseId}` `` |
| History.jsx:658 | Skip | `` `/history/${workout.id}` `` |
| Schedule.jsx:106 | Cancel | `/schedule` |
| Schedule.jsx:148 | Done | `/schedule` |
| Routine.jsx:166 | Done | `nav.done` |
| Routine.jsx:232 | Cancel | `nav.base` |
| Workout.jsx:843 | Cancel | `itemPath` |

`go` is still imported and used in all five view files (mutate-then-nav handlers,
form submits, redirects), so no unused-import fallout.

### Left as buttons (mutate-then-navigate or action) — call-outs

The spec flagged History:658 Skip and Workout:843 Cancel's sibling Save. Confirmed, plus
these mutate-**then**-navigate handlers that were adjacent to conversions and correctly
stayed `<button>`:

- **History.jsx:611 Remove** — `store.updateWorkout(...)` then `go(...recalculate)`.
- **History.jsx:649 Apply** — `store.recalculateFuturePlans(...)` then `go(...)`.
- **Routine.jsx:172 Delete** — `store.removeRoutine(...)` then `go(nav.done)`.
- **Schedule.jsx:132 / :185 Remove/assign** — `store.removeSlot` / `store.addSlot` then nav.
- **Start.jsx:28 Resume** — `store.resumeDraft(...)` then `go(...)`.
- **Today.jsx StartButton / :120 Start-or-continue** — `startOrContinue(...)` (creates/continues a workout snapshot).
- **Workout.jsx:843 Save**, all form `type="submit"` — submits, unchanged.

**One boundary decision (call-out):** `Schedule.jsx:172` is `onCancel={() => go(dayPath)}`
— but it's a *prop* passed to the shared `RoutineNewForm`, not a literal `<button onClick>`.
The form owns its own Cancel button and can't know its `onCancel` happens to be
navigation here. I left it as-is: converting a generic form callback to a link would be
wrong, and it's outside the "nav-only button" rule. Not counted as a conversion. Worth a
glance if planning wants form-cancel semantics unified later, but I judged it out of scope.

## Verification (receipts)

Acceptance grep — no navigation-only onClick remains on any element:

```
$ grep -rn "onClick={() => go(" src/
NONE ✓
$ grep -rn "onClick={() =>.*location.hash" src/
NONE ✓
```

Full gate:

```
check: green — lint, 13 test file(s), and the build all passed.
# tests 99  # pass 99  # fail 0
```

Diff scope (only the primitive + conversions; no lists/headings/sections/actions touched):

```
 src/views/Exercises.jsx |  6 +++---
 src/views/History.jsx   |  8 ++++----
 src/views/Routine.jsx   |  8 +++-----
 src/views/Schedule.jsx  |  8 +++-----
 src/views/Workout.jsx   |  4 ++--
 src/views/shared.jsx    | 15 ++++++++++++---
```

Not verifiable without a browser: that each converted control still *lands* on the same
screen when clicked, and how the now-link-styled Cancel/Skip/Done *feel* (they render as
link text until the styling pass — expected per the spec). Sample to check: a Cancel
(edit forms), the History Skip (recalculate screen), a Done (Schedule day / Routine).

## Workflow

- No scope added or dropped vs the spec's candidate list; all 10 named candidates were
  pure-nav and converted. No mutate-then-navigate handler was wrongly converted.
- One classification the spec didn't name: `Schedule.jsx:172`'s `onCancel` form-callback
  (see call-out above) — left as-is. If planning disagrees it's a one-line follow-up.
- Nothing needed a decision from Emilio; all choices were mechanism, not behaviour.
