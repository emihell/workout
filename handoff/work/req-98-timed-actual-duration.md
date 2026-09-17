# req-98 — log the ACTUAL duration of a timed exercise (so "beat last time" can compare it)

**Status: NEEDS DECISION** (one pivotal design call below) — then READY. **Gate: ux-feel + model
(likely persisted-data).** From Emilio 2026-09-17: item-2 of the req-96 review — "fix now", chose "spec
it as a real req."

## The real problem (measured, not the parsing gap I first flagged)

beat-last-time (req-96) can't compare timed/cardio exercises — but not because it fails to parse. There
is **nothing to compare**:
- **0 sets** carry a structured `durationSec`. **0 exercises** have `hasDuration=true` — req-85's timed
  model is shipped but **entirely unused**.
- Emilio logs timed work as **free-text `reps`**, and it's the **target, constant across every workout**:
  plank always `"60 sec"`, rowing/stairs always `"5-8 min"`. The actual achievement, when recorded, is
  unstructured note text (`"1500/6:50"`, `"8 minutes"`).
- **req-85 itself punted on this:** it logs "the **target** duration (editable), not a stopwatch actual,
  for v1." So even a proper req-85 timed set compares target-to-target → never a win.

So the missing piece is a **logged actual** for a timed set — a number that reflects what you actually
did, distinct from the target, stored somewhere comparable. Without it, no "longer than last time" is
possible (and the same gap blocks any future duration progression).

## Why req-85 is unused (context, needs a look during build)

Two reasons its `hasDuration` path isn't reached: (1) Emilio's timed exercises (plank=bodyweight,
rowing/stairs=cardio) were never flagged `hasDuration` — they still use the old free-text-reps
"Duration" (the reps field relabeled, `progress.js:43`); (2) even if flagged, req-85 stores the target,
not the actual. This req should **build on req-85's model** (`hasDuration`, per-set `durationSec`,
SCHEMA v9) rather than invent a parallel one — read `work/req-85-timed-exercises.md` first.

## THE decision (pivotal — everything else follows)

**How is the actual duration captured when logging a timed set?**
- **A — Editable actual, defaults to target.** The timed set shows a duration field pre-filled with the
  target; you adjust it to what you actually held, then Complete. Simplest; one field; no stopwatch.
- **B — Countdown records elapsed-at-Complete.** Extend req-85's count-down: whatever the clock reads
  when you tap Complete (early or past zero) is logged as the actual. Hands-free-ish; more build; needs
  count-up-past-zero.
- **C — Stopwatch (count-up).** Start → counts up → Complete logs elapsed. Most accurate for open-ended
  cardio; most build; diverges from req-85's countdown UI.

(Recommendation: **A** — smallest change, works for plank and cardio alike, and it's exactly the
"editable actual" that makes comparison possible. B/C can come later.)

## Secondary decisions (can default; confirm)

- **Adoption of existing timed exercises.** Plank/rowing/stairs aren't on `hasDuration`. Options: (a)
  flag them (a small data edit / migration) so they use the structured field going forward; (b) leave
  history as-is and only structure new logs. *Default:* flag them going forward; **do not rewrite the
  free-text `reps` on old finished records** (history is the user's real data — ask-gate #2).
- **What beat-last-time compares.** Once actuals land in per-set `durationSec`, req-96's timed branch
  already keys on `durationSec` (longest actual work set) — it starts working with **no change**, or a
  one-line tweak. Confirm the "longer = win" axis is right (yes, per DEC-050).
- **Rowing "5-8 min" + distance-in-note.** Distance/pace stays free-text (out of scope); this req makes
  *duration* comparable, not distance.

## Scope (once decision made)

- The timed set-log flow (`item.jsx` / `set-edit.jsx`) — capture the actual duration.
- Store it in the per-set `durationSec` (req-85's field) on the logged set.
- Exercise adoption per the decision above (possibly a small `hasDuration` data edit / migration —
  **if the persisted shape or many records change, that fires ask-gate #2: state what changes and to how
  many records, add a migration test proving an older key survives**).
- beat-last-time (`beat-last-time.js`) — confirm/enable the `durationSec` comparison.

## Out of scope

- Duration **progression** (increasing the target next time) — req-85 deferred it; still future.
- Distance/pace/cardio metrics beyond duration.
- The countdown/beep UI itself (req-85) unless option B/C is chosen.

## Acceptance criteria (draft — finalize when READY)

- A timed set can log an **actual** duration distinct from its target (per the chosen capture method),
  stored numerically per set.
- Two same-routine workouts where the actual hold is longer → beat-last-time fires "↑ Longer …".
- Old finished records are **not** rewritten; a migration test proves an older storage key still loads
  (if a schema bump is involved).
- `./check` green.

## Decisions (Emilio, 2026-09-17)

- Item 2 is a real feature (capture the actual timed duration), not a beat-last-time patch — spec it.
- Capture method: **PENDING** (A/B/C above). Adoption + comparison: defaults above unless changed.
