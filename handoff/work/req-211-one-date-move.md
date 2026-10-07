# req-211 — "Change day" from Home moves one date only; the Schedule view moves every week

**Status: READY** (2026-10-07). **Lane: data** (a persisted-schema addition, DEC-117 §2).

**Gate before merge:**
- round-trip and legacy-key tests;
- an independent reviewer;
- **Emilio's eyes on what is stored**, plus the backup reminder (DEC-046, CLAUDE.md ask-gate #2).

Emilio: "yes, you have to change it in the actual schedule view for permanent change". Noa wanted race week only.

## What changes in stored data (stated for the ask-gate)
- **New optional field `schedule.moves`:** an array of `{ id, slotId, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }`. It is absent in
  every existing store and treated as `[]`.
- **No existing record is rewritten.** No version bump: `workout-mvp-v9` stays, and the field is additive.
- **Records touched on upgrade: 0.** Only a user's own "Change day" from Home writes one record.
- **`migrateState` (`model.js:301-312`)** spreads unknown schedule fields through today. It must normalise `moves`: keep only
  well-formed entries whose `slotId` exists, else drop them.
- **Export/import (`exchange.js`)** carries `moves`. An import with malformed `moves` drops them, not the whole import.
- **Removing a slot** (`slotRemovedState`) drops its moves.

## Behaviour
1. **`slotsOn(schedule, date)`** (`schedule.js:82`) applies moves:
   - a slot with a move `from = date` is **not** on `date`;
   - a slot with a move `to = date` **is** on `date`, even if its own weekday differs.

   Everything built on it follows: `comingDays`, today's block and the day screen.
2. **The day screen opened from Home (with a date):** ⋯ → Change day shows the 7 days of that date's week (Mon–Sun), with
   the current one marked.
   - Choosing a day adds `{slotId, from: thisDate, to: chosenDate}`, then lands on the chosen date's screen.
   - The sheet copy is "Move {name} to which day? Only this week — the Schedule stays as it is." `(unconfirmed)`
   - Moving a moved session again **replaces** its move (keeping the original `from`). Moving it back to its own date
     removes the move.
3. **The day screen from Schedule (no date):** Change day works as now, every week (req-207).
4. **Done by date** and Start now behave by the moved date. A moved slot's `coveringWorkout` matches on the `to` date.
5. **The moved row** on Home and the day screen carries a small "moved from Fri" sub-line. `(unconfirmed)`

## Out of scope
- Moving across weeks (the target date is within the same Mon–Sun week).
- Skipping one date without moving it.
- Pruning old moves.

## Acceptance
1. **Unit `slotsOn` with moves:** a Fri slot with `{from: Fri Oct 16, to: Thu Oct 15}`:
   - Thu Oct 15 has it;
   - Fri Oct 16 doesn't;
   - Fri Oct 23 has it again.
2. **Unit `migrateState`, legacy:**
   - a v9 doc with no `moves` → `schedule.moves` is `[]`, and the slots are deep-equal to before;
   - the legacy v8 key fixture still migrates as before;
   - a doc with one valid and one malformed move keeps 1;
   - a move for a missing slot is dropped.
3. **Unit round-trip:** export → import keeps `moves`.
4. **Failure case:**
   - an import whose `moves` is not an array still imports everything else, with `moves: []`;
   - removing a slot removes its moves.
5. **Browser:**
   - Home → Fri row → ⋯ → Change day → Thu → Home shows Thu with that workout and Fri as Rest **this** week.
   - The Schedule still shows Fri.
   - Next week's Fri has it.
   - Receipt: v9 `schedule.moves` and `schedule.slots` unchanged.
   - Screenshot `scratchpad/r211-home.png`.
6. `./check` green. **This branch's own** smoke is green on the committed sha (L-049).
7. **For Emilio before merge:** a plain list of the stored shape and an example record, plus "export a backup first".

## Built — review (merge waits for Emilio's "go" and his backup, DEC-046)
- **Commits:** `f0ee25d` (code), `25b2194` (report), `466e324` (review fixes), `b4592fa` (report).
- **Independent reviewer, round 1:** 1 should-fix and 1 latent, both fixed:
  - a stale move after a loop resize put a stray workout on a date;
  - `normaliseMoves` now dedupes per (slotId, from) and keeps moves within the same week only.
- **Round 2:** "No blockers."
  - **Real data:** `migrateState` on all 13 of Emilio's exports and `db.json` is equal except `moves: []`.
  - **Load writes nothing:** byte-identical in 3 time zones.
  - **Brute force:** 1680 valid moves × 3 time zones, 0 bad.
  - **Latent:** a stale move counts again if the loop is changed back. That is the user's own choice, so it is accepted.
- **Gate:** `check: green — lint, skills, no import cycles, 108 test file(s), and the build all passed.` This branch's own
  smoke is green (Planner, throwaway worktree, at b4592fa).
- **Calls `(unconfirmed)`:**
  - any dated day screen moves one date;
  - the sheet skips dates that already hold the workout;
  - a past date can be moved;
  - every-week Change day drops that slot's moves;
  - the sheet copy "Only this week — the Schedule stays as it is.";
  - the "moved from Fri" sub-line.

- **Emilio: "merge"** (after two backup reminders; whether a backup was made isn't confirmed).
