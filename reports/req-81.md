# req-81 — remove the duplicate "Completed today" on Today

Branch: `req-81`. `./check` green (lint + 218 tests / 19 files + build).

## Technical

**Problem:** a workout finished today rendered twice on Today — once in the
"Completed today" section (`Today.jsx:301`) and once in the recent peek (`:314`),
both reading `store.workouts` filtered by `finishedAt`.

**Direction chosen (of the two the req offered): "Completed today" owns them;
exclude today's finished from the recent peek.** This keeps today's sessions under
their explicit `SectionHeader` (their dedicated, req-28 home) and leaves the recent
peek as a clean prior-day history preview. The alternative (drop the section, let the
headerless recent peek own them) would demote today's completions into a generic list
capped at 2 rows and lose the label — worse for the "keep today's sessions visible"
goal.

**Change** (`src/views/Today.jsx`, section composition only — scope respected):
- Built `completedTodayIds = new Set(completedToday.map(w => w.id))` and filtered the
  recent-peek source: `store.workouts.filter(w => !completedTodayIds.has(w.id))`.
  Excluding **by id** tracks exactly whatever the "Completed today" section renders,
  so the two sets can't overlap regardless of `performedOn`/re-date edge cases.
  Stale in-progress workouts are never finished, so none are in the completed set —
  they still flow into recent as before.
- Guarded the "No history yet." line to also require `completedToday.length === 0`,
  so a day with a completed-today session but no prior history doesn't contradict
  itself by printing "No history yet." beneath the "Completed today" section. The
  always-present `History›` link is unaffected.

**Acceptance criteria:**
- *Once* — today's finished workout is in `completedToday` and therefore filtered out
  of `recent`; it renders exactly once (browser-verify below).
- *Edge: nothing finished today* — `completedToday` empty → section not rendered (existing
  guard) and the filter removes nothing, so the recent peek is unchanged.
- *Prior days* — a prior-day finished workout is not in `completedToday` (filters on
  `finishedAt === todayKey`), so it stays in recent/History as before.
- *No regression* — `./check` green.

No dedicated Today render test exists (JSX composition); the change is pure data
selection over existing pure helpers (`completedOnDayKey`, `sortWorkoutsByDate`).

## Workflow

- Implementation choice: dedupe direction (the req left it to CC/Emilio) — chose
  "Completed today owns them", rationale above.
- Rode-along: the "No history yet." guard. Not in the req's steps, but without it the
  chosen direction produces a self-contradicting empty-state, so it's part of doing
  the dedupe correctly rather than added scope.
- No schema/data change; no `DEC-`/`L-` warranted.
