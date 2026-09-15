# req-78 — rest timer as a floating pill, folded into the next set

Branch: `req-78`. `./check` green (lint + 216 tests / 19 files + build). Net −207 lines.

## Technical

Reworks the req-25/27 rest surface per the two 2026-09-16 decisions. **No data change**
(`restSec`, the schema, and the persisted rest fields are untouched). The rest-arming
and rest-clearing logic is deliberately left exactly as req-25 built it.

**D1 — dedicated rest view removed.**
- `ui/index.jsx`: `RestBar` molecule (big time + Pause/+30s/Next) → **`RestPill`** — a
  small floating pill showing the remaining seconds; the whole pill is a tap-target
  that skips the rest.
- `views/workout/rest.jsx`: the `RestBar` wrapper → **`RestPill`** wrapper (reads
  activeWorkout rest state, self-hides when no rest). `useRestCountdown` kept unchanged.
- All `RestBar` call sites now render `RestPill`: overview, finish, setup, and item.jsx
  (the live log, the done view, the set-edit). Because the pill is `position: fixed`,
  the countdown floats and persists across navigation just as the bar did.
- `RestUpcoming` (the req-27 editable "next weight" panel) deleted, along with its
  `.ui-upcoming` CSS and the now-unused `--ui-text-rest` token.

**D2 — next set immediately loggable during rest (self-paced).**
- `views/workout/item.jsx` `WorkoutItemLive`: the `resting ? <RestUpcoming/> : <SetLogForm/>`
  branch is gone. The next set's `SetLogForm` now renders whenever the exercise isn't
  planned-done — **during rest included** — so completing a set advances straight to the
  next set's live form with no intermediate panel and no extra tap. Complete is never
  locked. The form remounts per set by `key`; rest ending doesn't change the key, so
  in-progress edits survive the rest→post-rest transition.
- req-27's upcoming-weight override folded away: `nextSetWeight` writes,
  `setUpcomingWeight`, `pendingWeightFor`, and the `weightOverride` param of
  `initialSetFields` are all removed. The set form's own weight field is now the
  editable surface, seeded from restore/carry/history exactly as before (no-invent rule
  preserved). The progression ↑/↓ marker that lived only in `RestUpcoming` is dropped
  with the panel.

**Rest-timer bug (req-25) — protected, not regressed.** This rework passes through the
mechanism but changes none of it:
- `store.removeActiveSet` still clears `restEndsAt`/`restPausedRemaining` (untouched).
- `restPatchAfterSet` still arms rest on completion, suppressed only by skip (untouched).
- `previousSet` still calls `removeActiveSet` (kept; comment added).
So Previous-then-forward clears the old timer and re-arms a fresh one — there is only
ever one `restEndsAt`, so no double timer, and rest fires `restSec` after the
(re-)completion, exactly as req-25 established. Added a **source guard**
(`store.test.js`) asserting `removeActiveSet` resets both rest fields, so this can't be
silently reverted (store.jsx can't be imported under `node --test`).

**Test changes (called out per D1):**
- Removed `workout-log.test.js`'s `weightOverride` cases and the `pendingWeightFor`
  describe — both tested code that no longer exists (the override folded into the form).
  A justification comment replaces them; the surviving `initialSetFields` cases still
  lock the restore/carry/history seed (the no-invent rule).
- Kept `restPatchAfterSet` and `restRemaining` tests unchanged (that logic is unchanged).
- Kept `rest-cue.test.js` unchanged (the rest-end beep observes `restEndsAt`, unaffected).
- Added the `removeActiveSet` source guard above.

**Acceptance criteria:**
- *Fold works (browser)* — SetLogForm renders whenever not planned-done; RestPill floats
  during rest. Browser confirmation below.
- *Failure/edge (rest bug, req-25)* — mechanism untouched + source-guarded; reasoned
  above. Browser confirmation below.
- *Self-paced (browser)* — Complete is never gated by `resting`; the form is live during
  rest. Browser confirmation below.
- *No regression* — `./check` green; rest tests kept, folded-away tests removed with
  justification.

## Workflow

- Both decisions (D1 remove-view, D2 self-paced) implemented as written; controls are
  Previous/Skip/Complete (no "Next").
- Consequences of the decisions I made explicit (flagging, since they remove behaviour):
  (1) the pill carries **no Pause/+30s** — those belonged to the blocking bar; with rest
  now purely informational + dismissable (the req's words) they don't fit a small pill,
  and self-pacing removes their purpose. (2) The req-27 progression ↑/↓ marker is dropped
  with `RestUpcoming`. Both are within D1/D2; both are easy to reconsider if Emilio wants
  them back on the pill or the form.
- Pill placement: fixed, top-centre — clear of the top-left Exercises link, the top-right
  Add-note control (req-80), and the bottom set-log action bar (req-80). A chosen default,
  tweakable.
- **Could not run the browser checks** — the Chrome extension isn't connected in this
  session, so the three ux-feel criteria (fold, self-paced, and especially the req-25
  Previous-then-forward timer edge) are unverified beyond `./check`, the source guard, and
  the reasoning above. This is the ux-feel gate + the hard failure case — please exercise
  the Previous-then-forward path in a browser before/at merge.
- No schema/data change. Candidate `DEC-`: "rest is informational, not a control surface
  (no pause/+30s); the next set is always live during rest" — Emilio's call to record.
