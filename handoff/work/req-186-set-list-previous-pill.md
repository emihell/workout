# req-186 — the exercise page: set list all the way, Previous without un-logging, one workout pill

**Status: BUILT AND MERGED, 2026-10-05 — branch `req-186` (`e9427eb`…`bd7a91e`, 4 commits).** (2026-10-05). **Lane: ui.** Builder: throwaway agent or Builder session (DEC-055). From DEC-103 §3–4
(req-184 feedback F6–F10, F8). Siblings, in order: **req-186 → req-187 → req-188** — all three edit `views/workout/item.jsx`;
build and merge one before the next branches off `main`. Trigger files: `workout-log.js` likely (helpers) → independent
reviewer before merge (WORKFLOW READY check 5); no stored-record write, so no backup reminder.

## What Emilio said (2026-10-05, app cbd9a78)
- F6 "I want to be able to see coming sets, if weight changes, it's nice to see beforehand"
- F9 "if they are similar, it's hard to see if you actually are on the next set … maybe make the 1 of 3 bigger"
- F7 "When timer is gone, maybe a 'go' in the timer chip that is glowing/changing colors"
- F10 "Maybe the timer button should own the 1/4 indicator?"
- F8 "If I go back, and an exercise has been completed, the complete button should be a secondary next button and should
  not trigger the timer again - the timer should stay and survive navigation in the app - I should also be able to press it
  go to straight to the exercise I am in"

## Code today (main `cbd9a78`, read this session)
- Set list only before the first set: `item.jsx:407-417` `preview = logging && state.logged.length === 0 ? setPreview(…)`,
  rendered `:488-493` `ul.ui-setpreview`; lines from `setPreview` / `setPreviewText` (`workout-log.js:724-760`).
- Progress is a small "N/M" in the sub line: `setProgressLabel` `item.jsx:58-63`, shown via `ExerciseTitle` meta (`:84`).
- **Previous un-logs:** `previousSet` (`item.jsx:284-298`) calls `store.removeActiveSet(index)` — "removeActiveSet clears the
  armed rest" — and turns the logged set into a draft; re-Complete then re-arms a fresh rest via `restAfterSet()` (`:249`).
  DEC-013 (2026-09-09) had kept "Previous for undoing the last set"; DEC-103 §4 replaces that meaning.
- Rest pill: `views/workout/rest.jsx:13` `RestPill` (renders nothing when not resting; tap =
  `patchActive({ restEndsAt: null, restPausedRemaining: null })`, `:19-22`); presentational `ui/index.jsx:304-316`
  ("{s}s" + "rest · skip"); countdown `rest-countdown.js` over `restRemaining` (`workout-log.js:785-797`). State is
  `activeWorkout.restEndsAt` / `restPausedRemaining` — already persisted, survives navigation and reload.
  Rendered on overview, log, done, set-edit, replace, setup, finish screens. End-of-rest beep/vibrate: `RestEndCue`
  (`rest-cue.js`, mounted in `App.jsx`) — unchanged.
- Known layout clash: BACKLOG QA-2 "rest pill's tap area overlaps Back at 375 px".
- `store.updateActiveSet(index, patch)` exists (`store.jsx`, after `completeSet`).

