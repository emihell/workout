# Backlog

Things to build. **Nothing here is a requirement yet** — each becomes a
`work/req-NN-name.md` when it comes up, and only a `READY` requirement (behaviour
questions answered) goes to Claude Code (`rules/WORKFLOW.md`).

Seeded 2026-09-06; revised 2026-09-07 (code review, gym-flow view review, Emilio's
direction). Ordered against the milestone below, not a flat list.

## The order Emilio set (2026-09-07)

> *"before we build anything heavy, i want the actual flow of using the app in the
> gym to be flawless. then the flow to create programs — that is probably the most
> difficult flow."*

```
Phase 1  the in-gym usage flow is flawless        ← now (stays browser-only)
Phase 2  the program-creation flow                ← next (the hard one)
Phase 3  the heavy build                          ← gated on the backend decision
         (database + users, own exercise DB, animations, AI, full styling)
```

---

## Phase 1 — the in-gym flow, flawless  (now)

The bar: starting a workout, logging every set, warm-ups / extra sets / skips,
resting, finishing — zero friction, zero lost input, zero ambiguity — on a phone, in
a gym, one-handed. UX hardening on the **existing** browser-only app; no backend, no
new data model.

**Grounded in the 2026-09-07 gym-flow review** (views + live-workout flow). Finding:
the logic layer is sound — the state machine, rest timing, snapshot-on-start,
skipped-at-finish and draft-on-switch all work. "Flawless" is mostly a **design/UX
pass on ~4 screens** plus a few gym-ergonomic gaps. These are the candidates:

> Historical list (2026-09-07). All shipped since: req-01, the styling reqs, the rest cue/wake-lock, req-24.

- **`req-01` guard `saveState`** (SHIPPED) — the persist path can throw and
  lose data silently; the floor under "flawless". `work/req-01-guard-savestate.md`.
- **Style the live-workout screens — the core of "flawless".** The app currently has
  **zero CSS** (raw HTML; set-to-set navigation is small text links). One-handed in a
  gym that is the biggest friction there is. Big tap targets, current-set focus, thumb
  reach, legible numbers across `Start → Workout → log → rest → Finish`. Here "style
  the app" and "flawless gym flow" are one job; the full app-wide design language
  stays Phase 3. Expect heavy iteration + the "use it" gate (`rules/WORKFLOW.md`).
- **Rest-end cue + keep the screen awake.** Rest is a stored endpoint + a 250ms
  interval that only ticks while the log screen is foregrounded — no sound / vibration
  / notification when rest ends, and no wake-lock (screen can sleep mid-set). Add a
  rest-done cue and hold a wake-lock during an active workout. Behaviour Qs: which
  cue(s), and how to respect silent mode.
- **Replace native `alert`/`confirm` with inline UI.** 13 `window.alert`/`window.confirm`
  across the flow (Abandon?, Save draft?, Replace all data?, and a *dead* "Pick effort"
  guard). Jarring on mobile, breaks the one-screen-per-action feel. Inline confirms /
  toasts instead.
- **Abandon should offer save-as-draft** (behaviour call). Switching routines mid-
  workout saves a draft, but **Abandon** hard-deletes the active workout + its logged
  sets behind one confirm — asymmetric for a data-trust app. Decide: offer "save as
  draft" on Abandon?
- **Make "effort = hold" legible** (behaviour call). Effort defaults to **Moderate**,
  and Moderate/Hard hold — so weight only climbs when the user marks a set **Easy**
  and only drops on **Failure**/missed reps. Safe default, but worth surfacing: should
  Finish show "held — effort was Moderate" so loads sitting still is never a surprise?
  (Also remove the unreachable `alert('Pick effort')` guard — dead given the default.)
- **`req-99` reach exercise settings from the routine editor** (READY, held) — Emilio couldn't
  find the **Timed** flag from inside a routine (it lives on the exercise Details editor). Add an
  "Edit exercise settings →" link + a hint when the exercise isn't timed; editing from there returns
  to the routine. Link + hint, not a duplicate control. `work/req-99-exercise-settings-from-routine.md`.
- **History recalc from a non-latest workout** — correcting an old session silently
  overwrites the routine's current loads. Behaviour call: only-if-latest, or always?
- **Auto-backup before a destructive import** — import replaces all state after a
  confirm without offering to download current state first. Also **consolidate the
  duplicated import path** (Today empty-state + Settings both do confirm + applyBackup).
  Speced READY: `work/req-07-backup-before-import.md` (DEC-004: auto-download current state first).
- **Legacy `localStorage` key cleanup** — `workout-mvp-v5..v7` read for migration but
  never removed. Low severity. Speced READY: `work/req-06-legacy-key-cleanup.md`.

### Gym-flow notes — Emilio, 2026-09-10 (from real gym use)

Raw notes captured while using the styled app in the gym. All Phase 1 (gym-flow flawless).
Grounded against the code; disposition + open questions noted. **Not yet specced as reqs** —
several need a behaviour call from Emilio first. Sequencing insight below.

1. **Show the "upcoming" set's weight during rest, editable while resting.** While the rest
   timer runs, surface the next set's prescribed weight and let it be changed then (not only
   once you're back on the log screen). [measured] rest is a workout-level countdown shown by
   `RestBar` (`Workout.jsx:630+`); the next set's seed is `initialSetFields` (req-17). *Disp:*
   READY-able. *Q:* show upcoming only when the weight **changes** from the last set, or always?
2. **Remove the informational text under the buttons.** The lines under the log buttons
   (effort/held/target hints) are clutter mid-set. [measured] set-log form + hint lines in
   `WorkoutItemLive`/`SetLogForm` (`Workout.jsx:~455–460`, the `ExerciseSetupHeader`/cues lines).
   *Disp:* READY-able, small. Pairs with the "effort = hold legible" item above — decide together.
3. **Hide the note field behind an "Add note" button.** Note input is always shown; make it a
   button that reveals the field. [measured] `SetLogForm` renders the note `Textarea` inline.
   *Disp:* READY-able, small. Ties to req-18 (set-edit forms) — see sequencing.
4. **Spatial button rule — forward/primary right, back/previous left.** RECORDED as a rule in
   `rules/DESIGN.md §4` (2026-09-10). *Disp:* needs an **audit req** — sweep every two-action
   screen and fix sides. Touches the same rows/forms as req-20/23/18.
5. **BUG — rest timer doesn't fire on a re-done set after Previous.** "Go Previous after a set,
   then forward → no timer; and a timer that already ran won't run again for that set."
   [measured] `previousSet` (`Workout.jsx:379`) calls `removeActiveSet`, which clears
   `restEndsAt`/`restPausedRemaining` (`store.jsx:311`); re-completing calls `completeSet` →
   `restAfterSet(done)` (`Workout.jsx:321`), which returns **no rest when `done` is true**
   (`finishAfterThisSet`). Likely: after the restore the set counts as the last one, so `done`
   suppresses rest. *Disp:* real bug — spec as a fix req; CC to repro + root-cause. Relates to
   req-03 (persistent rest timer).
