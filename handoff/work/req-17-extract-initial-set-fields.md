# req-17 — extract the set-log seed/prefill logic into a pure, tested `initialSetFields`

**Status: READY.** Behaviour-neutral refactor that moves the history-is-truth prefill rule out of a
component into a unit-tested pure function. Sourced from `reports/req-15-findings.md` #3 (DEC-021).

**Gate: code-only** (DEC-009, functional) — no user-visible change if done right; planning
browser-verifies and merges. The *point* is that it becomes testable, so the tests are the receipt.

**Build order:** do this **first** of the refactor batch — it shrinks `Workout.jsx` before the
file-split (req-19) and before the set-edit-form merge (req-18) touch the same region.

## Why

`WorkoutItemLive` (`src/views/Workout.jsx:~390–447`) computes the seed for the live set-log form
inline, in the component:

```
:397  const historyPrefill = historySetPrefill(last, { setType: currentType, workIndex: currentWorkIndex })
:398  const fromRestore = …
:402  const seed = setLogSeed({ weighted, fromRestore, restore, hasHistory, history: historyPrefill, carry, target })
:411  const initialEffort = fromRestore && restore.rpe != null && restore.rpe !== '' ? … : …
:415  const initialNote = fromRestore ? restore.note : ''
```

This is **the history-is-truth rule** — "prefills come only from finished-workout data; never invent
a value" (CLAUDE.md, `DESIGN.md`, `.cursor/rules/history-prefill.mdc`) — living inside a React
component where it cannot be unit-tested in isolation. `setLogSeed` (`workout-log.js:179`) is already
pure and tested; the *weight* seed goes through it, but the surrounding effort/note/restore decisions
(`initialEffort`, `initialNote`, `fromRestore`) do not. The project rule "anything that computes a
value the user sees gets its reasoning made visible / testable" applies squarely here.

## The change

Add one pure function beside `setLogSeed` in `src/workout-log.js`:

```js
// Everything the live set-log form starts from, decided from inputs alone.
export function initialSetFields({ weighted, fromRestore, restore, hasHistory, history, carry, target }) {
  const weight = setLogSeed({ weighted, fromRestore, restore, hasHistory, history, carry, target })
  const effort = fromRestore && restore?.rpe != null && restore.rpe !== '' ? restore.rpe : /* current default */
  const note = fromRestore ? (restore?.note ?? '') : ''
  return { weight, effort, note /*, reps if currently seeded, see below */ }
}
```

Then `WorkoutItemLive` calls `initialSetFields(...)` once and destructures, instead of computing the
four values inline. **CC decides the exact field set** by reading the current inline code — capture
*every* value the form currently seeds (weight, reps if any, effort, note, and the `fromRestore`
branch), so the extraction is complete and the component keeps none of the decision logic.

The `historySetPrefill(last, …)` call that produces `history` may stay in the component (it needs
`last`/`currentType`/`currentWorkIndex` from render) or move too if it's clean — CC's call; note it.

## Scope

- New exported pure `initialSetFields(...)` in `workout-log.js`, delegating weight to the existing
  `setLogSeed`.
- `WorkoutItemLive` uses it; the component retains **no** seed/prefill branching of its own.
- New unit tests in `src/workout-log.test.js` (see acceptance) covering the history-is-truth cases.

## Out of scope

- Any change to what the form actually prefills — output must be **identical** to today for every
  input. This is extraction, not a rule change.
- `setLogSeed` itself — keep it as-is; `initialSetFields` wraps it.
- Merging the set-edit forms (req-18) or splitting the file (req-19) — separate reqs.

## Acceptance criteria (written before implementation)

- **No-invent rule, tested:** a weighted exercise with **no history** and no restore seeds **no
  weight** (empty), not a guessed number. Test `initialSetFields` directly; paste output.
- **History prefill:** with finished-workout history for the same field, the weight equals the
  history-derived value (same as `setLogSeed` returns today). Test both weighted and bodyweight.
- **Restore wins when `fromRestore`:** with a restore payload, `effort`/`note`/`weight` come from
  `restore`, and empty `restore.rpe` falls back to the current default (assert the exact default the
  inline code uses today — read it, don't guess).
- **Parity with the old inline path:** pick 3 representative input sets and assert
  `initialSetFields(x)` returns exactly what the old inline expressions produced (a table test).
- **No regression:** `./check` green (paste the line); existing `workout-log.test.js` cases stay
  green; the live log screen still prefills the same in-browser (planning verifies).

## Decisions

- **behaviour:** none — output parity is the contract. If CC finds the inline code and `setLogSeed`
  disagree on any edge (e.g. an effort default), **stop and report** the discrepancy rather than
  encoding one interpretation.
- **implementation (CC's call, note in report):** the exact field set returned; whether
  `historySetPrefill` moves into the helper or stays in render; the helper's precise signature.