## Scope (ordered)
1. **Set list for the whole exercise.** The `ui-setpreview` list stays on the log screen until the exercise is done:
   done sets show what was logged, marked done (a skipped set reads "skipped"); the **current set is highlighted** (visually
   and `aria-current`); upcoming sets show what their form would prefill (today's `setPreview` rule, incl. session carry).
   No invented values: a blank kg stays "—".
2. **Previous views, doesn't undo.** Previous shows the last logged set **with its logged values**, without removing it.
   Bar while viewing a logged set: Previous (if an earlier one exists) · **Next** (secondary; returns to the current set)
   — and if a field was changed, the forward button becomes **Save** (primary; writes via `updateActiveSet`, then returns to
   the current set). **Neither Next nor Save touches the rest timer.** Viewing state is view state (or a route), not a new
   persisted field.
3. **One workout pill.** Replaces `RestPill` on every screen it renders today. Shows whenever a *current exercise* exists:
   - resting → "1:12 · set 2/4" (time as m:ss once ≥ 60 s);
   - rest over (or no rest armed) → **"GO · set 2/4"**, visibly distinct and animated (glow / colour pulse); with
     `prefers-reduced-motion` a static high-contrast state instead;
   - **tap → the current exercise's log screen** (from anywhere, incl. that screen itself: no-op there).
   *Current exercise* = the item of the most recently logged set if it isn't done, else the first not-done item in snapshot
   order; none (nothing logged yet, or all done) → no pill. "set N/M" = the set the current exercise is on, same counting
   as `setProgressLabel` (warm-up counts). Pure helper in `workout-log.js` (or beside it), unit-tested.
4. **Skip rest moves to the exercise screen**: a small quiet "Skip rest" control on the log screen while resting (same
   write as today's pill tap). Nowhere else.
5. The small "N/M" in the title meta goes (the pill and the list carry it).
6. Pill + Back must not overlap at 375 px and 390 px (QA-2).

## Out of scope
- The routine-kg confirm on the last Complete (req-187). Swap / Skip exercise / Add exercise (req-188).
- Pause / +30 s (DEC-048 removals stay removed). The pill outside in-workout screens (req-77, PAUSED).
- Editing a set from the list by tapping it (set-edit screen exists; not added here).
- Any change to the rest length, the beep, or when rest arms on Complete.

## Acceptance
1. Unit: the current-exercise helper — last logged item not done → that item; it's done → first not-done item; nothing
   logged → null; all done → null; a replacement item (`addedMidWorkout`) counts like any other.
2. Unit: "set N/M" for warm-up + 3 work sets after 0, 1 (wu), 2 logs → 1/4, 2/4, 3/4.
3. Browser: 3-set exercise, log set 1 → list shows set 1 ticked with its kg×reps, set 2 highlighted, set 3 upcoming.
4. Browser: log set 1 (rest 90 s starts), tap Previous → set 1's logged values shown, sets logged count unchanged
   (`activeWorkout.sets.length` read from localStorage before/after — **receipt**), pill still counting down, **not reset**.
   Tap Next → back on set 2, same countdown.
5. Browser: Previous, change set 1's reps, Save → stored set 1 has the new reps; `restEndsAt` unchanged (receipt).
6. Browser: let a 10 s rest run out → pill reads "GO · set 2/3" and animates; go to the overview, tap the pill → set 2's
   log screen.
7. **Failure case:** fresh workout, nothing logged → no pill on the overview (not a "set 1/N" guess). All exercises done →
   no pill.
8. **Failure case:** the exercise's routine kg blank and no history → upcoming rows show "—", not 0 or a carried guess
   from another exercise.
9. 375×667 and 390×844 screenshots: pill clear of "‹ Exercises"/Back; the list fits without hiding the bar.
10. `./check` green; the reviewer's verdict quoted.

## Decisions made on Emilio's behalf
- implementation: helper location; viewing-a-logged-set as view state.
- behaviour `(unconfirmed)`: pill appears only once something is logged; "GO" stays until the next set is logged / the
  exercise changes; m:ss above a minute; "Skip rest" as a quiet control on the log screen; done-set marking style; the
  title's "N/M" removed; Save on an edited earlier set leaves the rest alone.

## Built — calls for Emilio's end-of-batch list `(unconfirmed)`
- GO is **grayscale** (pulsing halo + fill), not coloured — DEC-017 (no colour) vs his "glowing/changing colors". Colour needs DEC-017 reopened.
- Viewing a logged set: list highlight moves to it, title "Set 1 · logged", Add note hidden; Next is secondary (navigation as a button,
  a DESIGN §4 exception).
- Pill rule: none until a real set is logged (a Swap before any log → no pill); after a Swap → the replacement.
