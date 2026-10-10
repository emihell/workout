**Status: BUILT, NOT merged** **Lane: ui** — reads the bundled library; no stored write.

# req-217 — one-arm exercises say "each side"; notes and form cues show during rest

DEC-119 §6 (Emilio, H9 "Is it pre understood that this exercise is 1 set per arm? … left arm 12 times then … right arm 12
times", H10 "I never read the notes, maybe those should be tips that show between sets when waiting for the timer").
Builder: throwaway agent. **After req-212** (same log screen).

## Facts (rescanned 2026-10-10, `main` 25d366a)

- Library entries carry `unilateral` (62 true / 304 false in `library/exercises.json`); `catalogItemToExercise` doesn't copy it
  but stores `libraryId` (`exerciseCatalog.js:219-235`). `libraryEntryFor(exercise, library)` resolves by libraryId → name → alias,
  no fuzzy guess (`exerciseLibrary.js:586-595`); only tests call it today.
- Routine item note shows under the title (`views/workout/item.jsx:538`, class `ui-item-note`, no CSS). Library cues
  (`formCues` etc., `exerciseLibrary.js:264`) never render on the log screen. During rest nothing extra shows (`rest.jsx:19-37`).

## Scope

1. **Each side.** When `libraryEntryFor` resolves to an entry with `unilateral: true`, the reps label/target on the log screen,
   the set list and the review (req-212) read "{n} each side" (e.g. "12 each side"). Stored reps unchanged (12 = 12 per side).
   No entry / not unilateral → as today.
2. **Rest notes.** While this exercise's rest is running (the workout's `restEndsAt` in the future), show a quiet block under the
   set list: the routine item's note (if any), then up to 3 of the library entry's `formCues` (if resolved). When rest ends or is
   skipped, the block goes. The note no longer shows under the title.
3. Nothing shows when there is no note and no resolved entry.

## Out of scope

Generic / motivational tips (parked, DEC-108 §6); per-side logging (left/right fields); copying `unilateral` into stored
exercises; editing cues.

## Acceptance criteria

1. Browser: One-arm DB row (library unilateral) → "12 each side" on the set; a two-arm press → "12".
2. Browser: log a set with rest 60 s → the note + cues show; Skip rest → gone; next set's screen without rest has no block.
3. **Failure case — no library link:** a manually created exercise (no libraryId, no name match) → no "each side", rest block shows
   only the routine note, or nothing.
4. **Right mechanism:** a unit test asserts "each side" comes from `libraryEntryFor(...).unilateral`, not the exercise name.
5. Main JS chunk size reported before/after (the library lookup must not pull the whole library into the main chunk if it is
   split today; if it already is in main, say so).
6. `./check` green.

## Decisions made on Emilio's behalf

- **behaviour** `(unconfirmed)`: a set = both sides, reps per side; label "each side".
- **behaviour** `(unconfirmed)`: max 3 form cues; the note leaves the title area entirely.
- **implementation:** resolved at read time via `libraryEntryFor` — no stored field, no bulk write.

## READY checks

1. DECs: DEC-108 §6 (generic tips parked — this is exercise-specific), DEC-060 library, DEC-074. 2. Siblings: req-212 rewrites the
   same screen and adds the review → build after it. 3. none. 4. 62 / 304 from the rescan (`library/exercises.json`).
5. no trigger files. 6. marked.