6. **Timed exercises (duration sets) — e.g. plank.** Any exercise should be able to carry a
   **weight and/or a timer**; a timed exercise shows a count-**down** during the set that you
   start, with a sound when done. [measured] exercises have `restSec` already (`model.js:41`) but
   no per-set *work* duration; `EXERCISE_TYPES = ['machine','free','bodyweight','cardio']`
   (`ids.js:51`) has no "timed" concept. *Disp:* **biggest of the batch — persisted-data +
   model + UI.** Needs a decision (below). The "sound when done" reuses the still-open rest-end-cue
   backlog item.
7. **Show completed routines on the main (Today) page.** [measured] `Today`/`WorkoutRow` already
   marks a slot `Done {date}` when a covering workout exists (`Today.jsx:29–38`); the ask is a
   visible list/section of what's been completed, not just the per-slot label. *Disp:* READY-able.
   *Q:* today's completed only, or a recent-history glance?

**#6 timed exercises — PARKED (Emilio, 2026-09-10).** Model shape (orthogonal weight/duration
flag vs a new `EXERCISE_TYPES` value) is **not decided yet**; captured as a Phase-1/2 feature but
not to be specced until Emilio picks the shape. Persisted-data ask-gate applies when it revives.

**Sequencing — DECIDED (Emilio, 2026-09-10): refactor fully first, gym-flow notes after.** Finish
the refactor batch (req-16..19) as specced — **pure refactors, no UX change folded in** — then
spec these notes fresh against the refactored code. Cleaner diffs; accepts touching the same files
twice. So notes #1/#2/#3/#4/#5/#7 stay parked here until req-16..19 (at least req-18/23/20) land.
Note: bug #5 is a *logic* defect (rest timer), not a form-layout change, so it does **not** collide
with the UI refactor and could be pulled forward if the timer misbehaviour bites — default is still
after the batch.

**Status (2026-09-10):** bug #5 **shipped as req-25** (rest-on-overview; reproduced + fixed +
verified; see SHIPPED / DEC-013 refinement). The rest specced and queued (all ux-feel, serial):
#2+#3 → **req-26** (declutter set-log), #1 → **req-27** (upcoming weight during rest), #7 → **req-28**
(completed on Today), #4 → **req-29** (button-placement audit, DESIGN §4). Timed exercises (#6) still
PARKED on Emilio's model decision — note: Rowing already uses a "Duration" field (cardio), so a
duration concept partly exists; may inform #6.

### Gym-flow notes — batch 2, Emilio 2026-09-14 (in-gym, on the shipped req-25..31 flow)

Raw notes captured after using the flow that batch-1 (req-25..29) built. All Phase 1. Grounded
against the code; disposition + open questions noted. **Not yet specced as reqs.** Several need a
behaviour call first. Numbered N1..N11 in Emilio's order.

- **N1 — empty-today Start → "Start new workout" (ad-hoc).** When nothing is scheduled, the Start
  should start a workout, not sit dead. [measured] `TodayEmpty` renders Start **disabled**
  (`Today.jsx:191`); `startOrContinue` requires a `routineId` (`workout-actions.js:14`) — no
  ad-hoc/blank-workout path exists. *Disp:* needs a decision. *Q:* start a **blank** ad-hoc workout
  (new model capability) or open a **routine picker**?
- **N2 — timed exercises.** *Already captured* as batch-1 **#6**, PARKED on the model-shape decision
  (Emilio 2026-09-10; above). Not a new item and not yet a req — still waiting on his call
  (orthogonal weight/duration flag vs a new `EXERCISE_TYPES` value). Persisted-data ask-gate applies.
- **N3 — Continue lands straight in the current exercise, not the overview.** [measured]
  `startOrContinue` resumes onto the Workout **overview** (`/workout/:routineId`, `overview.jsx`
  lists items); the current item is already computable (`itemCurrentPath`/`completed`,
  `overview.jsx:105,136`). *Disp:* READY-able, small. *Q:* define "current" = first not-done item?
- **N4 — active-workout affordance from elsewhere in the app** — a floating button, or a signal on
  the Workout tab. *Disp:* ux-feel, READY-able. *Q:* floating persistent Continue vs a badge/dot on
  the tab (recommend the tab badge — a floating button competes with the log UI).
- **N5 — rest timer as a small floating pill, folded into the next-set page.** Shrink the rest UI to
  a pill/button (absolute), and on completing a set move **straight to the next set** carrying the
  rest pill — removing the dedicated timer screen and one button press. [measured] rest is the
  persistent `RestBar`/rest view (`workout/rest.jsx`; req-25 rest-on-overview + req-27 upcoming
  weight shipped here). *Disp:* ux-feel, **medium — reworks the surface req-25/27 built.** *Q:*
  confirm removing the dedicated rest view entirely.
  **SHIPPED as req-78 (2026-09-16), DEC-048.** Two consequences Emilio judged "nice to have" —
  **deferred, not scheduled:** (a) re-add **+30s / Pause** to the pill *if* real gym use wants to
  extend a rest (DEC-048 allows an optional nudge without contradiction); (b) **re-surface the req-27
  progression ↑/↓ marker** somewhere on the next-set form (it was dropped with the RestUpcoming panel).
- **N6 — bigger done/not-done contrast in the active exercise list.** De-emphasize done exercises so
  the eye lands on the not-done ones. [measured] `overview.jsx:110` shows only a `· done` text
  suffix; no visual de-emphasis. *Disp:* ux-feel, small, READY-able.
- **N7 — during an exercise: Previous/Skip/Next to the absolute bottom; "Add note" a small control
  beside the exercise title.** [measured] pairs with DESIGN §4 button placement (req-29 shipped) and
  req-26 (note behind a button). *Disp:* ux-feel, small–medium.
- **N8 — dev-only "note on this page" button** (very small/unimposing) — jots a note tied to the
  current page/route so a req can be made from it (an in-app backlog-capture pipe). *Disp:*
  **meta/dev-tooling, not product** — unusual scope. *Q:* build it (where do notes persist —
  localStorage? exported how?), or keep capturing verbally? Recommend a dev-flag-gated localStorage
  jotpad with export-to-clipboard, never shipped to the live build.
- **N9 — a set-setting changed mid-workout becomes the future default.** e.g. bump 4kg→5kg in warm-up
  → 5kg is the default next time. [measured] prefills already come from the **last finished workout's**
  per-field value (history-prefill rule / DESIGN §1; req-17 `initialSetFields`) — so after *this*
  workout finishes, the next prefill is already 5kg. What is genuinely new/unclear: does he also want
  the change to (a) update the **routine template's** prescribed value immediately, and/or (b) apply
  live to the **remaining sets of this same workout**? *Disp:* **needs a behaviour decision — brushes
  the core prefill rule.** *Q for Emilio.*
