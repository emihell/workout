# req-174 — an empty home says "Create your first routine"

**Status: BUILT — branch `req-174` (`31a51f1`, 3 commits), NOT merged.** (2026-09-25) **Lane: ui.** Source: persona run (req-144 prep §E.10). Emilio approved ("5. good", DEC-093).

## Today [read 2026-09-25]
With no data, Home shows `<Title subtitle="No data. Import, or start empty.">Today</Title>` and one grey **Import** button
(`views/Today.jsx:317-338`); "start empty" is not a control. (Persona: the bottom "Workout" tab "did nothing" — that's the
tab for this same screen, `route.js activeTab`; not a bug.)

## Change
When the app has no routines and no history (the existing empty condition, `Today.jsx:317`): a primary **"Create your
first routine"** button → the new-routine screen (`/routines/new`); **Import** stays as a smaller secondary action with its
current behaviour; the subtitle drops "start empty" (e.g. "Nothing here yet.").

## Out of scope
Onboarding, sample data, any change once a routine exists.

## Acceptance criteria
1. Empty store → the primary button is present and lands on `#/routines/new`; Import still imports (browser, `plan qa --seed`
   with an empty `emptyState()` file — BACKLOG `plan qa --empty`).
2. **Failure case:** a store with history but no routines, and one with a routine but no history, do **not** show the
   first-routine button unless today's empty condition already holds for them — assert against main's condition, unchanged.
3. `./check --smoke` green.

Decisions: subtitle wording `(unconfirmed)` — Builder may pick; on Emilio's list. Trigger files: none.
