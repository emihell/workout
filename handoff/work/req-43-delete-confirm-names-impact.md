# req-43 — the delete confirm names what it will remove (audit F-DIV-3)

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-43` (`ecc4aef`…`ecc4aef`, 1 commit).** Decision made (DEC-031). From audit 2026-09-12 (F-DIV-3).
**Gate: functional** (confirm-text + pure helpers) — no store-logic or data change;
user-facing wording, so an Emilio eyeball is welcome. Planning verifies + merges.

## Why

DEC-031 settled that "referenced = referenced by **finished history**" is the
correct rule (a setup object with no history isn't part of the immutable record), so
`removeRoutine`/`removeExercise` (`store.jsx:44-67,185-204`) **stay as they are** —
archive when there's history, hard-delete otherwise. The problem DEC-031 flagged is
that the deletion is **silent about its blast radius**: deleting a routine also
removes every schedule slot and planned workout that references it
(`store.jsx:57-64`), and deleting an exercise strips it from every routine and plan
item (`store.jsx:195-203`) — behind a bare `window.confirm(\`Delete ${name}?\`)`
(`Routine.jsx:152`, `Exercises.jsx:319`) that mentions none of it.

## The behaviour (decided — DEC-031)

Keep the history-only archive/delete logic. Make the **confirm name what it will
remove**, so the deletion isn't silent:
- **Routine:** if it has history → say it will be **archived** (kept in past
  workouts); otherwise deleted. Either way, name the counts it removes: N schedule
  slot(s) and M planned workout(s). Only mention a count when it's > 0.
- **Exercise:** if it has history → **archived**; otherwise deleted. Name that it
  will be **removed from N routine(s)** (and any planned workouts). Only when > 0.

## The fix — pure impact helpers + richer confirm text (L-007)

- Add pure helper(s) to `storage.js` (beside `routinesUsingExercise`, `:277`):
  - `routineDeletionImpact(state, routineId)` → `{ slots, plans, hasHistory }`
    (slots = schedule slots referencing it; plans = planned workouts referencing it;
    hasHistory = any finished workout for it — the archive-vs-delete decision).
  - For the exercise: reuse **`routinesUsingExercise`** (existing, pure) for the
    routine count, plus a `hasHistory` check (any workout with a set for that
    exercise). A small `exerciseDeletionImpact(state, exerciseId)` →
    `{ routines, hasHistory }` keeps it testable and mirrors the routine helper.
    (Match the store's own reference tests: routine ref via `routineId || sessionId`;
    exercise history via a set's `exerciseId`.)
- Build the confirm strings in `Routine.jsx:152` / `Exercises.jsx:319` from those
  helpers. Keep them one `window.confirm` each (replacing native confirms with inline
  UI is req-24, out of scope here).

## Scope

- Pure impact helper(s) in `storage.js`; enriched confirm text at the two delete
  sites.
- Tests in `src/storage.test.js` for the helper(s).

## Out of scope

- **No change to `removeRoutine`/`removeExercise` logic** — the history-only rule is
  correct (DEC-031). This is messaging only.
- Replacing the native `window.confirm` with inline UI (that's req-24).
- The relationship-page "Remove" confirms (`Routine.jsx:405`) — those remove one
  item from a routine, not delete an object; unchanged.

## Ordered steps

1. Add `routineDeletionImpact` (and `exerciseDeletionImpact`, reusing
   `routinesUsingExercise`) to `storage.js`, pure.
2. `Routine.jsx:152`: confirm text names archive-vs-delete + slot/plan counts.
3. `Exercises.jsx:319`: confirm text names archive-vs-delete + routine count.
4. Tests (`storage.test.js`): the helpers count slots/plans/routines correctly and
   report `hasHistory` (a routine referenced only by a slot → `{slots:1, plans:0,
   hasHistory:false}`; one with a finished workout → `hasHistory:true`).

## Acceptance criteria (written before implementation)

- The impact helpers return correct counts + `hasHistory` — command: the new tests,
  output pasted.
- The two confirms include the counts (only when > 0) and the archive/delete wording
  — quote the composed strings in the report.
- `removeRoutine`/`removeExercise` logic is byte-unchanged — confirm in the report
  (diff shows store.jsx delete bodies untouched, or store.jsx not in the diff).
- `./check` green — paste the line.

## Decisions

- **behaviour (Emilio, DEC-031):** keep history-only archive/delete; the confirm
  must name the slots/plans/routines it removes.
- **implementation (CC's call):** exact confirm wording; helper shape/placement.

## Notes

Eyeball-worthy (wording): the confirm now reads e.g. "Upper Body has past workouts
and will be archived. This removes 2 schedule slots and 1 planned workout." for a
history-bearing routine, or "Delete Upper Body? This removes 2 schedule slots." for
one with no history. Emilio can tweak the phrasing at a glance post-merge.