- **N10 — auto-complete a finished routine.** When every exercise is done, a ~10s "great job" summary
  (stats/improvement vs last time), then auto-finish with an option to edit — minimize taps vs the
  current "all done → press Finish". [measured] Finish is a manual Row (`overview.jsx:116`) →
  `WorkoutFinish`. *Disp:* ux-feel + behaviour; auto-writing a finish touches data-trust. *Q:*
  auto-finish on expiry vs countdown-then-confirm (recommend countdown with a visible Cancel/Edit,
  auto-commit on expiry).
- **N11 — Today page: drop the duplicate "Completed today", and maybe unify the list model.**
  [measured] a workout finished today renders in **both** "Completed today" (`Today.jsx:301`) **and**
  the recent peek (`:314`) — a genuine duplicate. The Today screen is one file with ~8 sub-components
  and overlapping state flags (`activeStartedToday`/stale/done/`completedToday`); a prior unification
  attempt, **req-32**, was **dropped** (DEC-025). *Disp:* dedup is READY-able-small; the broader
  refactor is dropped-req-32 territory — decide whether to revive it. His "several components → weird
  states" read is half-right: one file, many blocks, real state overlap.

- **Load recommendation is retired-in-practice (req-96 aftermath).** [measured, corrected 2026-09-17]
  Only `formatProgressionLine` was actually dead → deleted in **req-97**. The rest is LIVE:
  `buildFinishProgression`/`progressionForItem` still feed `applyProgressionToRoutines`
  (`store.jsx:351,377`), which updates routine templates at finish (a no-op without RPE, but wired); the
  persisted `workout.progression` field is write-only but harmless. *Open (not urgent):* the RPE-driven
  progression is retired in practice because RPE isn't logged — a later req could decide whether to keep
  the routine-template auto-update at all. Not dead code; a product call. See DEC-050 / req-96 / req-97.

- **req-85 v1 timed gaps (deferred).** (a) **set-edit.jsx has no duration field** — you can't edit a
  logged timed set's duration in history (only live logging is editable, `SetLogForm` DurationTimer).
  (b) a timed **bodyweight** set still asks effort. Small; unblock when timed logging is actually in use.
  Discovered via req-98 (which fixed the beat-last-time timed comparison, not these).

**Sequencing insight:** N3/N4/N5/N6/N7 are ux-feel refinements on the shipped in-gym flow and can be
specced fresh against the current code (batch-1's "refactor first" collision is past — that flow is
merged). N1/N9/N10 carry behaviour decisions; N2/N8 are their own decisions. Order once decided.

### Gym-flow notes — batch 4, Emilio 2026-09-17..20 (in-app feedback JSON, app `378e47f`)

Pasted 2026-09-23. [measured] `git log 378e47f..main -- src` is empty, so every note still applies to
live code. All Phase 1. **All specced and LIVE 2026-09-23** (req-103..112, see the mapping line below). F1..F10 in Emilio's order.

- **F1 — routine editor list is messy; two lines per row? drop "Main".** `/routines/:id`.
  [measured] `Routine.jsx:154` renders `name — Main · WU set · 3 sets · 20/22/24 kg` on one line
  with Up/Down buttons beside it. req-93 already made main implied in the *workout* list; the editor
  was not touched. *Disp:* small, READY-able: name line + muted meta line; main unlabelled (req-93 rule).
- **F2 — "if I can't do a machine I should be able to add another exercise"** (workout overview).
  [measured] no path exists: the workout's items are a snapshot fixed at Start (`model.js`), and
  setup (`workout/setup.jsx`) only edits an existing item's exercise details. *Disp:* medium,
  **behaviour Q:** *swap* this exercise for another (the original counts as skipped) vs *add* an extra
  exercise to the list, or both. Pairs with F8. Writes `activeWorkout.snapshot` (transient, no schema bump).
- **F3 — done view: "don't need to show Previous".** [measured] `WorkoutItemDone` (`item.jsx`) renders
  Today sets, then a **Previous** section (last finished workout's sets). *Disp:* tiny, READY: remove it.
- **F4 — at the start of an exercise, a small preview of all its sets + weights at the bottom** of the
  log screen, "so you can grab all weights at the start". [measured] nothing like it; each set's seed is
  computed only for the current set (`initialSetFields`, `item.jsx`). *Disp:* small–medium. **Guard
  (DESIGN §1):** each preview line must come from the same seed the log form would show for that set
  (history per set index / carry / target); a no-history set shows no kg, never an invented one.
  *Q:* show only before the first set, or always (shrinking as sets are logged)? Recommend always.
- **F5 — log screen: exercise title much smaller.** [measured] `ExerciseTitle` uses the page `Title`
  (`item.jsx`). *Disp:* tiny, READY.
- **F6 — Finish: make it the last row of the list or its own thing at the bottom; when everything is done
  make it easy to press (floating button?).** [measured] Finish is a lone `Row` in a second `List` right
  under the exercises (`overview.jsx`) so it reads as another exercise. When all are done the req-84
  auto-complete summary replaces the list — but once Cancelled, the plain Finish row is all that's left.
  *Disp:* small. *Q:* recommend a bottom **Finish button** (not a row) that turns **primary** when all
  exercises are done; a floating button only if that isn't enough (DEC-048 already floats the rest pill).
- **F7 — "able to add notes here as well"** (workout overview). [measured] the only workout-level note is
  Finish's `overallNote` (`finish.jsx:23`, component state), and auto-complete finishes with
  `overallNote: ''` (`auto-complete.jsx:50`). *Disp:* small–medium: a note on the overview, held on
  `activeWorkout` (optional transient field, no schema bump), pre-filling Finish's Note — and
  auto-complete must carry it, or the note is silently lost.
- **F8 — "add ability to skip whole exercise?"** [measured] only per-set Skip exists (`skipSet`,
  `item.jsx`). *Disp:* small–medium. *Q:* recommend "Skip exercise" = log every remaining set as skipped
  (the same record `skipSet` writes), so history shows it was skipped, not missing. Pairs with F2.
- **F9 — "set 1 change also changes set 2 — each set is separate".** Push-ups (bodyweight → reps).
  [measured] **this is req-83 working as built** — `nextSeedOverrides` (`workout-log.js:244`) carries a
  changed weight **and** reps to the remaining sets of that exercise; Emilio chose that live-apply on
  2026-09-16 (req-83 §Decisions, option (c)). **A reversal — his call.** Options: (a) remove the carry entirely; (b) keep the
  weight carry, stop the reps carry (reps targets are per set; a weight change is usually meant for the
  rest). Recommend (b).
- **F10 — Today: "show 2x routines or similar if a day has more than one routine".** [measured] today
  renders one full `TodayWorkout` block per routine (each with its own date line + full-width Start,
  `Today.jsx:310`); the upcoming peek shows the next 2 *slots*, so a future day with two routines fills
  both rows with the same date (`Today.jsx:223`). *Q:* **which surface** (today's block, the upcoming
  peek, or the schedule) and what should "2x" look like (a count badge, one date header with the routines
  grouped under it)?

- **History detail still prints "Main"** (req-103 follow-up) — `history/detail.jsx:68,120`; apply the req-93 rule. Small.

- **Done view: exercise title renders below Add set** (req-104 follow-up) — `WorkoutItemDone` markup order. Small.

- ~~**Tooling: `npm run shot` can't reach states behind a click**~~ — already done on main (req-129: `--click`, `--scroll-bottom`); req-168 confirmed. (req-105) — add `--click <text>` / `--scroll-bottom`.

- **req-111 follow-ups:** ~~(a)~~ ~~(b)~~ — both fixed (req-128/req-152; warm-up-only prior skip in req-163). Was: (a) the auto-complete "vs last time" volume (`workoutSummaryStats`) still compares
  against an all-skipped prior; (b) an exercise with only warm-up history gets neither a work prefill nor the
  DEC-002 kg carry (pre-existing). Small.

- **req-109 follow-ups:** (a) ~~Q: Skip exercise leaves a running rest going~~ — **keep** (Emilio, DEC-056). ~~(b)~~ fixed in req-128 (pinned by req-163). Was: `historyPrescription` / beat-last-time take the FIRST snapshot item of an exercise, so after a
  replacement they read its rest 0. (c) routine lost per-set weights on a skipped set → **fixed in req-112** (DEC-056).

**On-device test list — CLOSED 2026-09-24, run by Planner, not Emilio** (desktop Chrome at 500 px + a 375 px iframe,
throwaway `main` build `9f7ebcc` on `127.0.0.1`, seeded from `src/db.json`; Emilio: touch/one-handed feel is caught in real
use). **12/12 pass** — results below the list. Items: 1 routine-editor rows two-line, no "Main" · 2 log title smaller,
Add note beside it · 3 done view has no Previous · 4 Finish is a bottom button, black when all done · 5 set preview
before set 1, gone after · 6 overview note → same on Finish, survives reload · 7 push-ups set 2 shows its own target;
weight change carries · 8 two-routine day under one date · 9 Skip exercise two-tap, row reads skipped · 10 Replace →
original skipped, blank replacement under it · 11 after a skip, weights come back from the last real time · 12 Finish
leaves the routine alone; History correct → Apply changes it.
Results [measured, browser]: 1 rows "WU set · 3 sets · 25/30/30 kg", no Main · 2 title + Add note on one row · 3 done view
has no Previous · 4 Finish `rgb(242,242,242)` → `rgb(28,28,28)` all done · 5 preview before set 1, gone after · 6 note kept
through reload and shown on Finish · 7 pull-ups 4 reps on set 1 → set 2 shows 5; kg 18→20 on set 1 → next set 20 · 8 two
routines under "Thu, Sep 24" · 9 two taps (3 s arm) → "· skipped" · 10 Leg Curl skipped, Lat Pulldown under it, kg from its
own history · 11 after the skip Leg Extension prefills 9/18/22/25 (last real) · 12 routine unchanged by Finish; History
edit → Update? → Apply → routine [65,70,70].

**QA findings, Planner's browser run 2026-09-24** → **`req-152`** (READY, after req-24):
- **QA-1 Back after Finish lands on "Not found."** — after Save, browser Back goes to `#/workout/<id>/finish` → bare
  "Not found.", one more Back → the done workout. The finish route stays in history after save.
- **QA-2 rest pill's tap area overlaps Back at 375 px** — pill `[103,8,272,54]` vs "‹ Exercises" `[24,40,115,84]`
  (12×14 px). Text isn't covered; a tap on the link's top-right can hit the pill (skip rest). Batch-3 "pill overlap".
- **QA-3 Add set on a done exercise prefills reps but not kg** — Leg Press done at 70 kg → Add set shows kg blank, reps
  10, though `withOneMoreSet` appends the last suggested weight (`workout-log.js:34-44`). Weight should carry (req-108).
  Cause [inferred]; check the seed for an added index.
- **QA-4 History detail doesn't say skipped** — a fully skipped exercise reads "WU set · 4 sets" (the overview says
  "· skipped").
- Minor: Apply on a cardio item writes `suggestedWeights` `[]` → `[0]` (not shown anywhere today).
- Import asks "Replace all data?" before validating → fixed in **req-24** (merged).
- **Dead first Back after finishing an exercise** (parked, DEC-084 — req-153's fix dropped as too fragile). History ends
  `[…, /workout/x, /workout/x]`, so the first device Back does nothing. Idea to try, small: on a popstate that lands on an
  entry identical to the one just left, step back once more. Test on the iPhone before merging anything here.
- **req-152 follow-ups** → **`req-153`** (a, b, d; c stays Emilio's) (small; from the reviewer + Builder): (a) after an overview → item (push) → last set → replace
  back, history holds `/workout/x` twice, so the first device Back visibly does nothing (`item.jsx:99,110,304,316`,
  `replace.jsx:31`); (b) after Save, the **second** Back reaches an earlier in-workout item page → "Not found." once the
  workout isn't active; (c) the pill's reserved top space (~30 px, always) — Emilio to judge on the phone; (d) 4 of
  req-152's tests are source-regex guards (brittle).
- **req-24 reviewer nits** → **`req-153`**: the no-native-dialog guard misses `window['confirm']`,
  `const { confirm } = window`, `.mjs` files, and skips lines starting `*` (`req-24.test.js:17,30`); Today's first-run
  import error (`Today.jsx:269,330`) isn't cleared on a later cancel/new pick.

**Batch-3 feel list — CLOSED 2026-09-24** (Planner, same run): pill overlap → **QA-2** · iPhone no-zoom: every input/textarea/
select ≥17 px on log, routine editor, exercise edit, history add set, finish, replace [measured]; the zoom itself is
device-only, untested · beat line reads "↑Heavier on Incline DB Press" (judgement: clear) · Timed: the routine editor
says "Not timed. Edit exercise settings to add a duration." (judgement: findable).

- **Dropped report items (retro 2026-09-23), small:** Abandon falls below the fold with the overview note open on
  an 8-exercise routine (req-107); the `.ui-navlink` left inset misaligns a second line under a link (req-103 gotcha).

- ~~**Tooling: the pre-push fast-forward guard false-positives**~~ — already fixed (req-129); req-168 sandbox: 5 empty branches pass, a real FF refused. when a req branch was just created at main's tip
  (2026-09-23: `req-120 (1dd4b54)` refused while the build agent hadn't committed yet). Exempt a branch with no
  commits beyond main. Small.
- ~~**Tooling: `plan publish` reads a throwaway agent's nested worktree**~~ — already fixed (req-129); req-168 confirmed. (`workout-codebase/.claude/worktrees/agent-*`)
  as the code worktree and refuses ("code worktree is on 'req-120'"), 2026-09-23. Resolve the code worktree by exact path.
- → **`req-168`** · **req-117 follow-ups (low):** (a) no component-level test that History's Add set doesn't write before Save, or that
  `item.jsx` passes the restored duration to the form (covered by puppeteer only) — a small jsdom/puppeteer smoke;
  ~~(b)~~ fixed in req-163. Was: History Add/Edit set can't capture `durationSec` for a timed exercise (pre-existing, joins the req-85 gap).
- → **`req-168`** · **req-119 follow-ups (low):** the logged-sets branch of `exerciseInActiveWorkout` is untested (probably unreachable);
  legacy `draftWorkouts` aren't counted as references.
- ~~**Tooling: `plan closeout` warns when … names no reviewer**~~ — done in req-166 (it refuses before merging).

**Specced 2026-09-23:** F1→req-103, F3+F5→req-104, F6→req-105, F4→req-106, F7→req-107, F9→req-108 (DEC-052), F10→req-110; F2+F8→req-109 (blank-state replace; external review found the migrate-on-load blockers); review also found → req-111 (DEC-053). **Grouping (original):** one small ux batch F1+F3+F5+F6 (F6 after its Q); F4, F7 each on their own; F2+F8 one req
(both are "I can't / won't do this exercise"); F9 a decision, then a small change; F10 needs clarifying.

### Flow audit — 2026-09-23 (5 parallel read-only reviewers; every item carries evidence in its reviewer's report)

Emilio asked for a start-to-finish scan of every flow plus component-library use. 34 new findings. **Tier 1 (A–G) SHIPPED
2026-09-23 as req-114..120** (DEC-058); Tiers 2–3 below are still open. Planner spot-checked
the top three in code (`Routine.jsx:305-309` splits kg on `,`; `store.jsx:379` runs `applyBackupFn` inside the
setState updater; `model.js:124-130` backfills empty targets/weights from logged sets). **Not yet specced.** Grouped
into proposed reqs. **[P]** = persisted-data / shared-model (DEC-057: reviewer + backup before merge).

**Tier 1 test list — CLOSED 2026-09-24, run by Planner** (same run as batch 4): **10 pass, 1 by unit test only** — #3
midnight needs a faked clock; covered by `dates-tz.cases.js:82` (23:50 → 00:05 current), not browser-run. Pass [measured]:
#1 `22,5` → `[22.5,22.5]`, `8/8/8` on 2 sets → "2 sets, 3 reps given." · #2 analytics file → "Not a workout database
backup.", data intact (3 routines, 13 workouts) · #4 Push/Pull in progress, Upper still Start · #5 Edit → Hard → Back: no
countdown, Hard kept · #6 Back after save shows Done, no Start · #7 "Nothing logged." · #8 Remove set → 4 sets again · #9
Cancel → workout byte-identical · #10 archived, workout finished with its 4 sets · #11 stored `[]`, empty after reload.
Items: 1 routine editor: Kg "22,5" saves 22.5; Sets 2 + Reps 8/8/8
shows an error · 2 importing the analytics file shows an error, app stays up · 3 a workout past midnight stays the Today hero ·
4 two routines today, one in progress → the other still has Start · 5 all done → Edit → pick Feel → Back → no countdown, Feel
kept · 6 after Finish, Back never offers Start · 7 skip everything → Finish says "Nothing logged" · 8 Add set on a done exercise
→ Remove set undoes it · 9 History Add set → Cancel leaves the workout unchanged · 10 delete an exercise you're using mid-workout
→ archived, the workout still finishes · 11 clear a routine's Kg → reload → stays empty.

**Tier 1 — data and trust bugs**
- **A. Routine editor parsing** (`Routine.jsx:305-322`): kg `22,5` → 2 sets `[22,5]`; lowering Sets doesn't take
  (count = max of all lists); a non-numeric kg shifts later weights onto the wrong sets (`abc/20` → set 1 = 20);
  negative kg accepted; a blank Duration → a `0` s target (beats the exercise default). *Q:* accept `,` as a
  decimal point (Swedish keyboard)? Recommend yes, with `/` the only separator.
- **B. Setup edits reach into the live workout [P]:** deleting an exercise or routine that's in the active
  workout hard-deletes it (`store.jsx:44-66,191-200` count only finished workouts), so history later points at
  nothing, and Today shows the first-run "No data" screen mid-workout (`Today.jsx:268`). A Library edit (type,
  Timed) changes the live set form (`item.jsx:35-44,295`) although the snapshot says otherwise (DESIGN §3).
- **C. Load-time backfill invents plan values [P]** (`model.js:124-130`): an item with empty targets/weights gets
  them from the logged sets on every load, on history and on the active workout. A mid-workout reload gives
  set 2 a target from set 1's reps (DESIGN §1). Limit it to legacy (pre-v9) snapshots.
- **D. A bad import blanks the app** (`store.jsx:379-386`): `applyBackupFn` throws inside the updater and above the
  ErrorBoundary. Reachable by picking the analytics export. Stored data survives. Also: a v9 value that parses to
  a non-object is overwritten and the v8 key deleted (`storage.js:169-178`, nit). Validate one level deeper.
- **E. Finish navigation:** Back from Finish when all done re-arms the 10s auto-finish and drops the chosen Feel
  (`finish.jsx:24,53`, `overview.jsx:45`), measured in the running app. After Finish, browser Back lands on a working
  Start for the same routine (navigate with `replace`, measured).
- **F. Irreversible taps:** a mis-tapped "Add set" on a done exercise can't be removed and writes a skipped set
  (`item.jsx:469`, `workout-log.js:26-57`); Previous on a timed set loses its duration (`item.jsx:132-142`); History
  "Add set" writes a placeholder set before Save (`history/helpers.js:81-120`).
- **G. Dates and schedule [P for the anchor]:** the workout preview uses the UTC date (`overview.jsx:55`; found by
  two reviewers); an imported schedule has no `anchor`, so weeks 2–4 never show (`exchange.js:109`, `schedule.js:32`);
  the anchor is parsed as UTC (`schedule.js:7,32`); Today doesn't clamp `loopWeeks` (`Today.jsx:244`); `Done` prints a
  raw ISO date (`Today.jsx:104,132`).

**Needs Emilio's call**
- **Midnight:** a workout started 23:50 stops being the Today hero at 00:05, and Start then offers to abandon it
  (`Today.jsx:257`, `workout-actions.js:44`). *Q:* stale = started more than N hours ago?
- **Two-routine day while one is in progress:** the hero hides the second routine (`Today.jsx:328`; the gap between
  DEC-038 and req-110). *Q:* show the hero plus the remaining routine under the date?
- **Finish with nothing logged** saves a workout of skipped sets and marks the day Done (`workout-log.js:112`); the
  auto-finish does too after Skip ×N. *Q:* warn and offer Abandon?
- **Changing the loop length** moves "this week" (`store.jsx:127-136`). *Q:* re-anchor?

**Tier 2 — component library** (adoption is high; findings are concentrated) → **SHIPPED 2026-09-23 as req-121..123**
- 5 navigation-only `<Button onClick={go}>` → NavLink (DEC-040): `Today.jsx:221`, `Routine.jsx:96,365`,
  `setup.jsx:70`, `auto-complete.jsx:93`.
- The `App.jsx:36,54,73` banners are raw unstyled divs and the Reload button is raw → `Banner`/`Button`.
- The library `NavLink` (`ui/index.jsx:32`) is imported by 0 views; views hand-add `ui-btn …` classes 10× → one
  NavLink with a `look` prop. An `Actions` row primitive (12 `ui-actions` sites), fixing `history/list.jsx:44-45`
  (Continue left of Abandon).
- `--ui-fs-lg` is undefined and `28px` hardcoded (`ui.css:578,611`); dead `.ui-showcase__row`; Showcase lacks
  secondary/quiet/block buttons, back-chevron and button-look NavLinks, and two-action rows.
- Tap targets below 44px: `.ui-addnote` ≈ 22px on the in-gym screens (`ui.css:660`). Long unbroken names overflow
  at 390px (no `overflow-wrap`).

**Tier 3 — improvements** → **SHIPPED 2026-09-23 as req-124..129** (DEC-059) — *except* its dead-code items: `plannedWorkouts` and route.js's unread visit stack are still on `main` (audit 2026-09-24); Phase 2 items stay for program-creation planning
- A replacement starts with 1 set (a 3-set swap costs 6 extra taps); Replace should land on the new exercise.
- Typed-but-uncompleted set values are lost on navigation/reload (`SetLogForm` local state). Keep a draft on the
  active workout.
- Wake-lock holds for a days-old stale workout (`wake-lock.js:21`); Finish's "N sets" counts skipped sets.
- Dead code: `plannedWorkouts` is never written [P]; `nextOccurrence`/`nextDateForSlot` have test-only callers;
  route.js's visits stack.
- Setup data quality: free-text weight step and invented catalog steps (`exerciseCatalog.js:131`); blank or
  duplicate names; re-adding an archived exercise splits its history (no un-archive); Start on an empty routine
  (`Routine.jsx:68`).
- **Phase 2 input** (routine-creation friction): four parallel slash-strings (Sets/Reps/Kg/Duration) → a per-set
  grid; the catalog search should be in the picker, multi-select; required Focus; one tap per reorder step; per-item rest.
- Tests: TZ-set schedule tests; a StoreProvider render test for import; a v9 snapshot round-trip test.
- ~~Stale backlog notes~~: native-dialog count is **14** (req-24); N1's "Start disabled" was fixed by req-82 (routine picker).

### Exercise library + "how to do it" — Emilio 2026-09-24 (DEC-060)

- **`req-130` our own library** (READY) — free-db copy + aliases + muscle groups + picture links + RepDB credit.
- **`req-131` "How to" button** — log screen + exercise page; opens free-db start/end photos
  auto-flipping (~0.7 s), else the exercise's video link; hidden when none. **No RepDB pictures (DEC-069).** Shows our
  text (req-138). Mind: a renamed exercise keeps its `libraryId` (req-130), so the picture follows the id. New optional
  per-exercise **video link** field (edit form). Uses `libraryEntryFor` (req-130). Offline → cues only, no broken
  image. After req-130.
- **`req-132` one Add screen** — replaces Add manually / Search: typing shows your exercises first (req-127 match),
  then library hits (tap = add, linked), then "Create '<name>' as my own". Offline: no library hits, never blocks.
  Plus **"Link to library"** on an unlinked exercise's page (best alias matches; optional). After req-130.
- **`req-133` content pass** — per entry: **aliases for the whole library** (moved from req-130), a one-line
  description, tips, instructions rewritten clearer. Written from
  free-db's instructions + general knowledge; **never from RepDB text** (DEC-060 §3). Content job for agents in
  batches, sample-reviewed. After req-130.
- **`req-134` muscle search + filter** — group chips (beginner) with "More specific" → muscles/parts (advanced);
  several = either, "must hit all" toggle (DEC-062 §5); the search box also matches muscle aliases ("deltoid").
  **Rank `common` entries first** in search — receipt: "air bike" → Fan Bike (free-db's crunch is *named* "Air Bike",
  so no alias can win it; req-133 left it) and "shoulder press" → Dumbbell Shoulder Press (today Shoulder Press - With Bands).
  Custom exercises need a muscle pick from the same tree (stored field → persisted-data). After req-133.
- **`req-135` alternatives button** — same pattern + same primary muscle, family first, your equipment first;
  linked exercises only until custom ones have muscles. After req-133 (+req-134 for custom).
- **Assisted machines log backwards** (req-133 tag review, for req-132): on an assisted pull-up/dip machine the kg is
  *assistance*, so a higher number is easier, but `progress.js` reads more kg as progress. The own-assisted-* entries
  are `weight-reps` for now. Needs a decision (an `assisted` logAs, or inverting progress for it) before req-132 sets
  type from `logAs`. Also note: Hyperextensions / Russian Twist are `bodyweight-reps` but are often done with a plate.
- **`req-138` library text pass** (READY — `work/req-138-library-text-pass.md`; split from req-133 by its spec review) — for the common entries: `description`
  (≤120 chars), `cues` (2–3, ≤70 chars each), `steps` (≥3, clear), `mistakes` (1–3). Ours, from free-db's
  instructions + general knowledge, never RepDB (DEC-060 §3). Feeds req-131; runs before it.
- **`req-136` "something's wrong" tap** — *mostly covered already*: the feedback note button (req-86..88, behind the
  Settings toggle) works on every screen and records route + exerciseId. Remaining gap: the note doesn't carry the
  **libraryId**. Planning's call 2026-09-24: don't build 136 standalone; fold "add libraryId (and shown name) to the
  note context on exercise/library screens" into req-134.
- **`req-137` offline library + images** — keep the library chunk (and later pictures) available with no signal
  (service worker / cache). Infra; before own images.
- **Emilio's backup conversion** — one-off script: match → show mapping → write on his OK (DEC-063 §2, ask-gate #2).
- **`req-139` library polish** (READY) — display names, ~10 missing staples, search = our library only, common first
  (DEC-064).
- **Order (DEC-064, supersedes DEC-063 §4):** 139 → 138 → 134 → 136 → 132 (+ live library link) → 137 → 131 → 135 →
  own images (pilot early).
- **Gyms (future, Emilio 2026-09-24)** — a user adds their own gym, or picks one from a gym library, and lists its
  equipment, so the app knows what's available and can filter alternatives / build programs within it. Notes for
  the spec: equipment uses the DEC-062 `equipmentList` vocabulary (maybe + specific machines, e.g. "Star Trac leg
  curl"); **weight step belongs to a gym's machine, not the exercise** (the same exercise steps differently per gym
  — DEC-059 §2); a workout needs "which gym am I at" (default: the user's home gym). A user's own gyms fit
  browser-only; a **shared** gym library that users contribute to needs the backend (Phase 3 fork). Feeds
  req-135 (alternatives with what's here) and Phase 2 programs.
- **Programs from the library (Phase 2)** — patterns + muscles + level balance a program. After req-133.
- **`req-140` library parity, batch 1** (READY) — gap table checkpoint, then ≤40 promote/add + aliases + `difficulty`
  + the `staple` flag (DEC-065/066). **Later batches** (req-140b…) work through the queue from the gap table, ≤40 each.
- **`req-143` library triage** (READY) — every rough entry → finish (queue) / merge (alias + hide) / hide (DEC-070).
- **Parity batches `req-140b`…** — ≤40 each from `work/req-140-parity-queue.md` (+ req-143's finish list) until up to par.
- **`req-142` remove RepDB completely** (DEC-069/070) — **only when up to par** (every RepDB exercise covered or
  deliberately skipped; no rough entry shown): drop the Settings credit, RepDB comments,
  `scripts/library-gap.mjs`, the originality script's RepDB comparison, `.vendor-cache/`; req-131 uses free-db photos +
  video link only. Small.
- **`req-141` fresh-eyes library audit** — **after req-142** (DEC-070 §3), over **all** our exercises. A fresh agent with **no RepDB context** audits every common
  entry: displayName, aliases, tags, difficulty, text, the common list; restores natural wording in the 19 entries
  req-138 rewrote for originality (list in `reports/req-138.md`); fixes in place. Final safety net: the ≥12-token run
  check only. A coach-eye QA subagent reviews the diff.
- **Avatars + the app's pixel-art style (Emilio-led, 2026-09-24)** — Emilio wants avatars in the app and calls them
  "crucial to the style of the app"; he'll supply reference pictures and wants to be closely involved (live lane,
  DEC-055: Emilio + session, not a batch). Planning's notes for the spec: **the avatar is the figure that does the
  exercises**, so one character carries the whole app, and exercise figures follow the avatar style (supersedes the
  separate style pilot); build as **skeleton + layers** (body, hair, clothes…) from day 1 so every exercise animation
  works with any avatar; a **dedicated pixel-art agent** (its own definition: grid size, palette, outline and frame
  rules, Emilio's references) plus a **deterministic renderer + validator** (palette-only, on-grid), so consistency
  comes from constraints rather than taste. References: Emilio's own and free-db photos. **RepDB images (DEC-069 §2):
  Emilio wants to browse them for inspiration himself when this starts; they are never given to the pixel-art agent as
  input, reference or conditioning, and nothing is traced from them (RepDB licence term 5).**
  No prior req exists [measured: grep of handoff + git log for "avatar"]. Before own figures.
- **Our own styled exercise figures** (now under Avatars above) (after req-131) — **one base animation per movement pattern** + equipment
  variants (DEC-063 §4), 5-exercise style pilot early; pose keyframes + a shared renderer, animated,
  offline, one style, can show all the time. Prototype 2026-09-24 (leg press, 48×32 pixel sprite, 2 poses
  interpolated) reads but is crude — style needs iteration. **Reference only free-db photos / general knowledge,
  never RepDB images** (DEC-060 §3). Cost [inferred]: ~10–15k tokens per exercise with 2–3 rounds.

### req-176 follow-ups — 2026-09-25
- **Latent (`workout-log.js`):** a snapshot item with neither `id` nor `routineItemId` — skipped sets added for one such item
  count as logged for the next, so Save under-records skips (and the Finish list mirrors it). No known producer (DEC-088
  items keep `routineItemId`). Reviewer-trigger file if fixed.
- **Feel:** fold the unlogged warm-up into the Finish line silently? One-line change in `finishSkippedLine`.

### req-173 follow-ups — 2026-09-25
- **The active set edit (SetEditForm) saves a blank kg as 0 with no note**; History keeps `''`. Add the note there too?
- **Unexplained `targetWeight: 60`** on a stored set whose seed routine item had no suggested weights (req-173 AC3 run,
  seed `db.json` via v8→v9 migration — likely `legacyRecommendations`). Not shown to the user; check before req-144.

### req-171 follow-ups (Back / `?from=`, DEC-092) — 2026-09-25
- **Active workout overview Back → Today** even when started from Routines (treated as the workout's hub). Decide with
  req-144: is the overview "where you came from" or home base?
- **recalc → Routine → an inner editor screen** loses the chain (`navForBase` paths are used as URL prefixes).
- **A stale id with a valid shape** (`/history/<deleted>`) is accepted as `from` → Back lands on "Not found.". Rare.

## Phase 2 — the program-creation flow  (next; the hard one)

- **Deliberate "review and update the routine" step (DEC-056).** Finish no longer rewrites the routine; updating it
  becomes a clean choice, e.g. at the end of a schedule loop (Emilio, 2026-09-23). Shape open: when it's offered,
  what it shows (last loop's actuals vs the routine), per-exercise accept. Note (req-112): the recalc "Update?" screen shows no numbers today. The review step should show them.

Emilio's "we should start creating programs." Today the app has **routines** (reusable
templates) and a **schedule** (weekly slots). A "program" is the layer above: a multi-
week structure that owns routines and their placement. The code still carries legacy
`programs`/`programName` remnants (`model.js`, `storage.js`) — a program layer existed
once and was flattened away; reintroducing it is a redesign, not a fresh start.

- **req-180 picker follow-ups** (QA 2026-09-26, small, ui): the sticky Cancel/Add N bar has no background, so a sliver of
  list shows between it and the dock; empty-search grouping by an entry's *first* muscle group puts Burpee under Chest.
- **`req-150` progression safe-hold** (READY) — the three wrong cases hold instead of guessing (DEC-075).
- **`req-149` progression rules** (later, a design req; DEC-075) — the rules and code for how the app upgrades routines:
  rep ranges, AMRAP, an assisted flag, when to suggest vs apply. Inputs: DEC-056, req-144 prep §A.
- **Progression bugs found by the req-144 prep** (→ req-150 now, req-149 properly) [measured, `work/req-144-prep.md` §A]: a rep-range target ("8-12")
  parses to NaN, so a set can never count as missed (5 reps on 8–12 holds the load); AMRAP progresses on effort only;
  assisted machines progress backwards (a miss lowers assistance = harder). Load recommendations the user sees, so
  these are bugs (CLAUDE.md "reasoning made visible"). Small fix req, independent of the design; the proper model
  (real ranges, assisted flag) comes from req-144.
- **`req-144` creation design** (NEEDS DECISIONS — a design req, no code; planning + Emilio live) — personas, the
  simplicity rule, the parameter table, flows, model + library asks. Absorbs req-10 and the DEC-056 review step.
- **Define the model first** — program vs routine vs schedule; what a program owns, how
  it maps onto the weekly loop, how progression flows through it. A decision doc before
  any build (`rules/WORKFLOW.md`, readiness).
- **Then the creation UX** — the hardest flow in the app. Budget the review, not just
  the build.

## Phase 3 — the heavy build  (gated on ONE decision)

- **`req-146` backend design** (NEEDS DECISIONS — a design req, no code; DEC-073). Why: a real product, other users soon,
  training together (shared routine, own values; one person starts an exercise and it starts for everyone). Decide:
  hosting (own computer vs managed), accounts, the sharing data model, live group sessions, migration from localStorage,
  offline-first in the gym, privacy/GDPR, backups. Planning's concerns to raise: a home server serving other people
  needs uptime, security and backups; live group workouts are a large feature on their own.
  **Part of the server setup (Emilio, 2026-09-24): per-branch previews** — the server also hosts each branch's build
  (static, over Tailscale HTTPS), each on its **own origin** (port or subdomain, never a path under `emihell.github.io`,
  whose `localStorage` holds his real history), so planning can browser-check a branch before merge. No Cloudflare/Netlify.


**The fork that gates most of this: browser-only (localStorage) vs a backend
(client–server)?** "A database" and "users" are effectively the same decision — real
accounts need a server store, and an AI API key can't live in a browser. Decide the
target before starting any of these; each is a milestone, not a `req`.

- **Database (backend).** Move off `localStorage`. Enables multi-device and users.
  Biggest architectural change; needs a migration path from existing local data.
- **Users / accounts.** Depends on the database. Reopens deferred scope (`README.md`).
- **Own exercise database + tagging.** *(Browser-only part pulled forward 2026-09-24 → §Exercise library, req-130.)* Curate our own library (seed from a free open
  DB), tagged with muscles, equipment, movement pattern. **The enabler** for filters,
  recommendations, and AI generation — do it before those. Decisions: which source DB
  and **its licence** (verify each); the tag schema; bundled JSON vs backend.
- **Animations for basic exercises.** *(Pulled forward 2026-09-24 → §Exercise library, req-131 + own figures.)* Demos keyed to the library. Decisions: source
  (make / licence / generate), format (video / gif / lottie), hosting (bundle bloat vs
  backend/CDN). Depends on the exercise DB.
- **AI program generation.** Composes programs from *our* tagged exercises. Depends on
  the exercise DB **and** the program model **and** a backend (key + cost can't sit
  client-side). Falls under the backend rules' ask-gate (DEC-085 §7). `exchange.js` already
  prototypes the "AI edits the database" idea manually.
- **Full visual-design pass.** A real design language app-wide (beyond the Phase-1
  gym-flow polish). Its own milestone.

---

- → **`req-168`** · **req-161 nits** (small): one Import's copies can carry different timestamps when one is reused (no loss; harder to
  group by hand); add the quota → free space → retry → release test (the reviewer's probe passed).

- **→ `req-169` (DEC-089)** — was: known, minor (req-168 review): (a) the delete confirm for setup referenced only by a legacy draft
  says "has past workouts" — a draft isn't a finished workout (wording; the archive is right); (b) an exercise that sits in
  a finished workout's snapshot with zero logged sets isn't a reference, so it hard-deletes — main's behaviour per DEC-031
  (History still renders from the stored `exerciseName`). Emilio's call whether either matters.

## Workflow / tooling backlog (infra, not product)

- **`plan qa --empty`** (2026-09-25): serve a true first-time user. The seed is re-injected whenever storage is empty
  (`scripts/qa.mjs:66-67`), so clearing storage brings the demo back — it misled the beginner-persona run.

- **`check_handoff` knows lanes** (DEC-085 §6, WORKFLOW §Requirement lanes): accept a `Lane:` tag and a `DECIDED <date> →
  DEC-…, req-…` terminal status for design reqs (today `classify_tag` has merged/not-merged/blocked/unknown only,
  `scripts/check_handoff.py:214-247`); give req-146/149 their `work/` docs when they start. Small, tooling lane.

- **[optional, Builder] Slim the readiness taxonomy.** The 6-state tag set (READY / NEEDS DECISIONS /
  BLOCKED / SHELVED / WITHDRAWN / BUILT-MERGED) is more than a solo backlog needs (workflow audit
  2026-09-14 §3). Slimming it means editing `scripts/check_handoff.py:220-248`, which validates the exact
  tags — a Builder/code change for marginal benefit. Do only if the taxonomy actually gets in the way.

- **Per-branch preview deploy** → moved into the server setup (`req-146`, Phase 3), Emilio 2026-09-24.

## Dependency map (why the order is what it is)

```
req-01 (save safety) ─ under everything
gym-flow polish ─ the bulk of Phase 1 (styling + ergonomics on a sound logic layer)
program model ─→ program-creation UX (Phase 2)
              └─→ AI generation (Phase 3)
own exercise DB ─→ filters/recommendations
                └─→ animations
                └─→ AI generation
backend (database) ─→ users ─→ (multi-device)
                   └─→ AI generation (key can't live in browser)
```

## Already built — do not re-spec (review check, `NOTES.md` rail 1)

- **Export / backup + AI-coaching import.** `src/exchange.js` + Settings `Export`/
  `Import` already export the full database as `workout-mvp-backup` JSON (optionally
  with an assistant prompt) and re-import it with a replace-confirm. What's missing is
  only the auto-backup-before-import net (Phase 1).

## Current shape (reference, not a task list)

> Stale (2026-09-12 shape) — the tree below is history. Current module map: `reports/req-164.md` (persistence /
> history-queries / state-reducers / set-rules; storage.js a re-export). Stored fields: `reference/schema.md`.

```
src/
  model.js          entities + invariants; carries legacy programs/programName remnants
  storage.js        localStorage load/save + v5–v8 migrations
  progress.js       load recommendation (valid increments; Easy→up, Mod/Hard→hold, Failure/miss→down)
  schedule.js       recurring week/day slots + loop-week math
  route.js          hash routing (one screen per set/action)
  workout-log.js    live workout / set logging + skipped-at-finish
  exchange.js       backup export + AI-assistant import contract
  store.jsx         the single store (all mutations) + localStorage persistence
  ids.js            id minting + enums (RPE_OPTIONS, weekdays, types, roles)
  exerciseCatalog.js / exerciseExtras.js   exercise library (bundled)
  views/            Exercises, Routine, Schedule, Start, Today, Workout, History, Settings (no CSS yet)
```
