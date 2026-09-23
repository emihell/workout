# Shipped

Append-only narrative of what shipped under this workflow, newest at the bottom. This is
the detail that `NOW.md` points to — `NOW.md` carries only the last few lines, the full
story lives here.

Each entry: the req, one paragraph on what it changed and why, the merge commit, and the
gate result (`./check` green, N tests).

---

## req-01 — guard saveState against a failed write  (merged 2026-09-08)

`saveState` (`storage.js`) now wraps `localStorage.setItem` in try/catch: on a throw (quota
exceeded, Safari/iOS private mode) it sets a subscribable "save failed" signal and never lets
the throw escape the store's `setState` updater; on success it clears the signal. A persistent,
non-dismissable banner in the app shell shows whenever the last save failed and clears on the
next success (DEC-001). The successful write is byte-for-byte unchanged. The signal is an
external store consumed via `useSyncExternalStore`, chosen so `saveState` stays a plain
node-testable function and the updater is untouched. Merge `ac72dbf` (branch
`req-01-guard-savestate`, `85d3887`). `./check` green, 57 tests (3 new). Browser gate: banner
verified showing on a forced `setItem` throw and clearing on reload.

## req-05 — error boundary so a render crash doesn't blank the app  (merged 2026-09-09)

New `ErrorBoundary` class component wraps `<Screen/>` inside `<main>` (`App.jsx`), so a
render-time throw on any screen shows a self-contained fallback (a "data is saved" reassurance +
Reload button + Back-to-Today link) instead of unmounting to a blank page, keeping `Nav` and the
save-failed banner visible. The boundary clears its error on `hashchange`, so navigating to a
working screen recovers without a reload (DEC-007). `react-test-renderer` added as a devDependency
to prove the catch on a real render throw. Merge `013beb6` (branch `req-05-error-boundary`,
`1e23f0e`). `./check` green, 59 tests (2 new). Browser gate: fallback rendered in place with Nav
intact, and clicking Routines recovered the app (verified 2026-09-09).

## req-03 — persistent workout-level rest timer  (merged 2026-09-09)

The rest counter used to vanish the moment you left the single set-logging screen: rest state
was workout-level and persisted (`activeWorkout.restEndsAt` / `restPausedRemaining`), but the
countdown UI and its 250ms tick lived only inside `WorkoutItemLive`. Fixed (DEC-003) by lifting
it into one self-hiding `RestBar` rendered on every in-workout screen (overview, item log,
review, finish, plus exercise-edit and set-edit — the two extra mid-rest-reachable screens),
driven by the shared `useRestCountdown` hook; `RestBox` removed so there is exactly one rest UI.
The pure recompute was extracted to `restRemaining(active, now)` in `workout-log.js` and
unit-tested (recompute-not-frozen, paused, expiry, no-rest). No auto-start between exercises
(declined, DEC-003). Merge `f54aa86` (branch `req-03-persistent-rest-timer`, `7ed39e3`).
`./check` green, 63 tests (4 new). Browser gate (run by the planning session at Emilio's
direction, 2026-09-09): counter persisted 88s→75s across item→overview navigation, Pause on the
overview showed "Paused" on the Finish screen with the controls, Skip cleared the bar, and the
bar self-hid when no rest was active.

## req-02 — carry entered kg+reps to the next set for a no-history exercise  (merged 2026-09-09)

For an exercise with no finished-workout history, logging a working set now seeds the next
working set's kg + reps from the most recent non-skipped working set logged this session
(DEC-002) — an editable prefill of the user's own input, not invented data. With-history
exercises keep their existing per-set history prefill: the new `setLogSeed` fallback is
byte-identical to the old history path, and `carryFor` returns null whenever history is present,
so the core "history is the source of truth" rule is untouched. Warm-up and effort unaffected.
Pure helpers `carriedWorkingSet` + `setLogSeed` in `workout-log.js`, unit-tested (carry,
follows-most-recent, skipped-source-ignored, all-skipped→null, first-set blank/target,
with-history scope guard, restore-wins). Merge `97412d8` (branch `req-02-carry-value-no-history`,
`ea0c12c`). `./check` green, 73 tests (10 new). Browser gate (planning session, functional): set 1
showed blank kg + target reps; entered 99 kg × 7; set 2 prefilled 99 × 7, editable — carry
confirmed end-to-end.

## req-04 — deploy to Pages only when build inputs change  (merged 2026-09-09)

`.github/workflows/deploy.yml` triggered on every push to `main`, redeploying the live app even
for planning-doc-only publishes that change nothing built (the recurring waste the loop kept
hitting). Added a `paths` include-list to the push trigger — `src/**`, `public/**`, `index.html`,
`package.json`, `package-lock.json`, `vite.config.js`, and the workflow itself — so doc-only
pushes (`handoff/**`, `reports/**`) no longer deploy; build + publish steps unchanged. Verified the
list covers every real build input (`vite.config.js` filename confirmed, `public/` present).
Merge `ec104e5` (branch `req-04-deploy-only-on-build-changes`, `571bcef`). `./check` green, 73
tests. Real-push confirmation (infra can't be proven by `./check`) — **confirmed via GitHub Actions**:
the req-04 merge `32fddd2` (touched `deploy.yml`) triggered a deploy run; the very next push, the
doc-only maintenance publish `c10867e` (handoff/ + reports/ only), triggered **no run** — the
`paths` filter skipped it. Earlier doc pushes deployed only because they predate the filter
landing on `main`.

## req-09 — keep the screen awake during a workout  (merged 2026-09-09; device-confirmed)

Screen Wake Lock while a workout is active. A shell-level `WakeLock` component (`src/wake-lock.js`,
mounted in `App.jsx` inside `StoreProvider`) reads `useStore().activeWorkout`; while active it holds
`navigator.wakeLock.request('screen')`, releases on workout end/unmount, and re-acquires on
`visibilitychange→visible` only when the sentinel was auto-released (browsers drop it on
backgrounding). Feature-detected + fail-silent — an in-flight request resolving after cleanup is
released via a `cancelled` flag, and any reject is swallowed; a wake-lock failure never touches the
workout. Scoped to an active workout, never app-wide. 8 react-test-renderer tests. Merge `6807154`
(branch `req-09-wakelock-during-workout`, `119e251`). `./check` green, 81 tests. **Merged BEFORE the
device check** by Emilio's explicit merge-then-verify-live approval — the device-verified gate needs
a secure context (`navigator.wakeLock` runs only on HTTPS/localhost), which a pre-merge LAN branch
can't give a phone; the feature is fail-silent + scoped, so the risk was low (see L-003).
**Device-confirmed on the live HTTPS site (Emilio, 2026-09-09): "works well"** — screen stays on
during a workout as intended. Gate fully closed.

## req-11 — in-gym flow cleanup  (merged 2026-09-09)

Five workout-flow refinements: rest bar regrouped to `[Pause/Resume · +30s]` … `[Next]` (Skip
renamed, far right); equipment/cues hidden during rest only; the generic `<Back/>` replaced by a
semantic "‹ Exercises" link on the in-exercise screens (Previous kept) — no more double
back-button; the per-exercise review screen dropped from the completion flow (the last set
auto-marks the exercise done via pure `markItemDonePatch` and goes straight to the overview), kept
reachable by re-entering a completed exercise ("Add set" reopens it via `reopenItemPatch` — DEC-014);
and the redundant `<Back/>` removed from the Settings main (the only top-level main that had one —
DEC-015; the other mains were already clean). Mark-done/reopen patches unit-tested; browser-verified
end-to-end (scope 1–4) and diff-verified (scope 5). Merge `77a1161` (branch
`req-11-ingym-flow-cleanup`, `c14f284`…`9d444ff`, 2 commits). `./check` green, 84 tests. Emilio
approved merge on the planning session's verification.

## req-08 — local usage analytics  (merged 2026-09-09)

A separate `localStorage` key `workout-mvp-analytics` (`src/analytics.js`), isolated from
`workout-mvp-v8` — never in the workout backup, no migration. Bounded aggregate counts
`{ screens, transitions ("from>>to"), buttons }`, keyed by the parsed route name (never id-bearing
paths, so it stays bounded). Screens + transitions recorded at `route.js`'s `remember()` seam (once
per real nav, self-transition skipped); 12 primary action buttons instrumented via `recordButton`
(complete-set, skip-set, previous-set, rest-pause/resume/plus-30/next, finish/abandon-workout,
export-database, export-analytics, import). Writes are **fail-silent** (load/persist/record all
try/catch) — the opposite of req-01's surfaced save failure: losing analytics is acceptable, the
workout is sacred. "Export analytics" button in Settings → `workout-analytics-<date>.json`. Pure
`applyScreen`/`applyButton` unit-tested; 7 analytics tests (counts, self-transition skip,
path-collapse, fail-silent, export, isolation). Merge `72d7be9` (branch `req-08-usage-analytics`,
`f824ce9`). `./check` green, 91 tests. Browser-verified (planning session, functional): navigating
incremented screens + transitions (`>>` separator), logging a set recorded `complete-set:1` AND
saved to the workout normally, and `workout-mvp-v8` had no analytics field (isolation confirmed).
Impl notes: separator `>>`; `complete-set` counts after the effort guard, `abandon` after the confirm.

## req-06 — remove legacy localStorage keys after a confirmed v8 write  (merged 2026-09-09; phone-verify pending)

`loadState` (`src/storage.js`) migrated `v7/v6/v5` → `v8` but never removed the legacy keys,
leaving stale duplicate copies. New `removeLegacyKeysIfV8Persisted()` (called at the end of
`loadState`) deletes the legacy keys **only after reading `workout-mvp-v8` back and getting
non-null** — a silent-fail write (setItem stores nothing without throwing) leaves `getItem` null →
no delete, so the only surviving copy of the user's history is never destroyed. Never touches `v8`;
wrapped so a throwing read/remove degrades to "legacy stays" (never `emptyState`). The v8 write path
is byte-for-byte unchanged. Runs on both the migrate path and the already-v8 path (reclaims a
leftover legacy key from an interrupted cleanup). Merge `9c36887` (branch `req-06-legacy-key-cleanup`,
`f0c6253`). `./check` green, 96 tests, including the two required failure cases (throwing write +
silent no-op → legacy key survives). Verified: happy path in a real browser (seeded `v7` → migrated
to `v8`, legacy removed); the read-back gate + silent-fail survival by the genuine unit tests. Merged
on Emilio's merge-then-verify-on-phone approval (persisted-data; his phone store can't be inspected
pre-merge, and it never deletes `v8`). **Outstanding: Emilio confirms his workouts are intact next
time he opens the app on his phone.**

## req-07 — back up current data before a destructive import  (merged 2026-09-09)

Both import sites (`Settings.jsx`, `Today.jsx`) replaced all state after one native confirm with no
recovery of the overwritten data. New shared helper `importWithBackup` (`src/import-backup.js`):
confirm → **download a `buildBackup` of CURRENT state** (`workout-database-<date>.json`, the Export
file) **before** `applyBackup`, so an accidental overwrite is recoverable; returns null on cancel.
Both sites route through it (duplicated confirm→apply bodies removed); `downloadJson` deduped into
the module. Purely additive — `applyBackup` behaviour is unchanged, and a malformed payload
propagates its throw with current state untouched (same error as today). Completes the persisted-data
safety trio: req-01 (guarded save) stops silent write loss, req-06 (legacy cleanup) stops orphaned
copies, req-07 stops an import erasing history with no recourse. 3 helper tests
(backup-precedes-replace, malformed-leaves-data-unchanged, cancel), `./check` green, 99 tests. Merge
`1119f45` (branch `req-07-backup-before-import`, `1a934a7`). Emilio confirmed it works ("works"), merged.

## req-12 — navigation consistency  (merged 2026-09-10)

Navigation was done two ways — `<a href>` links and `<button onClick={() => go()}>`. Added one
`NavLink` primitive (`shared.jsx`, `<a href={toHash(to)}>`); `ExercisesLink` (req-11) now renders
through it. Converted all 10 pure-navigation buttons (Cancel/Skip across Exercises/History/Schedule/
Routine/Workout) to `NavLink`; `<button>` is now reserved for actions/submits (the mutate-then-
navigate handlers — Apply, Remove, Delete, Resume, StartButton, submits — correctly stayed buttons).
Behaviour-preserving: `toHash(to)` yields the identical hash the old button navigated to. Merge
`a56e8b2` (branch `req-12-nav-consistency`, `c735e47`). `./check` green, 99 tests. Grep receipt: no
navigation-only `onClick` left on a button. Converted Cancel/Skip render as link text until the
styling pass (expected). Boundary left for later: `Schedule.jsx` `RoutineNewForm`'s `onCancel` prop
is navigation but the form owns its Cancel button — form-cancel semantics can be unified in the
styling pass.

## req-13 — component library + showcase  (merged 2026-09-10)

The first styling foundation: `src/ui/` — a small, **grayscale (colorless)**, Apple-inspired
component library + a `#/components` showcase. Primitives: Button (primary/secondary/quiet-bordered),
NavLink, SegmentedControl, Checkbox, FileButton, Field, NumberField, Textarea, Screen, Title,
SectionHeader, List/Row (grouped, hairline dividers, `›` chevrons), NavBar, Banner; molecules RestBar
+ SetLogForm. One grayscale stylesheet, every selector `.ui-`scoped → unstyled screens untouched
(additive by construction). **Fixed named type scale (DEC-020):** caption 13 / body 17 / section 22 /
title 32 / display 40 / rest 112, as CSS custom properties every component references (no ad-hoc
`font-size`; grep-verified). **NavBar (DEC-019, supersedes DEC-018)** is the one component wired into
`App.jsx`: a single `Menu` holding all six nav items, closing on item-click + outside-click. RestBar:
big 112px number + 3 equal buttons, Next primary right. Showcase = one example of each + a Type Scale
section. **No app-screen migration** (that's the per-screen styling pass). Four iterations with Emilio
via the showcase (nav-in-menu, quiet border, one-of-each, RestBar redesign, type scale, doubled rest
number, type-scale section). Merged on `main` 2026-09-10 (branch `req-13-component-library`,
`4007683`…`11a68bf`, 4 commits). `./check` green, 99 tests. Emilio judged the look across iterations
and approved the merge. Follow-ups: req-14 (menu redesign — he's not a fan of the placeholder menu);
the per-screen styling pass migrates screens onto the library.

## req-15 — styling pass: the whole app migrated onto the component library  (merged 2026-09-10)

The entire app moved off raw HTML onto the req-13 `ui/` components, screen-by-screen (8 commits):
workout flow, Today, Settings, Routines/Exercises, Schedule, History, + a global commit for two
defects — **all links forced grayscale** (no more browser blue/purple) and the raw workout-overview
**Back styled**. Grayscale + type-scale tokens throughout; behaviour-preserving (99 tests green;
planning session walked Today/Exercises/Settings/workout-flow). Added a **Select** primitive (the
app's native dropdowns had nowhere to map). Judgment calls (in `reports/req-15.md`): reps stays a
full-keyboard **text** field (durations like "30 min" — a NumberField would break that); kg is a
NumberField; effort/feel SegmentedControls keep a clearable "—"; dropdowns→Select, few-option
toggles→SegmentedControl. Bigger refactors were **observed, not done** (DEC-021) and delivered in
`reports/req-15-findings.md`: split `Workout.jsx` / `History.jsx`, merge the three near-duplicate
set-editing forms, extract the set-log seed logic to a tested helper, let `Row` carry a value on
link rows, formalize the action-row/clearable-segment patterns, ~10 native confirm/alert sites (the
inline-dialog work). Merge `2d0dfc0` (branch `req-15-styling-pass`, `a403182`…`0230dd0`, 8 commits).
`./check` green. Emilio reviewed the styled app on his phone and approved. The app is now grayscale-
styled end to end; color/theme is a later pass.

## req-17 — extract the set-log seed/prefill into a pure, tested `initialSetFields`  (merged 2026-09-10)

First of the req-15-findings refactor batch (DEC-021, finding #3). The live set-log form's seed —
the **history-is-truth rule** ("prefills come only from finished-workout data; never invent a value")
— was computed inline inside `WorkoutItemLive` (`Workout.jsx`), where it couldn't be unit-tested. It
now lives in a pure `initialSetFields({...})` in `workout-log.js` returning `{weight,reps,effort,note}`:
weight/reps delegate to the untouched `setLogSeed`, effort/note (and the `fromRestore` "Previous"
branch) moved verbatim; the component keeps zero seed branching. Behaviour-neutral by contract — a
parity test recomputes the old inline expressions and asserts `deepEqual` over representative inputs,
so the DEC-009 functional gate was met deterministically rather than by click-through. Default effort
confirmed as `3` (Moderate) from the inline code; no inline/`setLogSeed` discrepancy found. Merge
`632fb33` (branch `req-17`, `80e746c`). `./check` green, 105 tests (6 new in `workout-log.test.js`).

## req-16 — collapse the done/log item-path branch into `itemCurrentPath`  (merged 2026-09-10)

Refactor batch (req-15 findings #9, DEC-021). The expression "done → done screen, else log screen"
was hand-written at five sites in `Workout.jsx`, each spelling out both `itemDonePath`/`itemLogPath`.
One helper `itemCurrentPath(routineId, item, done)` now owns the branch; the five callers pass their
own boolean verbatim (`completed` = marked-done+plannedDone at the overview/redirect; `plannedDone`
alone at itemSetsPath + setup Save/Cancel — deliberately *not* unified, since that would change
navigation). `itemSetsPath` collapsed to a one-liner. The standalone unconditional redirect at :511
correctly left alone (not a done/log branch). Pure, behaviour-neutral, no test edits — verified: the
two path helpers now appear only in their defs + inside `itemCurrentPath` + that one redirect. Merge
`1787773` (branch `req-16`, `403cb85`). `./check` green, 105 tests.

## req-20 — link `Row` can carry a right-aligned `value` beside the chevron  (merged 2026-09-10)

Refactor batch (req-15 findings #4, DEC-021). `Row`'s `to` branch previously rendered only
`children + ›` and dropped `value`; now it renders `children … value ›` (label wrapped in
`.ui-row__label` with `flex:1 1 auto; min-width:0` so value+chevron group at the right). Value-less
links stay pixel-identical — `flex:1` just fills the space `justify-content:space-between` already
left empty. Whole-row tap target preserved (value span lives inside the NavLink). One Showcase demo
row added; no real callers converted (every inlined-meta candidate would change wording/wrapping —
left for a later sweep, noted in the report). **Planning browser-verified** on the Showcase: value-
less link unchanged, value-link shows the value right-aligned before the chevron, plain value row
unchanged. Merge `b15d7d6` (branch `req-20`, `1ef1bb7`). `./check` green, 105 tests.

## req-21 — `subtitle` prop on `Title`  (merged 2026-09-10)

Refactor batch (req-15 findings #6, DEC-021). `Title` gains an optional `subtitle` that renders the
existing `.ui-sub` markup after the h1, guarded `subtitle != null && subtitle !== ''` so empty/null
renders just the h1 (DOM-identical to a bare Title). `.ui-sub` stays valid standalone. Two demo sites
migrated, both provably byte-identical (Workout.jsx preview `previewMeta`, Today empty-state literal);
the other ~10 `.ui-sub` sites correctly left — most are empty-state list captions, not title
subtitles, and one (`Workout.jsx` `{ex.equipment}`) renders an empty `<p>` the prop's guard would
drop. Verified by DOM-equivalence analysis (no layout change — re-renders identical existing markup)
+ build/tests, not a pixel check. **Correction recorded (L-004):** finding #6's "~50 → prop" framing
was wrong; the sweep is a handful, the utility class stays. Merge `16ad096` (branch `req-21`,
`658f498`). `./check` green, 105 tests.

## req-22 — `clearable` prop on `SegmentedControl`  (merged 2026-09-10)

Refactor batch (req-15 findings #7, DEC-021). `SegmentedControl` gains `clearable`, which prepends
the leading `{value:'', label:'—'}` "none" segment itself — the same idiom three sites hand-rolled —
through the unchanged map + `String(optValue)===String(value)` selection, so byte-equivalent to the
old markup. Off by default → non-clearable controls untouched. All three sites converted to
`clearable` + plain options (History Feel + Effort, Workout Effort); `—`/`''` kept as the fixed
convention. Verified by construction (identical rendered segments, no other control touched) + the
idiom grep returning none + build/tests. Merge `81b3692` (branch `req-22`, `4303905`). `./check`
green, 105 tests.

## req-23 — `action` slot on `Row` (trailing-action pattern)  (merged 2026-09-10)

Refactor batch (req-15 findings #5, DEC-021). `Row` gains an optional `action` slot (plain rows only)
with `.ui-row__action { display:flex; align-items:center; gap:s2 }`, pushed right by the row's
existing space-between; interaction rule `children … value action` (both may coexist — Today needs
both). Five sites migrated from `value={<Button>}` to `action=`: Today (its polymorphic `value`
split into `value={doneLabel}` + `action={startAction}`, behaviour-preserving), Start Resume,
Schedule Remove, Routine Up/Down, Exercises Add. **Planning browser-verified** on the Showcase:
single-button rows pixel-identical, Up/Down two-button row aligns right with a clean gap. Two
correct exclusions (like req-21): Schedule "assign" row left alone (its `<Button>` is the row's
label, not a trailing action). **One deliberate visual change, accepted:** Routine Up/Down had no
gap before; `.ui-row__action` gives `gap:s2` — the consistency the req exists for, not a regression.
Merge `3b643fe` (branch `req-23`, `e4905b5`). `./check` green, 105 tests.

## req-18 — merge the set-edit forms into a shared `SetEditForm`  (merged 2026-09-10)

Refactor batch (req-15 findings #2, DEC-021). New `src/views/set-edit.jsx` holds `SetEditForm`
(kg/reps/effort/note + optional set-type toggle); `WorkoutSetEdit` and `HistorySet` are now thin
wrappers passing `showLoad`/`showEffort` gates, `setTypeOptions` (History-only), `onSave(rawValues)`,
`cancelTo`. Lives in a new view-layer file (not shared.jsx, which is kept ui/-import-free to avoid a
shared→ui→shared cycle). The two paths' **behavioural differences are expressed as props, not papered
over** — the form emits raw field values and each caller does its own coercion: empty weight → 0 in
the live set (`weight === '' ? 0`), stays '' in history (`weight === '' ? ''`); [measured] both match
`main` byte-for-byte (Workout main:723, History main:543/545). Distinct store mutations
(updateActiveSet vs rebuild sets[]+updateWorkout) and post-save routes kept per caller. Effort uses
req-22 `clearable`. `SetLogForm` left separate (different lifecycle, crosses ui/↔views — noted as a
follow-up). **Planning browser-verified** the History edit path on real data (Chest Press set: Type=
Work, kg=30, Reps=12, Effort=Hard all seed correctly; set-type toggle + clearable effort present) —
read-only, no save. Save-path parity proven by diff rather than a mutating click. Merge `821eb96`
(branch `req-18`, `8e47ed6`). `./check` green, 105 tests.

## req-19 — split Workout.jsx / History.jsx into per-screen folders  (merged 2026-09-10)

Refactor batch (req-15 findings #1, DEC-021) — the last of the batch. Pure move: `Workout.jsx` →
`views/workout/` {helpers, rest, overview, item (the 397-line live flow), setup, finish, index-barrel};
`History.jsx` → `views/history/` {helpers, list, detail, edit, recalc, index-barrel}. Each barrel
re-exports exactly the 8 workout + 10 history screens App.jsx imports (WorkoutItemLive stays internal);
App.jsx's two import lines repointed to the folders (the only importer); single-use helpers kept local,
shared ones in helpers. **Proven pure move:** import-block-stripped body diff of old-vs-new = zero diff
both files (Workout 456 uniq body lines, History 345). **Planning browser-verified** (the gate can't
catch a missing local-import — see L-005): walked live overview, the log screen (item.jsx, prefill
working), Finish, and History detail — all render; started + cleanly Abandoned a throwaway workout
(activeWorkout confirmed back to null, no history touched). Merge `bb3f724` (branch `req-19`,
`b6b63f5`). `./check` green, 105 tests. **This closes the req-15-findings refactor batch (req-16, 17,
18, 20, 21, 22, 23, 19).**

## req-25 — bug #5: the last set of an exercise now rests (rest-on-overview)  (merged 2026-09-10)

First of Emilio's 2026-09-10 gym-flow notes. Bug: completing the final set of an exercise armed no
rest — the `restAfterSet(done, skipped)` guard suppressed rest when `done` (last set), so the hardest
set got no timer and the app jumped to the exercise list. Reproduced live before fixing (Chest Press
restSec 90: every set rested except the last). Fix: rest is armed by *completion* — extracted a pure,
unit-tested `restPatchAfterSet({restSec, skipped})` in `workout-log.js` where only a skipped set /
restSec 0 suppress rest; `restAfterSet` delegates to it and dropped the now-inert `done` param;
navigation unchanged. **Domino caught a second bug:** `markItemDonePatch` also cleared rest (ran right
after the rest patch), which would have wiped the armed countdown — it no longer touches rest. Last
set now drops to the overview with the persistent RestBar ticking there (rest-on-overview, Emilio's
call; refines DEC-013). **Planning browser-verified:** Chest Press restSec 90 last set → rest bar on
overview, ticked 87→72s; Rowing restSec 0 → no rest (no over-fix). Merge `64fa26e` (branch `req-25`,
`59dfff9`). `./check` green, 109 tests (4 new + 1 justified update).

## req-26 — declutter the live set-log screen (notes #2 + #3)  (merged 2026-09-11)

Emilio's gym-flow notes #2/#3. (A) The Note field in `SetLogForm` (`ui/index.jsx`) is now hidden
behind a quiet "Add note" button — tap reveals + focuses it (autoFocus only when opened by tap; a
pre-existing/seeded note starts expanded and keeps focus off); submitted value unchanged. (B) The
equipment + cues block under the Complete/Skip buttons (`views/workout/item.jsx`) is removed; cues
stay reachable via the exercise Title link (decided default). (C) "Previous when paused" was
**investigated, not assumed** — reproduced the paused state and found Previous already renders when
paused (gated on `resting`, which stays true while paused), so dropped with nothing to add. Planning
browser-verified (A) on the Showcase: "Add note" shows by default, tap reveals the focused field. No
unit test (both changes presentational; flagged rather than adding a hollow one). Merge `e9f3928`
(branch `req-26`, `fa60892`). `./check` green, 109 tests.

## req-27 — show + edit the upcoming set's weight during rest (note #1)  (merged 2026-09-11)

Emilio's gym-flow note #1. During rest, the next set's prescribed weight is shown in an editable field
by the RestBar, marked ↑/↓ when it differs from the set just completed; editing it pre-fills the next
set. Seam: a per-set override `activeWorkout.nextSetWeight = { itemId, workIndex, weight }`, resolved
by a pure `pendingWeightFor(pending, {itemId, workIndex})` and applied in `initialSetFields` via a new
`weightOverride` — weight-only, never on a restore, never for non-weighted, and scoped so an edit
can't leak to another set/exercise (both itemId AND workIndex must match). Cleared on
complete/skip/previous. Transient on activeWorkout (survives reload via the existing snapshot spread) —
**no schema bump, no migration, no ask-gate**. History-is-truth intact: the override is only ever a
typed value (explicit '' honoured, distinct from null), so a no-history weighted exercise still shows
a blank upcoming. **Planning browser-verified end-to-end** on a fresh seeded routine: set-1 kg blank
(no-invent); rest showed "Next 40 × 8" editable; edit → 45 → "Next ↑" marker; Next → set 2 pre-filled
45 (override beat the 40 carry). 43 workout-log tests (no-leak + no-invent pinned). Merge `3911aa9`
(branch `req-27`, `5a09046`). `./check` green. **Emilio to gym-test the feel later 2026-09-11.**

**Workflow note (L-006):** req-27 was first committed onto the code worktree's `main`; restructured
into a proper branch before merge. Code CC always branches; planning is the QA/PO merge gate.

## req-28 — "Completed today" section on the Today page (note #7)  (merged 2026-09-11)

Emilio's gym-flow note #7. Today gains a "Completed today" section listing workouts finished today,
each row linking to its History detail; renders only when non-empty, below the scheduled/Start area.
New pure `completedOnDayKey(workouts, dayKey)` in storage.js filters on `finishedAt` **alone**
(dateKey(finishedAt) === dayKey), newest-first — deliberately not the history view's workoutDateKey,
so a workout re-dated via performedOn isn't falsely "completed today". Rows reuse History's own
labelling helpers; no new stored field, no migration. Branched correctly (L-006 held). Planning
browser-verified: section shows a finished-today workout, links to the correct History detail, hidden
when empty; unit-tested (today/prev-day/unfinished/empty, timezone-independent). Merge `ab73589`
(branch `req-28`, `e646a1e`). `./check` green. First req merged under the DEC-009 refinement
(planning verifies + merges the gym-flow batch; Emilio feels in the gym).

## req-29 — button-placement audit: forward=right, back/previous=left (note #4)  (merged 2026-09-11)

Emilio's gym-flow note #4 / DESIGN §4. Turned out to be app-wide, not one screen: **every** `.ui-actions`
row was primary-left/cancel-right (the inverse of §4). Reordered **11 surfaces** to retreat-left /
forward-right — SetLogForm (Previous · Skip · Complete), and Cancel · Save across RoutineNew/edit,
ExerciseFields, Schedule, Exercise new/edit, SetEdit, HistoryEdit, Workout setup; Skip · Apply on
Recalc. Presentation-only: markup child-order within existing action rows, no behaviour/label/handler/
style change; `type="submit"` stays the primary (Enter-submit unaffected). Reordered in **markup, not
`row-reverse`**, so tab/focus order matches the visual order (a11y). Unchanged/compliant: RestBar (Next
already right, DEC-013), lone-button screens (Finish/Abandon/Delete). Two conventions recorded in
DESIGN §4 (markup-order-not-reverse; Skip is lateral). Planning browser-verified SetLogForm renders
Previous · Skip · Complete. Merge `0e5b650` (branch `req-29`, `f84dca5`). `./check` green, 123 tests.
**This completes Emilio's 2026-09-10 gym-flow notes batch (req-25–29); #6 timed exercises still parked.**

## req-30 — no invented warmup reps (audit F1) + README wording (F2)  (merged 2026-09-11)

Trust fix (DESIGN §1, DEC-022): the routine editor ticked "WU set" and stored an invented
`{ reps: 12 }` the user never typed, surfacing as the warmup target in the live workout and on
skipped warmups. Now the editor shows a "Warmup reps" field only when WU is checked — blank for
a new warmup, the saved value when editing one — and submits `{ reps: <typed> }` with the
`|| { reps: 12 }` fallback gone; blank stores `{ reps: '' }` (impl note on DEC-022). Dropped the
`?? 12` in `item.jsx` (live target) and `workout-log.js` (skipped-warmup target) → a warmup with
no reps shows/records blank, not 12; the set-log Reps field then starts empty (prefill rule).
**No migration** — routines already saved with `{ reps: 12 }` keep it until next edited
(go-forward only, no schema bump). README §Persistence reworded: `db.json` is provenance/reference,
not loaded at runtime (audit F2). Merge `74cd466` (branch `req-30`, `cd26172`). `./check` green,
125 tests (2 new: blank⇒`targetReps:''`, user-entered 12 still honoured). Gate: Emilio walked the
routine editor + a live warmup on branch req-30 (ux-feel) and approved the blank target.

## req-31 — rest-end cue (sound + vibration when the rest timer hits zero)  (merged 2026-09-11)

The counterpart to the wake-lock (req-09): the rest timer showed a number but made no sound, so
you had to watch the phone to know rest was up. New null-rendering `RestEndCue` (`src/rest-cue.js`),
mounted beside `<WakeLock />`, mirrors the wake-lock module exactly — feature-detected, fail-silent,
renders nothing. When the live countdown reaches `restEndsAt` on its own it fires a short two-tone
Web Audio beep (880→1175Hz, ~270ms, no asset file) + `navigator.vibrate([120,60,120])`, exactly once
per armed rest. The fire decision is a pure `nextCueState(prev, restEndsAt, now)` unit deduped on the
`restEndsAt` value: **Next** and **pause** null `restEndsAt` → no cue; **+30s** and **pause→resume**
mint a new `restEndsAt` → cue again when it lands; a reload over an already-expired rest does not beep
(seeds as already-cued — DEC-023 addendum). AudioContext is unlocked on the set-complete tap
(`item.jsx`, the iOS gesture requirement). No settings toggle, no silent-mode detection (no reliable
web API), no rest-state or schema change — diff is only the module + its mount + the unlock hook +
tests. Merge `e2aa905` (branch `req-31`, `dca29c3`). `./check` green, 16 new cue tests
(fire-once / not-on-Next / not-on-pause / re-arm-fires-again / no-op-when-unsupported / never-throws).
Gate: Emilio ratified the beep + vibration feel on a real phone before merge (ux-feel).

## req-14 — new nav: 3-tab bottom bar (Workout / Library / Settings)  (merged 2026-09-12)

Replaced req-13's top-left Menu dropdown of six flat items with a **fixed bottom tab bar of three
groups** (DEC-024): **Workout** (Today+Schedule+History), **Library** (Routines+Exercises), **Settings**.
Tabs are `ui-btn`-styled links (Workout primary / Library secondary / Settings quiet + active underline;
no custom icons — component-library only; honours DEC-016 by using links not `<button>` for nav), driven
by a pure unit-tested `activeTab(routeName)`; the bar hides during the in-workout flow. Library is the
existing `SegmentedControl` toggling the unchanged Routines/Exercises screens. The Workout screen is an
**interim** light version of req-32's unified scroll: header → "Future workouts›" (link to Schedule) +
upcoming rows with Start-ahead → **Today** as the focal point (bold date on top, name — focus below, big
primary Start; empty day → "Nothing scheduled today." + disabled Start) → Completed-today → past rows →
"Past workouts›" (link to History) → a **fixed "Routines›" strip docked above the tab bar** (→ /start
picker). All rows share one info format (`date · name — focus`, one formatter `Mon, Oct 13`, focus from
immutable snapshot, never invented). Schedule/History got Back buttons. Pure routing/UI, **no
persisted-data change**. Built as the shell only; req-32 (full unified scroll + inline schedule editing)
is the follow-on. Merge `49dadc4` (branch `req-14`, `52515fa`…`ba5ccd0`, 9 commits — 1 build + 8 review
iterations with Emilio). `./check` green, 145 tests. Gate: Emilio drove the whole redesign in-browser
over 8 passes and approved ("its good, lets merge").

**Follow-up noted:** `./check` runs only top-level `src/*.test.js`, so tests under subfolders (e.g.
`src/views/history/`) silently don't run — surfaced when `weekdayDate` couldn't be gated there. Worth a
small cleanup req (fix the glob or relocate) so nested tests actually execute. *(Closed by req-34.)*

## req-33 / req-34 / req-35 — workflow hardening (one branch)  (merged 2026-09-12)

Three small workflow/tooling reqs, batched on one branch. **req-33** adds `plan doctor` — a read-only
subcommand that verifies first-machine setup (layout, hooks, deps, grants, git identity) then runs
`plan status`, printing `ok`/`FIX: <exact command>` per line and exiting non-zero on any FIX. It
deliberately does **not** reuse `find_worktrees` (which exits on the first miss) so all failures show in
one pass, and it owns the explained FIX for the two-separate-clones trap; its exit reflects setup only,
not drift (DEC-027). README §Setup step 6 now ends with `plan doctor`. **req-34** closes two gate holes:
`deploy.yml` now runs `./check` before the Pages build (one source of truth — CI can't drift from
`plan publish`), so a red suite blocks deploy; and `check`'s test discovery moved from a top-level
`src/*.test.js` glob to `find src -type f -name '*.test.js'` (not globstar — bash 3.2 on macOS lacks
it, and CI is Ubuntu). The glob hole was **latent** — all 14 tests were top-level at build time, so the
fix is preventive, proven with a throwaway nested fixture (14→15 files). **req-35** narrows the
planning push grant from a bare `Bash(git push:*)` to the two forms the workflow uses
(`git push origin planning`, `git push origin main planning`) in the README block (DEC-026); the
machine-local `settings.local.json` re-paste is Emilio's, and the matcher-accepts / re-prompts-on-bare
verification waits on that. Handoff prose (`CLAUDE.md` test line, DEC-005 grant enumeration) reconciled
by planning. Merge `8daa8f2` (branch `req-33-35-workflow-hardening`, `130d30e`, 1 commit). `./check`
green, 145 tests. Gate: functional (planning verified + merged; no gym-test). Two criteria are
inherently post-merge: the live CI-gates receipt (the deploy run this push triggers) and the matcher
check (after Emilio re-pastes the grant).

## req-36 — a corrupt `workout-mvp-v8` key is never silently overwritten (audit F-RISK-2)  (merged 2026-09-12)

First req off the 2026-09-12 audit. `loadState` used one `try` around read+parse+migrate, so a
corrupt-but-present `v8` value fell to the same `catch` as a blank device — returning `emptyState()`,
which the next `saveState` then wrote over the corrupt (recoverable) key. Silent total history loss.
Fix (DEC-032): a `loadUnreadable` signal trio parallel to `saveFailed` (`storage.js`); `loadState`
now separates reading the raw value (its own try/catch — access-denied → treat as absent) from
parsing it. Absent/blank → `emptyState()`, byte-for-byte the old path, signal clear. Present but
parse/migrate throws → latch the signal, return `emptyState()` for render, **no save, no legacy
removal**. `saveState` returns `false` without `setItem` while the signal is latched, so the raw key
is preserved untouched. Distinct `LoadUnreadableBanner` in `App.jsx` (own signal + wording, separate
from the save-failed banner). Implementation calls (CC, no DEC — impl not behaviour): an unreadable
legacy-only key when no `v8` exists counts as unreadable (only surviving copy); `localStorage.getItem`
itself throwing = absent (no legible bytes to keep); the signal reflects the current stored value so a
reload with a readable value clears it. Core anti-regression test asserts the corrupt string is
byte-for-byte unchanged after a mutation. Merge `ce2a4c7` (branch `req-36`, `65a8023`, 1 commit);
`./check` green, 149 tests. Gate: persisted-data → Emilio's hands (used it, DEC-009). **Follow-up
deferred:** the recovery path out of the held-saves dead-end (explicit discard-and-start-fresh vs.
auto-quarantine to a `-corrupt-<ts>` side key) is Emilio's pick and becomes its own req.

## req-37 — v5 migration round-trip test (audit F-RISK-1)  (merged 2026-09-12)

`workout-mvp-v5` was a claimed-supported legacy key with no round-trip test (v6/v7 had one; v5 had
only a delete-assertion). Finding while speccing: there is **no distinct v5 shape in this repo's git
history** and `migrateState` is uniform/shape-driven (no per-version branch), so "v5" is a version
number on a program-wrapped shape, not a separate transform. So the test's real value is covering the
legacy paths v6/v7 tests skip. Added `describe('req-37 v5 migration round-trip')` to
`storage.test.js` (test-only, one file): seeds a v5 program-wrapped payload with a workout carrying
`sessionId`/`programName`/a snapshot with `sessionItemId`, and a plan with `sessionId`. Asserts
routine flatten, `sessionId→routineId` on **slot, workout, AND plan**, `sessionItemId→routineItemId`
on snapshot-item and set, snapshot's own `sessionId` dropped + `programName` kept, programs/sessions
dropped, opaque id `sess-1` kept, v8 persisted. Merge `569461b` (branch `req-37`, `517ccee`, 1
commit); `./check` green, 150 tests. Gate: functional (test-only; planning verified + merged). CC
finding (→ `reference/schema.md` clarified): `workoutSnapshot` has two branches — only the
snapshot-**less** branch reads top-level `workout.programName`; the snapshot-present branch keeps
`programName` from inside the snapshot. Not a bug, but the schema.md ":183" line read more general
than the code.

## req-38 — stamp the day key in local time, not UTC (audit F-CODE-2)  (merged 2026-09-12)

Two sites in `store.jsx` built the day key as UTC `new Date().toISOString().slice(0,10)` — `:214`
(plan.date default) and `:233` (`performedOn`) — while the whole rest of the app uses the local-time
`dateKey` (`schedule.js`). Near midnight for an off-UTC user a workout landed a calendar day off.
Fix: import `dateKey`, swap both sites to `dateKey(new Date())` (3 lines, go-forward only, no
migration). Grep acceptance empty. `./check` green, 15 test files. Gate: functional (planning merged).
Test: `store.jsx` can't be imported under plain `node --test` (no JSX transform → **L-007**), so
`store.test.js` proves it two reachable ways — a TZ+14 boundary instant showing `dateKey(new Date())`
is the local day while the old UTC slice is the prior day (deterministic, real behaviour change), plus
a source-guard test enforcing the grep. Merge `e0c49e0` (branch `req-38`, `c8eebd2`, 1 commit). Merge
note: existing workouts keep their old (possibly UTC-off-by-one) `performedOn`; only new workouts are
local; mixed old/new expected.

## req-39 — reject a malformed backup cleanly, not a raw TypeError (audit F-RISK-4)  (merged 2026-09-12)

A backup whose `state.workouts` or `state.schedule.slots` was a non-array threw `"map is not a
function"` (in `migrateState`'s `.map`) instead of the friendly `"Not a workout database backup."`
Fix: a `collectionsAreArrays` guard in `unwrapBackup` (`exchange.js`) — a collection field present but
not an array rejects (→ friendly message); absent stays fine; `schedule?.slots` handled. Applied to
both the wrapped `{kind,state}` and bare-document paths (the bare path previously checked only
exercises + a routine-family array, so it had the same hole — now closed). **`migrateState`/`model.js`
deliberately untouched:** guarding its `.map` sites would make it succeed on corrupt data, defeating
req-36's load-path corrupt-`v8` guard (silent overwrite) — so validation lives at the import boundary
only. Diff: `exchange.js` + `exchange.test.js` only. `./check` green, `exchange.test.js` 9 tests. Gate:
functional (validation-only; tests prove the two repros throw the friendly message AND a real
`buildBackup` round-trips without false-reject). Merge `a10403a` (branch `req-39`, `79ccfcc`, 1 commit).

## req-40 — one shared progression computation, Finish == recalc (audit F-CODE-1)  (merged 2026-09-12)

The per-item next-time recommendation was computed twice with divergent set-matching — inline in
`finish.jsx` (what Finish saves onto the routine) vs `progressionFromWorkout` (History recalc) — so the
same workout could save two different plans (DESIGN §2 fail). Extracted one pure `progressionForItem`
helper in `model.js` (L-007 — unit-testable, not inline in the view); both `progressionFromWorkout` and
`finish.jsx` now call it (finish keeps its display-only fields around the shared core). Canonical =
model.js semantics (DEC-034): match `routineItemId || sessionItemId` (+ `item.id`), keep `item.targets`
on empty matched sets. `recommendNextPrescription`/`applyProgressionToRoutines`/`progress.js` untouched.
Consistency test (model.test.js) makes the divergence concrete: a `sessionItemId`-keyed set the old
finish matcher missed (would've saved stale `[40]`) now yields `[45]` from both paths; + empty-sets
fallback, normal-case regression guard, wu/skipped exclusion. `./check` green, model.test.js 11 tests.
Interrupted mid-build by a usage-limit reset, resumed cleanly. Gate: persisted-data/behaviour → Emilio
used it before merge. Merge `078d2c5` (branch `req-40`, `ab4706b`, 1 commit).

## req-41 — warn when another tab changes the data (audit F-RISK-3)  (merged 2026-09-12)

Two open tabs were last-writer-wins over the whole `workout-mvp-v8` key — a stale tab could clobber
another's finished workout with no warning (no `storage` listener existed). Fix (DEC-029, warn-only):
a pure `isExternalStateChange(event)` predicate in `storage.js` (`event.key === STORAGE_KEY ||
event.key === null`) + a signal trio backed by a single lazily-registered, window-guarded `storage`
listener (so `storage.js` still imports under `node --test`); one-way latch (a reload clears it). A
distinct `ExternalChangeBanner` in `App.jsx` ("Another tab changed your data — reload…") with a Reload
button. `saveState`/`loadState` untouched. No merge, no hold-saves (DEC-029 — warn-only doesn't
*prevent* a determined clobber, just surfaces it). `./check` green, 165 tests (predicate: 4 cases).
Gate: functional — merged on unit test + line-by-line review; the two-tab end-to-end (open two tabs,
write in A, banner in B) is a standard-platform eyeball left to Emilio post-merge (warn-only, no data
write, fully reversible; a clean two-tab test would need the branch served from the code worktree,
crossing the DEC-005 boundary). Merge `fb2d7f7` (branch `req-41`, `1171e95`, 1 commit).

## req-42 — a recommendation with no valid increment holds (audit F-DIV-1)  (merged 2026-09-12)

`moveToValidWeight` invented a ±0.5 kg step when the exercise had no valid increments (weightStep
'n/a', the addExercise default) — a load the config never defines (breaks DESIGN §1/§2). Fix (DEC-030,
progress.js, pure): (1) `moveToValidWeight` empty-options → `return current` (never invent); (2)
`recommendNextPrescription` computes `hasIncrements = validWeights(exercise).length > 0` once, and the
weighted up/down branches only move + set movedUp/movedDown when hasIncrements, else hold (push actual
weight → action 'keep', so the weight never contradicts the action). Has-increment path (incl.
at-ceiling/floor) untouched. Tests: n/a holds both directions, `moveToValidWeight(w,{weightStep:'n/a'},±1)===w`,
Alt 4/5 regression still moves. `./check` green, progress.test.js 6 tests. Gate: functional. Merge
`d011f02` (branch `req-42`, `f548076`, 1 commit). Note: changes the recommendation for weightStep:'n/a'
exercises (now hold, not ±0.5 drift); real-weightStep exercises unaffected.

## req-43 — the delete confirm names what it will remove (audit F-DIV-3)  (merged 2026-09-12)

Deleting a routine silently removed its schedule slots + planned workouts, and deleting an exercise
silently stripped it from every routine — behind a bare `Delete X?` confirm. DEC-031: the history-only
archive/delete rule is correct and stays; only the confirm must name its blast radius. Added pure
`routineDeletionImpact(state, id)` -> {slots, plans, hasHistory} and `exerciseDeletionImpact(state, id)`
-> {routines, hasHistory} to `storage.js`, mirroring the store's exact reference tests (routineId||sessionId;
set.exerciseId; reuses `routinesUsingExercise`). `Routine.jsx:152`/`Exercises.jsx:319` confirms now name
archive-vs-delete + counts (only when >0, singular/plural), e.g. "Upper Body has past workouts and will be
archived (kept in your history). This removes 2 schedule slots and 1 planned workout." **`store.jsx` NOT in
the diff** - removeRoutine/removeExercise byte-unchanged. `./check` green, 15 test files. Gate: functional
(wording eyeball welcome; native confirm, inline UI is still req-24). Merge `11b1a70` (branch `req-43`,
`ecc4aef`, 1 commit).

## req-44 — cleanup: dead export + dedupe drifted predicates (audit F-DEAD-1, F-STRUCT-1/2/3/5)  (merged 2026-09-12)

Pure refactor, no behaviour change except one intended fix. (1) Removed dead `nextScheduled`
(schedule.js). (2) `isSkippedSet` unified to one export from `workout-log.js` (was 2 defs + inline uses
in model/item/storage/finish) — `finish.jsx` had dropped the `|| ''` guard (`String(set.reps)`), now
uses the guarded helper so a null/undefined reps no longer stringifies to "null" (the one edge-case fix).
(3) `isDurationTarget` exported from `progress.js`, item.jsx's copy removed. (4) New pure
`isWeightedType(type)` in `ids.js` replaces four spellings (usesWeight/usesLoad/weighted/bodyweight-inverse),
each caller reading its own field; verified value-equivalent (e.g. `!isWeightedType(t)` ≡
`t==='bodyweight'||t==='cardio'`). (5) Routine.jsx reuses one `weightParts`. L-005 receipts: import audit
(every relocated symbol imported at each use; no cycle — ids imports nothing) + browser walk of set-log /
Finish / Routine / Exercises (Emilio). Pure unit tests for the 3 predicates incl. null/undefined edges.
`./check` green, 15 test files. Gate: functional + L-005 browser walk. Merge `96d3865` (branch `req-44`,
`875e1b9`, 1 commit).

## req-45 — plan doctor compares grant contents, not just existence (DEC-028 follow-up)  (merged 2026-09-12)

`plan doctor`'s grants check only tested that `settings.local.json` exists — blind to content drift (a
stale/narrow/over-broad grant list passed). Now it parses `permissions.allow` (python3, order-independent
set comparison against a hardcoded canonical 10-grant array with a "KEEP IN SYNC WITH README §Setup step
5" comment) and reports missing AND extra grants; `ok` only on exact match; malformed/non-list → a FIX,
not a crash; missing-file FIX + DEC-027 exit semantics unchanged. Receipts: real `./plan doctor` → "ok
grants — matches all 10 canonical grants" (planning independently confirmed post-merge); removed/extra/
malformed cases driven through a faithful throwaway copy (real file never touched, L-001). `./check` green,
182 tests. Gate: functional (workflow tooling). Merge `3791bdd` (branch `req-45`, `1aaacfa`, 1 commit).
Coupling noted (L-008): the canonical grant list now lives in both README §Setup step 5 and `plan` — sync
comment only, nothing enforces it. **Audit 2026-09-12 closed** with this req.

## req-46 — workflow hardening: save-time drift warning, publish --push, closeout checklist  (merged 2026-09-12)

Post-audit workflow reflection ("fix all"). Three `plan` changes (plan-only diff): (1) `cmd_save` runs
check_handoff after the commit and echoes drift as a **non-blocking** stderr warning — catches e.g.
`NOW.md`>50 at save, one step before publish (which stays non-blocking, req-34 stands — DEC-035 area).
(2) `cmd_publish --push` — opt-in; pushes `origin main planning` only on success, after every refusal
has already exited; default no-push (DEC-008) intact. (3) `cmd_closeout` **prints** (never edits handoff)
the DEC-009 step-9 maintenance checklist with req id/title/date filled. `./check` green, 182 tests.
Gate: infra — planning tested all three live by its own hand (DEC-035): #3 printed the correct checklist
on this very closeout; #2 pushed both branches on the maintenance publish; #1's non-blocking warning
exercised on a controlled drift. Merge `7e6070f` (branch `req-46`, `ca12ddc`, 1 commit). Minor (noted,
left as-is): closeout's internal save fires a transient #1 warning mid-closeout that self-corrects before
the final clean status.

## req-47 — Workout page: date above the info, today black / other dates gray  (merged 2026-09-13)

First of the 2026-09-13 UI/UX batch (Emilio, ux-feel, batch-built). `Today.jsx` `WorkoutInfo` now
renders a two-line stack echoing the Today block — the date (`when`) on its own caption-size line
(`--ui-text-caption`), then `name — focus` below (the old ` · ` separator gone). The body reads
`--ui-ink` (black) for today's row and `--ui-ink-2` (gray) otherwise, keyed off the row's
`dateKey === todayKey` (not the component), so it stays correct if a row is reused for another date;
`todayKey` threaded into UpcomingRow/HistoryPeekRow/CompletedTodayRow. `focus` still degrades
gracefully (guard unchanged, DESIGN §1). New CSS `.ui-workout-info/__date/__body/--today`, no new
tokens. The emphasized TodayWorkout/TodayEmpty block is byte-unchanged (Emilio: the today row is
special). Gate: ux-feel — planning verified by its own hand in an isolated worktree (lint 0, build ✓,
182 tests) and merged (DEC-035). Merge `55c20e8` (branch `req-47`, `7b3883d`, 1 commit). CC's one open
feel-choice left for Emilio's after-look: only the body darkens for today; the date line stays gray.

## req-48 — Rename Future→Schedule / Past→History, mark today on the Schedule  (merged 2026-09-13)

Second of the 2026-09-13 UI/UX batch (Emilio, ux-feel, batch-built). `Today.jsx`: two section-link
labels swapped — "Future workouts"→"Schedule", "Past workouts"→"History" (targets `/schedule`,
`/history` unchanged). `Schedule.jsx`: `todayWeekday = new Date().getDay()` (0=Sun; the same convention
`slotsOn`/`WEEKDAY_ORDER` use — verified), each day row computes `isToday = week === currentWeek &&
weekday === todayWeekday` and passes `value={isToday ? 'Today' : null}` — a "Today" tag in the existing
Row value slot, no new CSS. Requires BOTH conditions, so a non-current loop week is never marked
(failure-case criterion). Gate: ux-feel — planning verified by its own hand (182 tests, detached
worktree; weekday convention checked against `schedule.js`) and merged (DEC-035). Merge `0c62ff6`
(branch `req-48`, `f61d52a`, 1 commit). CC's open feel-choice for Emilio's after-look: marker is a
"Today" text tag (vs a dot or bold weekday).

## req-53 — In-progress workout becomes the main-page hero (drop the "in progress" row)  (merged 2026-09-13)

Emilio 2026-09-13, ux-feel. First of the 2026-09-13 batch, and the first build via a **fresh
ephemeral agent** (DEC-037 — no `/clear`). `src/views/Today.jsx`: removed the top "In progress.
[Continue]" row; `TodayWorkout`'s `inProgress` branch now renders a primary full-width **Continue**
(`startOrContinue(store, activeRoutineId(mine))`) + an inline "in progress" marker instead of `null`;
new `InProgressHero` for an active workout that matches no today slot (name/focus/date from the
workout's own record via `findRoutine`+`workoutRoutineName`+`snapshot?.focus`+`workoutDateKey`, so a
deleted routine still shows the snapshot name — DESIGN §1); `activeIsTodaySlot` guarantees the active
workout renders exactly once; `TodayEmpty` suppressed while a workout is in progress. New
`.ui-inprogress` eyebrow marker (existing tokens). Open case decided by Emilio: the in-progress
workout is always the hero. Planning verified by its own hand (isolated worktree, 182 tests) and
merged (DEC-035). Merge `a65bb21` (branch `req-53`, `f08a023`, 1 commit). No reviewer (single view).

## req-51 — iPhone safe areas + accessibility: the menu clips in full-screen  (merged 2026-09-13)

Emilio 2026-09-12, ux-feel. Root cause [measured]: `index.html` viewport meta lacked
`viewport-fit=cover`, so iOS resolved every `env(safe-area-inset-*)` to 0 and the existing bottom
safe-area math was inert → the bar clipped the home indicator in standalone (L-009). Fix: added
`viewport-fit=cover`; `.ui-main` reserves top + left/right insets; `.ui-tabbar`/`.ui-subbar__link`
add landscape side insets; all `env()`-driven with `0px` fallback (no dead gap on no-notch — locked
by `src/ui/safe-area.test.js`, incl. the failure-case "no hardcoded px" assertion). A11y: measured
grayscale contrast on white — `--ui-ink-2` 5.33:1 (AA pass), `--ui-ink-3` 3.28:1 (fails normal;
stays only on disabled text [1.4.3-exempt] + the chevron glyph [graphic]); moved the meaningful
`.ui-inprogress` status text ink-3→ink-2. Flagged + deferred (not fixed): error banners render
outside the top-inset padding. Planning verified by its own hand (187 tests) and merged. Merge
`308a045` (branch `req-51`, `8693618`, 1 commit). Real-device look owed (Emilio, non-blocking).

## req-52 — Bottom menu: floating Workout-oval + icon-only circles  (merged 2026-09-13)

Emilio, ux-feel, design co-decided via the `/design` mockups (DEC-036). Replaced the three-text-tab
`TabBar` with a floating bottom menu **extracted to its own component** `src/ui/BottomMenu.jsx`
(wired in `App.jsx`; `TabBar`/`TABS`/`.ui-tabbar*`/`--ui-tabbar-h` removed — no stale code). Three
controls L→R: **Library** (icon-only circle, grid SVG) · **Workout** (wide text-only oval, `flex:1`)
· **Settings** (icon-only circle, sliders SVG). Solid — no translucency, no shadow; floats inset from
the edges. Selection model A: the current screen's control is ink-filled (`.is-current`, currentColor
flips the icon/text), others carry a faint hairline border — driven by `activeTab(route.name)` (shared,
unit-tested; targets unchanged; hidden on `workout*`). Content clears the dock via `--ui-dock-clear`
(`env(safe-area-inset-bottom)`-driven); `.ui-subbar` re-anchored above it. a11y: `aria-label` on the
icon circles, `aria-current` on the selected. Test note (L-010): `node --test` has no JSX transform,
so render criteria are locked by a static-source test + behavioural `activeTab` coverage. Planning
verified by its own hand (194 tests) AND an **independent reviewer** (shared shell, DEC-035 — no
issues) before merge. Merge `18327e5` (branch `req-52`, `57c84f2`, 1 commit). On-device feel owed
(Emilio, non-blocking).

## req-54 — Bottom menu: the "Workout" oval uses the app font  (merged 2026-09-13)

req-52 after-look (Emilio: "workout has a different font"). One-line fix: `.ui-dock__btn` set
`font-size`/`font-weight` but no `font-family`, and the dock renders outside `.ui-screen`, so the
"Workout" text fell back to the browser default serif (the SVG icons were unaffected). Added
`font-family: var(--ui-font)`. Planning verified by its own hand (194 tests, isolated worktree) and
merged. Merge `a537a82` (branch `req-54`, `885dff6`, 1 commit). (Closeout emitted the known transient
`check_handoff` "commit not in HEAD" warning mid-run — verified reconciled: `885dff6` is an ancestor
of main, both worktrees clean.)

## req-55 — One in-progress workout: hero-replacement, stale lifecycle, abandon-on-new  (merged 2026-09-13)

Emilio / DEC-038, ux-feel + persisted-data. Supersedes req-53's standalone second hero and removes the
multi-draft feature. Model: exactly one in-progress workout (`store.activeWorkout`). Starting a different
one warns "Starting a new workout will abandon the workout in progress" and discards the current (no draft
stacking); `startWorkout` stops writing `draftWorkouts`. An in-progress workout **started today** replaces
today's Start block as the single hero (finish/abandon → today's Start returns); once **started a prior
day** it drops to a Continue row in the recent peek and Continue + Abandon in the History view, never
counted as finished history or fed to `progress.js`. Abandon = discard, no record. **Non-destructive
migration:** `draftWorkouts` kept and only drained through the UI (`continueDraft`/`abandonDraft`); a
migration test (real `loadState`, seeded `workout-mvp-v7` draft) proves the draft survives, is surfaced,
stays out of finished history + recommendations, and persists to v8. Built via an ephemeral agent
(DEC-037); an **independent reviewer** caught one bug — today's Start silently resumed a stale prior-day
workout of the same routine — **fixed on-branch** (`488a50e`: "continuing same" now also requires the
active was started today, with tests). Emilio's eyes-before-merge (persisted-data carve-out) given.
Files: `store.jsx`, `storage.js`, `workout-actions.js`, `Today.jsx`, `history/list.jsx`, `Start.jsx` +
tests. `./check` green, 213 tests. Merge `127ea54` (branch `req-55`, `a382217`…`488a50e`, 2 commits).

## req-56 — Start/Edit on routine rows; Schedule into the Library segmented; drop the first-page Routines strip  (merged 2026-09-13)

Emilio 2026-09-13 (phone testing), ux-feel + functional. The Library toggle is now **Schedule ·
Routines · Exercises** (Schedule hosted inside the toggle via `Library tab="schedule"`; its list view
drops `<Back/>`, drill-downs keep theirs). Each routine row (`Routines()`) gains **Edit** (a NavLink →
the routine detail/manage screen, left) + **Start** (primary Button → `startOrContinue(store,
routine.id)`, right — reuses the req-55 one-in-progress / abandon-on-new path), DESIGN §4 order.
Removed the first-page `.ui-subbar` "Routines" strip and the now-orphaned `/start` picker
(`StartWorkout` deleted; route, `ui-screen--subbar`/`.ui-subbar*`/`--ui-subbar-h` CSS removed).
`activeTab`: `schedule*` → **library**, so the bottom-menu Library circle lights on every Schedule
screen. Built via an ephemeral agent (DEC-037); independent reviewer cleared it (routing correct, no
dangling refs, no test weakened — the visit-stack test swapped `/start`→`/schedule` preserving intent).
Planning verified by its own hand (213 tests) and merged (DEC-035); Emilio's phone look is the
non-blocking after-check. Merge `0e88642` (branch `req-56`, `39d4dc5`, 1 commit).

## req-58 — Routine-row Start is secondary  (merged 2026-09-13)

Emilio: starting from the Routines page is the off-schedule fallback, so its Start shouldn't carry the
primary ink emphasis. One line — the routine-row Start `<Button>` variant `primary`→`secondary`
(onClick/position unchanged; the today-hero Start stays primary). Built via ephemeral agent; planning
verified by its own hand (213 tests). Merge `5861aed` (branch `req-58`, `8b4772b`, 1 commit).

## req-57 — Front-page schedule preview removed  (merged 2026-09-13; scope corrected by req-59)

Emilio "remove schedule from front page." Removed the front-page upcoming preview (the `<Row
to="/schedule">Schedule</Row>` link + the `UpcomingRow` items + the "Nothing scheduled." line) and the
now-dead `UpcomingRow` / `upcoming` / `remainingInLoop` import. Merge `4a476f0` (branch `req-57`,
`558135d`, 1 commit). **Over-removed (L-013):** Emilio meant only the Schedule *nav link*, not the whole
preview — **req-59 restores the upcoming items, keeping just the link removed.**

## req-59 — Restored the front-page upcoming preview; kept only the Schedule link removed  (merged 2026-09-13)

Corrects req-57's over-removal (L-013). Restored the upcoming preview from the pre-req-57 source — the
`UpcomingRow` component, `upcoming = remainingInLoop(...).slice(0,2)`, the `remainingInLoop` import, and
the headerless upcoming `<List>` + "Nothing scheduled." — minus the `<Row to="/schedule">Schedule</Row>`
nav link (Emilio wanted only the link gone, not the whole preview). Today hero + recent/History
untouched; `remainingInLoop` is imported again so its export is no longer orphaned. Planning verified by
its own hand (213 tests). Merge `58a59eb` (branch `req-59`, `2c7c11d`, 1 commit).

## req-60 — Front page reads chronologically (future top, today middle, oldest bottom)  (merged 2026-09-13)

Emilio: "dates should be chronological — oldest at the bottom, most future at the top, today in the
middle." The upcoming preview was rendered ascending (nearest-future at top, reading backwards);
reversed it at render time (`remainingInLoop(...).slice(0,2).reverse()`) so the furthest of the two
soonest workouts sits at the top and the nearest just above the today hero. The recent peek was already
descending (most-recent below today, oldest at the bottom), so the whole column now decreases top→bottom:
future → today (hero) → past. Shared helpers (`remainingInLoop` / `sortWorkoutsByDate`) untouched — only
`Today.jsx`. Planning verified by its own hand (213 tests). Merge `f8567f7` (branch `req-60`, `d5bff03`,
1 commit).

## req-61 — gitignore `.claude/worktrees/` (fixes L-011)  (merged 2026-09-13)

From the 2026-09-13 workflow feedback. Added `.claude/worktrees/` to the code repo's `.gitignore`, scoped
so the tracked `.claude/settings.json` + `.claude/skills/` stay tracked. Ephemeral build-agent worktrees
(isolation: worktree, DEC-037) no longer show as untracked in `git status`, so a parallel agent build no
longer blocks `plan closeout` on a sibling req (the L-011 snag, previously worked around by serializing).
Verified: `git check-ignore` hits `.claude/worktrees/agent-*`; `git ls-files .claude/` still lists the
tracked config. `./check` green, 213 tests. Merge `9e0dc77` (branch `req-61`, `82aee03`, 1 commit).

## req-49 — Back goes to the logical parent, not the last-visited page  (merged 2026-09-13)

Emilio: back buttons sent you to the last *visited* page, not the screen's logical parent. `Back`
(`shared.jsx`) gained a `to` prop and now navigates to that fixed path; all 33 `<Back>` sites pass
their logical parent (parent map confirmed against each view). The visit-stack `back()`/`applyBack`
were **removed** from `route.js` (grep confirmed only `Back` + `route.test.js` used them); visit-view
analytics (`applyVisit`/`recordScreen`) stayed. Two parents were CC's call → **DEC-039**: `history-set`
Back → the workout-exercise screen (matches its `cancelTo`); in-workout Back → Today with the workout
left **active** (Abandon is the discard). Added `src/views/shared.test.js`; `route.test.js` asserts the
removal. `./check` green, 218 tests. **FF-merged** to main (commit `41ab51c`) ahead of close-out (a code-
session process slip); reconciled 2026-09-13. Independent-reviewer gate (shared route/helper) was owed
per DEC-035 — noted; the diff + tests were read on record.

## req-50 — Everything clickable uses a library component (no bare text links)  (merged 2026-09-13)

Emilio: some "buttons" were still bare link-text. Presentation + component-routing only, no
behaviour/route change. Every bare navigation link got a library class; the one raw `<a>`
(`workout/item.jsx`) now routes through the `NavLink` primitive. Per DEC-016, navigate-only controls
(Cancel/Skip/row links) stayed `NavLink` — given the **button look** (`ui-btn--quiet` / `--secondary`)
where they sit beside a real `<Button>`, without an imperative `go()` handler → **DEC-040**. State-
changers (Save/Start/Remove/Delete) were already `<Button>`, untouched. A follow-up gave standalone
nav links the forward `›` affordance. `./check` green, 218 tests (no test change — presentation).
**FF-merged** to main (`e95685c` + chevron follow-up `8cb9980`); reconciled 2026-09-13.

## req-63 — Pre-merge phone-test gate (demo over Tailscale)  (merged 2026-09-13)

Tooling (branch `demo-staging`, recorded as req-63). `npm run demo` (`vite build && vite preview
--port 4173 --strictPort`, base `/`) exposed over the tailnet via `tailscale serve` gives a built branch
a real **HTTPS** URL on the phone before merge — unblocking wake-lock/notifications/add-to-home-screen
(the L-003 blocker) that a plain-LAN host couldn't. `vite.config.js` got `allowedHosts: ['.ts.net']`;
runbook in `DEMO.md`. → **DEC-041** (this is the standard pre-merge phone-test gate; supersedes the
backlog "per-branch preview deploy (cloud)" item for Emilio's testing — planning still can't use it,
it runs on his Mac). `curl :4173/` → 200 at base `/`; `./check` green. **FF-merged** to main (`8542c46`);
reconciled 2026-09-13.

## req-62 — Kill the action/navigation label ambiguity  (merged 2026-09-13)

Emilio, on the demo: "is *Done* really done?" — nav links read ambiguously against buttons. `Back` became
the `NavLink` primitive (`‹ Back`, a declarative `<a href>`) everywhere, completing the fold-in req-50
deferred (same req-49 targets, no behaviour change); the off-vocabulary "**Done**" links (Routine/Schedule,
now redundant with req-49's Back) were removed; "**Correct**" → "**Edit**" on the link and its screen title.
Rule recorded in DESIGN §4 / **DEC-042**: navigation = link treatment (‹/› chevrons) + §4 verbs; actions =
Button; no off-vocabulary verbs. ux-feel gate met on the demo (Emilio). `./check` green. Branch
`req-62-nav-vocabulary` (`e5737f8`), merged `--no-ff` via `./plan closeout req-62`.

## req-64 — Remove START-HERE.md; boot prompts fold into README  (merged 2026-09-13)

The conclusion of DEC-043/DEC-044's duplication cleanup. req-64 first *trimmed* START-HERE to
cold-start-only; on review Emilio asked whether the file was needed at all — it wasn't. The root
`CLAUDE.md` banner auto-loads every turn and already self-routes each worktree (planning →
handoff/PLANNING.md, build → the CLAUDE.md guide), so a cold-started session loads its context
without START-HERE (proven live). README is the conventional entry, so a second START-HERE doc was
a redundant front door holding prompts CLAUDE.md had made optional. Deleted `START-HERE.md`; moved
the two boot prompts + the task hint into a new README **"Boot a session"** subsection (planning →
handoff/PLANNING.md, build → CLAUDE.md, per DEC-044), with a note that the prompts are the fast way
in, not the mechanism. Fixed README's two dangling START-HERE refs (:73 link, the Planning-workflow
paragraph). The `CLAUDE.md` banner — the actual routing — was left untouched (verified). Root-doc-
only (no handoff/), built by the code session. Verified by planning: `git ls-files START-HERE.md`
empty, `grep -rn START-HERE README.md CLAUDE.md src/ .githooks/ plan` → none, `grep Cowork README.md`
→ none, CLAUDE.md unchanged; `./check` green (218 tests). Branch `req-64` (`451d61a` trim + `42c3adf`
delete, 2 commits), merged `--no-ff` via `./plan closeout req-64`.

## req-65 — Reconcile CLAUDE.md's merge model with DEC-035  (published 2026-09-14)

Workflow-review finding #1: `handoff/CLAUDE.md` (auto-loaded into the build session every turn) still
asserted the pre-DEC-035 merge model — "a human using the app is a merge gate… do not merge on your own
initiative, ever" and "Emilio uses UX and persisted-data reqs himself first" — a live "fact in two
places, follow the one you never read" trap. Rewrote the two passages ("How work arrives" + the former
"Nothing merges until Emilio has used it" section, now "You report it ready; you never merge it") to the
DEC-035 model: the build session reports built + unmerged and never merges (unchanged); planning tests
everything it can reach by its own hand and merges on that, incl. ux-feel + persisted-data; the only
human/reviewer gates are the two carve-outs (migration/bulk-rewrite → Emilio's eyes; shared-code →
independent reviewer). References DEC-035 by name. Verified: `grep "used it\|not a formality\|himself
first" handoff/CLAUDE.md` → empty; DEC-035 now cited 3×. **Noted, not fixed (out of scope):** the same
stale claim survives at `rules/WORKFLOW.md:217` — follow-up req recommended. Planning-owned, published to
`main` (no code branch).

## req-67 — Make DECISIONS.md navigable (superseded markers + digest)  (published 2026-09-14)

Workflow-review finding #4: 46 DEC entries, 14 supersession mentions, no way to find the *current*
rule without reading all and applying the supersession chain by hand. Added a **"Current rules digest"**
at the top (12 bullets, each live operational rule → its current DEC: merge gate DEC-035, build lanes
DEC-037/009, isolation DEC-005/008/026, persisted-data DEC-032, history-is-truth DEC-002/022/030, one
in-progress DEC-038, nav vocab DEC-042/040/039, nav structure DEC-036, platform DEC-010, phone-test
DEC-041, styling DEC-017/020, boot DEC-044). Marked the 6 DEC entries a later DEC supersedes with a
non-destructive `> SUPERSEDED` blockquote at their top: DEC-006 (gate→DEC-035, publish→DEC-008, partial),
DEC-009 (gate→DEC-035, loop→DEC-037, partial), DEC-018 (→019/024/036), DEC-019 (→024/036), DEC-024
(→036), DEC-043 (→044). DEC-005 left as-is (already carries an accurate inline "partly superseded by
DEC-006/008/026" note; still the live isolation rule). Verified: `git diff --numstat` = 48 added / 0
deleted (append-only preserved), 6 markers, digest present. Supersession mentions that target a non-DEC
(a req, a backlog item, a PLANNING.md rule, a feature) were left unmarked, correctly. Planning-owned,
published to `main` (no code branch).

## req-68 — Name the two sessions Planner / Builder + message tags  (published 2026-09-14)

Emilio: the two persistent Claude Code sessions (planning + code, separate terminals) had been
confused for each other once, with consequences. Standardized role handles matching a sibling project:
**Planner** = planning session (`workout-planning`), **Builder** = code session (`workout-codebase`).
Every message each writes now starts with its tag on the first line — `[PLANNER]` / `[BUILDER]` — so
Emilio tells the terminals apart at a glance. Recorded durably in the three guides: PLANNING.md ("## The
role" — Planner identity + `[PLANNER]`), CLAUDE.md (top, loads every turn — Builder identity +
`[BUILDER]`; so Builder picks its tag up on its next turn), and handoff/README.md (new "## The two
sessions" map naming both against their worktrees). Ephemeral/spawned build agents report to Planner, not
Emilio's terminal, and are explicitly excluded from tagging. No worktree/branch/dir renames — handles in
text + tags only. Verified: `[PLANNER]`/`[BUILDER]` instructions present in PLANNING.md/CLAUDE.md,
README names both. Planning-owned, published to `main` (no code branch).

## req-66 — Enforce the --no-ff-merge-to-main invariant  (merged 2026-09-14)

Workflow-review finding #2: the closeout/status machinery reads a `Merge branch 'req-N'` commit's two
parents to compute a req's status line; four FF-merges this session left no merge commit, so `plan
closeout` couldn't flip status and needed hand-recovery. Builder chose **approach A (guard)** over the
spec's suggested B (tolerate), because **B is impossible** — after a pure FF the branch tip becomes the
merge-base, so the recompute range is empty (measured vs the real FF'd req-49); tolerating would mean
inventing a range (DEC-045). One new file `.githooks/pre-push` (executable), nothing in `plan` touched:
on a push to `main` it refuses if a local `req-*` branch tip sits on main's first-parent spine (= a FF);
`--no-ff` puts the tip off-spine (2nd parent) → allowed. Legit paths unblocked — closeout (`--no-ff`,
branch present), publish (doc-commit FF), non-main pushes. Escape hatch `WORKOUT_ALLOW_FF=1` (never
silent). Planner verified independently in a scratch repo (bare origin + clone on the real hook): FF
refused w/ fix printed, `--no-ff` allowed + real `Merge branch` commit, override/doc-FF/non-main all
allowed; `./check` green (218). Built by Builder on branch `req-66`, closed out by Planner.
**Follow-up flagged (not in scope):** `plan doctor` (`plan:598`) checks the literal string `.githooks`
while this worktree's `core.hooksPath` reads absolute — a possible false `FIX: hooks`; hook still runs.

## req-69 — Two follow-ups from the 65–68 blocking batch  (published 2026-09-14)

Cleanup of two trivia surfaced while shipping the batch. (1) **`rules/WORKFLOW.md:217`** carried the same
pre-DEC-035 merge claim req-65 fixed in CLAUDE.md ("closes out, merging by req type (DEC-009) — Emilio
uses UX and persisted-data reqs himself first"); rewrote it to the DEC-035 model (planning tests what it
can reach + merges on that; carve-outs = migration/bulk-rewrite → Emilio, shared-code → independent
reviewer). (2) **`plan doctor` false `FIX: hooks`** (exit 1): the code worktree's `core.hooksPath` was
absolute while doctor checks the documented relative `.githooks`; the hook ran fine either way. Reset it
(`git -C …workout-codebase config core.hooksPath .githooks`) — verified in a scratch repo that a relative
hooksPath still fires the req-66 guard, incl. from a subdir (git resolves it against the worktree top, not
cwd). Now `plan doctor` exits 0 (`ok hooks`). **Left as an optional future Builder req (out of scope,
DEC-005 isolation):** hardening doctor to accept an absolute path that resolves to the worktree's
`.githooks`, so config drift can't false-fail again. Verified: WORKFLOW.md stale phrasing gone; no other
guide asserts the old gate; doctor exit 0; hooksPath `.githooks`. Planning-owned, published to `main`.

## req-70 — Reconcile the remaining merge-gate drift to DEC-035  (published 2026-09-14)

First follow-up from the workflow-machinery audit (`audits/workflow-2026-09-14.md`). req-65/69 fixed the
pre-DEC-035 merge-gate language in CLAUDE.md + WORKFLOW.md-Branching, but the audit found 9 stale spots +
2 self-contradictions still teaching the DEC-009 "Emilio uses it before merge" gate, concentrated in the
3 docs the reconciliation pass missed — worst being `PLANNING.md:44` ("Never merge on green tests alone",
the direct opposite of DEC-035 and of how Planner just operated). Fixed each to DEC-035 (planning tests
what it can reach + merges on that, ux-feel + persisted-data included; the two carve-outs — migration/
bulk-rewrite → Emilio, shared-code → independent reviewer — are the only pre-merge gates; untestable feel
is felt after, non-blocking): PLANNING.md (merge-is-yours block, the stale batch paragraph contradicting
its own DEC-035 batch rule, the 3 "use-it gate for UX/persisted-data" residues, the Feel/UX line),
WORKFLOW.md (Reviewing checklist item 5, which also contradicted its own Branching section), CLOSEOUT.md
(the DEC-009 per-kind preamble → DEC-035). Marked the BACKLOG per-branch-preview-deploy item superseded-
in-part by DEC-041. Correctness in place; single-homing is req-71. Verified: stale-gate grep clean across
all three docs; `./check`/check_handoff green via publish. Planning-owned, published to `main`.

## req-71 — Consolidate the workflow docs to one-home-per-rule  (published 2026-09-14)

Workflow-audit follow-up #2: ~15 operational rules were stated in full in 2–5 docs, so a change to one
rotted the copies (the merge-gate drift, req-65/69/70, proved it). Single-homed each rule + replaced the
restatements with cross-refs, keeping CLAUDE.md self-contained (Builder loads it every turn → one-liner +
pointer, never gutted). Homes: merge-gate + two carve-outs → DEC-035 (the real anti-drift win — it can't
rot again); migration ask-gate → CLAUDE.md; /clear finding → DEC-037; loop diagram → WORKFLOW.md;
isolation → DEC-005. PLANNING.md's two *internal* duplicates (git-command list, re-check-CC-by-kind)
collapsed to one each (most of its −41). Net −51 lines (PLANNING −41, CLAUDE −2, WORKFLOW −4, CLOSEOUT
−4); DECISIONS.md archive trim deferred by design. Built by a consolidation agent, gated by an
**independent reviewer (PASS)** per DEC-035 shared-doc blast radius — it traced every deleted fact to a
surviving home, confirmed no new contradiction and CLAUDE.md still stands alone; found one dropped nuance
(the /clear→fresh-session SendMessage-address rationale) which was restored in PLANNING.md. Emilio eyed
the before/after before publish. No rule's meaning changed. Planning-owned, published to `main`.

## req-72 — Fit adaptations from the workflow audit  (published 2026-09-14)

Audit §3 (NEEDS-ADAPTATION) had three items; on inspection two were already-handled or cross-domain, so
this delivered the one safe planning-domain change and recorded the others honestly (the audit rated the
machinery "mostly EARNS-KEEP" — no churn for its own sake). (1) Reviewer *doctrine* → already trimmed by
req-71 (operational trigger in PLANNING.md, full doctrine in append-only DEC-035). (2) 6-state readiness
taxonomy slim → deferred: `scripts/check_handoff.py:220-248` validates the exact tags, so it's a Builder/
code change for marginal benefit; logged as an optional Builder backlog item. (3) Per-req paperwork →
done: CLAUDE.md now says to size the report to the req — trivial/mechanical changes get a brief report
(both Technical+Workflow sections kept, but a line or two each; never pad, never drop a real deviation).
Verified: `check_handoff`'s "sections" check targets BACKLOG's index not report structure (safe); check
green via publish. Planning-owned, published to `main`.

## req-73 — Fill the workflow gaps the audit found  (published 2026-09-14)

Audit §4: filled 4 of 5 gaps (the 5th, `reference/migration.md`, deferred to req-75 — it must be derived
carefully from `storage.js`). (1) **Backup discipline** (marked *unconfirmed* — Emilio's policy call): the
store has no undo/backup, so PLANNING.md now says remind Emilio to export a fresh backup before merging any
persisted-data/migration req, plus periodically; ratify → DEC- later. (2) **Live-lane "done"**: DEC-037's
Emilio+CC-live lane now states it closes like any other req — Planner writes the settled result up as a req
doc (+ DEC) and runs the normal gate + closeout. (3) **Workflow-refit cadence**: AUDIT.md names a companion
workflow-fit audit between milestones (the machinery should stay agile, not ossify). (4) **Log entry-path**:
DECISIONS.md header names the digest as the read path + an archive-split option (~1000+ lines, superseded
first) — a move never a rewrite, append-only preserved. No new DEC (backup rule stays unconfirmed guidance).
`check` green via publish. Planning-owned, published to `main`.

## req-74 — Cross-session messages tag `from [PLANNER]` / `from [BUILDER]`  (published 2026-09-14)

req-68 refinement (Emilio): an incoming cross-session message showed the sender's bare tag (Builder's
window displaying `[PLANNER]`), reading as if that window *were* Planner. Split the convention in the
three req-68 docs (PLANNING.md, CLAUDE.md, handoff/README.md): a session's OWN messages keep the bare tag
`[PLANNER]`/`[BUILDER]` (which window this is); a cross-session `SendMessage` to the other session prefixes
`from [PLANNER]`/`from [BUILDER]` (incoming from the sender, not a relabel of the receiving window).
Planner adopted the behaviour immediately. Planning-owned, published to `main`.

## req-75 — Refresh the migration reference (schema.md); + DEC-046 backup ratified  (published 2026-09-14)

Workflow-audit follow-up #5. The audit's gap-5 ("no authoritative migration reference, create migration.md")
was **inaccurate on inspection**: `handoff/reference/schema.md` already IS that reference — so creating
`migration.md` would re-introduce the duplication reqs 70–71 removed. Correct action = refresh the existing
reference, which had drifted (measured 2026-09-12): fixed the corrupt-key caveat (it described an "open req"
though req-36/DEC-032 shipped — now preserve + loadUnreadable + saveState-refuses + banner), flipped v5 to
tested (req-37 shipped its round-trip, storage.test.js:238), refreshed stale line cites (loadState 64-80→
140-184, migrateState 219→221), added a re-verified-2026-09-14 date — all checked against current
storage.js/model.js. Persisted the workflow audit durably at `handoff/audits/workflow-2026-09-14.md` and
recorded in AUDIT.md that workflow audits live in `handoff/audits/` (product audits stay in root `audits/`).
**DEC-046** rode this publish: ratified the req-73 backup rule (Emilio delegated) — Planner reminds Emilio
to Export before any persisted-data/migration merge; digest + PLANNING.md updated. Planning-owned, published.

## req-81 — remove the duplicate "Completed today" on Today (N11, gym-flow batch 2)  (merged 2026-09-16)

Batch 2, req 1/5 (DEC-047 batch mode). A workout finished today rendered twice on Today (the labeled
"Completed today" section + the recent peek). Builder's dedupe direction: the "Completed today" section
owns today's finished sessions; the recent peek excludes exactly that set (filtered by workout id) and reads
as prior-day history. Also guarded the "No history yet." line from printing beneath a Completed-today
section. Today.jsx composition only — no data change. `./check` green (218 tests), `--no-ff`. ux-feel gate:
per batch mode (DEC-047) merged on green without a per-req gym-test hold; Emilio feels it after the batch.

## req-79 — done/not-done contrast in the active exercise list (N6, gym-flow batch 2)  (merged 2026-09-16)

Batch 2, req 2/5. Completed exercises in the active-workout overview read muted (`.ui-row--done`,
opacity 0.45 — whole row) so the eye lands on not-done rows; order + "done" meaning unchanged, `· done`
suffix kept. **Shared-component touch:** `ui/index.jsx` `Row` gained an optional `className=''` prop
(additive; `rowClass` reduces to `ui-row` for all ~40 existing callers — Planner verified every caller
unaffected, DEC-035 shared-code carve-out). `./check` green (218 tests), `--no-ff`. Feel judgement (the
0.45 value) left for Emilio's after-batch pass — one value to tune.

## req-80 — during-exercise: nav to the bottom, inline "Add note" by the title (N7, gym-flow batch 2)  (merged 2026-09-16)

Batch 2, req 3/5. Previous/Skip/Complete now pinned to the absolute bottom (`.ui-setlog__actions`
`position:fixed`, DESIGN §4 order, still inside the form so submit/Enter unchanged); "Add note" is a
small quiet control beside the exercise title (`ExerciseTitle` gained an optional `aside` slot) that
reveals the note field under the title. **Note state lifted out of `SetLogForm` into `WorkoutItemLive`**
(passed straight to `completeSet`; per-set reset via an effect keyed on the current set incl.
Previous/restore) — Planner verified the note→completeSet→store path is intact and `store.jsx`/
`workout-log.js` are untouched (note saves exactly as before). Shared touches additive (`ExerciseTitle`
aside; both callers checked). `./check` green (218). ux-feel (bar placement, aside look, Showcase's
cosmetic fixed-bar dev-only side effect) → Emilio's after-batch pass.

## req-76 — Continue resumes into the current exercise (N2, gym-flow batch 2)  (merged 2026-09-16)

Batch 2, req 4/5. Continue/resume of an in-progress workout now routes straight into the first not-done
exercise's log page (`resumeTarget`, reusing the overview's exact `itemIsMarkedDone || plannedDone`
derivation — skipped counts as done and is passed over); all-done → overview with Finish. Wired into
`startOrContinue` (continuing-same only; start-new still lands on overview) and `continueInProgress`.
**Refactor:** the pure path builders (`itemLogPath`/`itemDonePath`/`itemCurrentPath`) moved from
`helpers.jsx` to a new JSX-free `src/workout-paths.js` (so `workout-actions.js`, loaded by `node --test`,
can share them) and re-exported from `helpers.jsx` — callers unchanged. +6 tests (218→**224**): resumeTarget
selection incl. skipped + all-done→overview, and a startOrContinue hash-assertion integration test.
`--no-ff`. Browser lands-on-current is Emilio's ux-feel check.

## req-78 — rest timer as a floating pill, folded into the next set (N5, gym-flow batch 2)  (merged 2026-09-16)

Batch 2, req 5/5 (last). D1+D2 (Emilio 2026-09-16): `RestBar`→**`RestPill`** (small `position:fixed`
pill, time + tap-to-skip), the req-27 `RestUpcoming` panel deleted, and the next set's log form now
renders **during rest** (no intermediate panel/tap, Complete never locked — self-paced). req-27's
nextSetWeight override folded away; the form's own weight field is the editable surface (no-invent
preserved: seed from restore/carry/history). Pill swapped in on all 5 in-workout screens; form `key`
stable across rest-end so edits survive. **req-25 bug protected:** `restPatchAfterSet` (arming) and
`store.removeActiveSet` (clearing) diffs are EMPTY — logic untouched; `previousSet` still clears via
`removeActiveSet`; added a **source-guard test** (store.test.js) that fails if the rest-clear is ever
stripped. Test edits called out: removed the `weightOverride`/`pendingWeightFor` cases (tested deleted
code), kept restPatch/restRemaining/rest-cue. `./check` green (**216** tests), `--no-ff`.
**Two behaviour removals flagged for Emilio (consequences of D1/D2, not signed off individually):**
(a) the pill has no **Pause/+30s** (were on the old blocking bar); (b) the req-27 progression **↑/↓
marker** dropped with RestUpcoming. Builder's candidate DEC: "rest is informational, not a control
surface; next set always live during rest." **Emilio still owes the req-25 Previous-then-forward check
in a real browser** (Planner has no browser; verified by logic + source guard only).

## req-86 — dev-only "note on this page" capture button (N8, gym-flow batch 2)  (merged 2026-09-16)

Batch 3, req 1/3. Dev-only on-page feedback capture (Emilio: "add feedback directly on a page, fast").
Small "✎" button bottom-left on every screen **in dev builds only** → panel showing the current route,
a note field, Save/Copy-JSON/Clear. Notes go to a **separate** `localStorage` key `workout-dev-notes-v1`
(never `workout-mvp-v8`), capturing `{route, timestamp, text, context}` (context = routeName, id params,
hash, app git-sha). **Fail-closed gating verified:** single render site `{import.meta.env.DEV ? <DevNotes/>
: null}` (App.jsx) → Vite DCE removes it + tree-shakes `src/dev/*` in prod; Builder's `GITHUB_PAGES=true
npm run build` + `dist/` grep = 0 matches (14 in src). Touches no product code (App.jsx 1 line, `src/dev/*`,
a version define). +9 tests (**225**). `./check` green, `--no-ff`. Live render/clipboard is Emilio's check.

## req-82 — empty-day Start = start a workout (N1, gym-flow batch 2)  (merged 2026-09-16)

Batch 3, req 2/3. DEC-047(a) routine-picker. The empty-day (`TodayEmpty`) disabled "Start" is now an
enabled **"Start new workout"** that navigates to the existing `/routines` list (whose per-row Start
already calls `startOrContinue` off-schedule) — reuses that surface, no new UI, no ad-hoc workout, no
data change. Zero-routines is safe by construction (TodayEmpty only renders with ≥1 routine; even so
`/routines` shows the Add path, never a dead picker). `./check` green (225), `--no-ff`. Builder's flagged
trade-off for Emilio: two-tap (Start → pick a routine) vs a one-tap inline picker — inline can come later.

## req-83 — a set value changed mid-workout becomes the future default (N9, gym-flow batch 2)  (merged 2026-09-16)

Batch 3, req 3/3. DEC-047(c) live-apply. (The "future default after finish" half already worked via
history-prefill; this is the immediate half.) A value entered on a set that **differs from the presented
seed** becomes the seed for that exercise's remaining sets **this session**, until changed again.
Mechanism: session-scoped `activeWorkout.seedOverrides` map keyed `exerciseId::wu|work` — **no schema
bump** (optional transient field; `startWorkout` inits `{}`, `finishWorkout` **strips** it so it never
lands on finished history; old activeWorkout without the field loads — migration-tested). Pure
`nextSeedOverrides` compares logged-vs-presented-seed so only a genuine change is captured; `weighted`
gates weight. **All guard rails unit-tested:** no-invent, field isolation (weight-only change leaves
reps), no cross-exercise leak, history-prefill still finished-only, wu→first-work carry default NO.
+18 tests → **243**. `./check` green, `--no-ff`. Live in-gym carry is Emilio's check.

## req-87 — feedback notes: ship to the live site, gated by a Settings toggle (default off)  (merged 2026-09-16)

Revises req-86 (Emilio: "run it on the live site — only I am using it — turn off in settings, default
off"). Flipped the feedback-capture gating from **build-time** (`import.meta.env.DEV` DCE, stripped from
prod) to **runtime**: the ✎ button/panel now ship in the production build and render only when a
**Settings toggle** is ON; **default OFF = absence** of the flag key (turning off *removes* the key).
`App.jsx` `FeedbackNotesGate` reads the flag reactively (`useSyncExternalStore`, same idiom as the
banners) so a Settings flip shows/hides live. Flag in its **own** key `workout-feedback-enabled-v1`;
notes still in `workout-dev-notes-v1`; **neither touches `workout-mvp-v8`** (unit-tested; no store.jsx/
storage.js change). Ships-to-prod-inert verified (`GITHUB_PAGES=true` build grep = 7 matches, the inverse
of req-86). +5 tests → **248**. `./check` green, `--no-ff`. Live toggle flow is Emilio's check (on the
deployed site). `src/dev/*` kept unrenamed (renaming would strand the existing `-dev-` notes key).

## req-84 — auto-complete a finished routine (N10, gym-flow batch 2)  (merged 2026-09-16)

When every exercise is done, the overview shows a "great job" summary (volume/duration/sets, each with a
delta vs the **previous same-routine** finished workout — no prior → **no delta**, no-invent) + a **10s
countdown** that auto-commits via the existing `store.finishWorkout` (empty Feel/Note). **Cancel** →
overview, nothing finished (`autoDismissed` guards re-show); **Edit** → the manual Finish screen. **No
persisted-data change** — verified: `store.jsx` untouched, `storage.js` only adds pure helpers
(`workoutSummaryStats`, `previousSameRoutineWorkout` — prepends `active` to reuse the exact
`groupWorkoutsByRoutine` key), and `buildFinishProgression` is a byte-identical extraction of finish.jsx's
map (finish.jsx output + persisted progression unchanged). Countdown is UI-only (not `restEndsAt`),
double-commit guarded. New `auto-complete.jsx`; `defaultBeep` exported. +6 tests → **254**. `./check`
green, `--no-ff`. ux-feel (10s length, beep, re-arm on revisit) → Emilio.

## req-85 — timed exercises (duration sets)  (merged 2026-09-16, v8→v9 SCHEMA BUMP)

The one schema bump of the session; **merge gated on Emilio's Export backup + eyes on the migration
(DEC-046 / ask-gate #2 — both done before merge).** Orthogonal model (a): exercise `+ hasDuration`
(default false) `+ durationSec` (default 30); routine item `+ durations: []` (per-set seconds). A timed
set logs **duration in place of reps** (weight orthogonal); in-set **Start → count-down → beep at zero
→ Complete** (own timer state, NOT `restEndsAt` — no rest collision); logs the target (editable, v1); no
duration progression v1. **Migration verified safe by Planner:** `STORAGE_KEY→v9`, `v8` prepended to
LEGACY_KEYS, the **read-back-before-delete gate unchanged** (v8 removed only after v9 write confirmed);
`migrateState`/`migrateRoutine` add **defaults only, rewrite nothing**, idempotent; **finished history
untouched** (test asserts logged sets gain nothing); threaded through `buildPlannedWorkout` +
`workoutSnapshot` legacy branch. Re-pointed ~a dozen `v8`→`v9` test/comment refs — mechanical, intent
kept (verified, no weakening). Receipt: `ok - loads a v8(+v5) device into v9, nothing lost, only
defaults`; `ok - throwing write leaves v8 intact`. +7 tests → **261**. `./check` green, `--no-ff`.
**v1 gaps flagged for Emilio:** (a) set-edit can't yet change an existing timed set's duration (preserved,
not editable there); (b) a timed bodyweight set still asks for effort. Both easy follow-ups. All timed-UI
browser behaviour is Emilio's check on the deployed site.

## req-88 — make the feedback button a visible top-right floating button  (merged 2026-09-16)

Follow-up to req-86/87: Emilio found the ✎ button but it was near-invisible (`left:12; bottom:12;
opacity:0.45; 34×34` — a holdover from its dev-only "unimposing" origin). Moved it to the **top-right**
(full opacity, 40×40, drop shadow, `env(safe-area-inset-top/right)` for the notch); the panel now opens
top-right with a `maxHeight` so it stays on-screen (was bottom-left). **`DevNotes.jsx` inline styles
only** — gating (req-87 toggle), the `workout-dev-notes-v1` store, and capture shape untouched. `./check`
green (261), `--no-ff`. Real-device notch/placement feel is Emilio's check.

## req-89 — a headless screenshot script for pre-merge UI visibility checks  (merged 2026-09-16)

From the session retro — enacts the DEC-047 visibility gate. `scripts/screenshot.mjs` + `npm run shot --
<route>` boots the built app behind a tiny static server and captures a PNG with headless Chrome
(Puppeteer, **devDependency** — prod-clean verified, `grep dist/ puppeteer` = 0), phone viewport (390×844)
so bottom-dock/notch occlusion shows. **Seed convention** (reuse for future UI reqs): `--seed <file.json>`
writes a raw state doc to `localStorage['workout-mvp-v9']`, migrated on load — `src/db.json` works as a
fixture. No `src/` runtime change. `./check` green (261), `--no-ff`. Puppeteer-over-Playwright + the seed
convention are tooling impl choices (not a DEC). **Workflow use:** a UI req's report includes the
screenshot of the changed screen; Planner Reads it before merge (WORKFLOW §Batch mode).

## req-90 — `plan closeout` auto-writes the SHIPPED stub + bumps NOW's shipped range  (merged 2026-09-16)

From the session retro — kills the manual ledger step that tripped twice (NOW hit 51 once, a doubled
req-84/85 block once). New **step 4b** in `plan closeout req-N`, run after the status-flip and before the
existing save/publish/push (rides the same publish): (a) appends a `## req-N — <title> (merged <date>)`
heading + a visible `_Stub — Planner: …_` one-liner to SHIPPED.md, and (b) bumps NOW's `**Shipped:**`
range to include req-N (extends `…–N-1`→`…–N` when contiguous, else `, req-N`). Both **idempotent**
(guard on an existing entry / already-covered range) and **non-fatal** (warn, never abort post-merge); the
NOW bump edits only the one-line span (+ a >50-line warning). The SHIPPED *substance* and the "Building:"
marker stay the Planner's (printed as reminders). 18-check `scripts/plan-ledger.test.sh` (not wired into
`./check` — app gate only). `./check` green (261), `--no-ff`. **Note:** req-90's own closeout ran the
pre-merge `plan`, so this entry is the last hand-written one; step 4b applies from the next closeout.

## req-91 — `./plan preview` : one command to open a branch on your phone before merge  (merged 2026-09-16)

From the session retro (approach (c), Emilio). New `preview` verb in `plan`, wrapping DEC-041's Tailscale
flow: `./plan preview [req-NN]` builds the branch (vite base `/`) → backgrounds `vite preview :4173` →
`tailscale serve --bg 4173` → prints the `*.ts.net` HTTPS URL; `req-NN` checks out first (clean tree
only); `./plan preview stop` tears it all down. **Entirely additive** (356 insertions, 0 deletions — no
touch to closeout/publish/save); `serve` never `funnel`; code-worktree-only (DEC-041 caveat). DEMO.md
points at it. Verified by Builder: guards refuse+exit1, build+serve curl 200, clean single-server replace,
stop frees the port, `./check` green (261). **Needs Emilio's one live run** (tailscaled was down in
Builder's session): the real `.ts.net` URL over HTTPS on the phone, and the surgical `--https=443 off`
teardown live. `--no-ff`. With req-89 (Planner's screenshot gate), the UI-blindness gap is closed both
ends. **This was the first live firing of req-90's step-4b auto-ledger — it worked** (stub + range
auto-written).

## req-92 — rest pill bigger / more legible (gym-flow batch 3, note n2)  (merged 2026-09-17)

`.ui-restpill__time` → 28px tabular bold, pill padding s1/s3→s2/s4 (`ui.css`); position + tap-to-skip
unchanged; ±30s NOT re-added (DEC-048 stands — Emilio reaffirmed). `./check` green. Merge `5cd407f`.
On-device: no-overlap-on-narrow-phone is Emilio's after-merge feel check.

## req-93 — workout exercise list: main implied+bold, only warm-up/finisher labelled (gym-flow batch 3, note n3)  (merged 2026-09-17)

New `roleTag()` in `ids.js` (main/absent→'', non-main→`roleLabel`; `roleLabel` untouched so the routine
editor still labels all three). In-workout list, item screen + pre-start preview: main = bold name, no
"— Main"; warm-up/finisher/cardio = name + small muted `.ui-role-tag`. Domino OK — `item.jsx:59` bits
`.filter(Boolean)` drops the '' for main. New `roleTag` unit test. `./check` green. Merge `efe730e`.

## req-95 — feedback note panel: stop iOS auto-zoom on the textarea (gym-flow batch 3, note n7)  (merged 2026-09-17)

Bug: DevNotes textarea inherited the panel's 13px, so iOS Safari auto-zoomed on focus and pushed the
fixed panel off-screen. Fixed to explicit `font: 16px/1.4` (the iOS threshold), `DevNotes.jsx`. Viewport
meta untouched (pinch-zoom intact app-wide). `./check` green. Merge `66c5cbd`. Real-iPhone no-zoom is
Emilio's after-merge check.

## req-94 — Today: merge "Completed today" + recent into one stateful list, kill the double-divider gap (gym-flow batch 3, note n5)  (merged 2026-09-17)

The two adjacent `<List>`s (completed-today + recent peek) → one `<List>`, killing the stacked
divider-under+divider-over white seam (`Today.jsx`). State is now per-row: today's completed rows read
near-black (`.ui-workout-info--today`), prior-day rows gray — the completed session still shows as a row,
just no longer under a "Completed today" heading (header dropped — DEC-049, Emilio confirmed headerless).
De-dup + empty states preserved. `./check` green. Merge `82aae2b`.

## req-96 — replace finish "Next time" with a "you beat last time" line (per-exercise, any axis) (notes n4/n6 + new)  (merged 2026-09-17)

Removed the "Next time" load-recommendation surface from Finish (`finish.jsx`) and history detail
(`detail.jsx`) — inert without RPE. Added a quiet "↑ …" line on Finish driven by new pure module
`src/beat-last-time.js`: per-exercise (matched by exercise id), best work set (warm-ups excluded), on its
natural axis — weighted → heavier or same-weight+more-reps; bodyweight → more reps; timed → longer
`durationSec`. Fires on ANY win, never suppressed by a regression elsewhere; silent with no prior /
no improvement / newly-added exercise (no-invent). Line names first win in workout order + "· +N more".
17-case unit suite. Verified: real persisted sets carry `exerciseId` (`db.json` check) so it matches
production shape; `storage.js` (`workoutVolume`/`workoutSummaryStats`) untouched → req-84 auto-complete
intact. `./check` green (21 test files). Merge `62e5707`. Detection model = DEC-050.
**Known limitation:** some cardio logs duration as free-text `reps` (e.g. "5-8 min") not `durationSec`, so
those never fire a win — silent, never wrong. **Dead-code follow-up (BACKLOG):** `workout.progression` is
now persisted-but-unrendered and `progress.js formatProgressionLine` is now unused; left intact, a later
req decides deletion. Live-on-device wording tweak is Emilio's (isolated in `beat-last-time.js` + `.ui-beat`).

## req-97 — delete the now-unused formatProgressionLine (req-96 follow-up)  (merged 2026-09-17)

Deleted only `formatProgressionLine` from `src/progress.js` (its last export, lines 124–135) — zero
callers after req-96 removed the "Next time" surfaces, no test. No helper cleanup needed (local vars
only). Everything else in progress.js and the progression machinery
(`buildFinishProgression`/`progressionForItem`/`applyProgressionToRoutines`, persisted
`workout.progression`) left as-is — verified LIVE, not dead. `grep -rn formatProgressionLine src` empty;
`./check` green (21 test files); `model.test.js` progression tests pass. Merge `a72b330`.

## req-98 — make "beat last time" work for timed exercises (the capture already exists; guard the transitional false-win)  (merged 2026-09-17)

Verify-don't-recall win: the editable-actual timed capture Emilio asked for already shipped in req-85
(`SetLogForm` DurationTimer logs an editable per-set `durationSec`), so item-2 needed NO capture rebuild —
only a correctness guard. `beat-last-time.js` timed branch changed `cur > prev` → `prev > 0 && cur > prev`
so a newly-flagged timed exercise doesn't fire a bogus "↑ Longer" against a prior logged the old way
(free-text reps, no `durationSec`) — silent, no-invent (DEC-050). +1 test (18/18). No SetLogForm/data
change; adoption stays manual (Emilio flags exercises). `./check` green. Merge `7d0f102`. Follow-up in
BACKLOG: set-edit.jsx can't edit a logged timed duration (history-edit gap); timed bodyweight still asks
effort.

## req-99 — reach exercise settings from the routine editor (Timed discoverability)  (merged 2026-09-18)

Emilio couldn't find the **Timed** flag from inside a routine — it lives on the exercise Details
editor and nothing signposted it. Fix (link + hint, his choice over inline; no duplicate control):
the routine per-exercise editor (`ExerciseFields`, both `RoutineExerciseNew` and
`RoutineExerciseEdit`) now shows an **"Edit exercise settings →"** navlink, plus a quiet hint
*"Not timed. Edit exercise settings to add a duration."* whenever the exercise isn't timed (when it
is, the Duration field already shows and there's no hint). Return-to-routine done with a new
`?from=<encoded-path>` query param on the `exercise-edit` route (`route.js` `parseRoute` now splits
the query off before path parsing — **DEC-051**); `ExerciseEdit` honours it on Save/Cancel/Back and
falls back to `/exercises/:id` on the normal path (unchanged). Builder chose to return to the exact
per-exercise editor (lossless on the edit path, Duration field shows immediately) and took the spec
default (link+hint in both New and Edit, accepting the unsaved-form loss on the add-new-row path).
Planner reviewed the diff, ran the gate (286 tests + lint + build green), confirmed both
`ExerciseFields` callers pass `settingsLink` so the hint never appears without its link. `[ux-feel]`
open: does a first-timer now find Timed on-device — Emilio's call. Merge `0720a91`; `./check` green.

## req-100 — two planning-tool guards: `plan ping` + a blocking NOW.md ≤50 pre-commit check  (merged 2026-09-18)

From the 2026-09-18 external workflow review (B+): turn two prose rules that were violated this
session into tool refusals. **Guard 1 — `plan ping req-N`** (new read-only subcommand): resolves the
req doc like `closeout`, refuses to hand off unless the doc is on main AND `main..planning` is empty
(names what's missing, points to `plan publish`), and on success prints a ready-to-paste handoff ping.
This is the exact guard that would have stopped R1/L-019 (a spec announced "on main" while unpublished).
**Guard 2 — blocking NOW.md ≤50 in `plan save`**: refuses BEFORE `git add -A` if the working-tree line
count exceeds the limit (read from `check_handoff.py:NOW_MD_RULE_LIMIT`, not a second hardcoded 50),
leaving the tree untouched; the post-commit drift report is unchanged. Kills the recurring "trim NOW"
churn (10+ past commits). Builder added `scripts/plan-guards.test.sh` (accepted — precedent
`plan-ledger.test.sh`; manual, not wired into `./check`) covering the write-path refusals that can't be
driven live pre-merge. Planner verified: 3 live ping paths (success + two refusals) + the sandbox suite
(ping-not-on-main R1 case, ping-uncommitted, save-refuse-at-51-no-commit, save-at-50-commits) all pass;
`plan-ledger.test.sh` regression intact; `./check` green. Merge `462f57e`. Tooling only — no app code,
no persisted data.

## req-101 — repair the rotted NOW.md↔status drift check + a planted-failure self-test  (merged 2026-09-18)

From [[L-020]]: `check_handoff.parse_now_md_claims` extracted `{}` from the current NOW.md (its regexes
expected a checkbox/`done:` format we abandoned), so the NOW.md↔status cross-check ran on an empty set
and could never fire. Now **section-aware**: it keys off NOW.md's stable structure — a `req-N` under a
forward-looking region (`**READY, held:**`, `**IN FLIGHT:**`, or the `## Needs decisions` section) is a
`pending` claim, while the top `**Shipped:**` summary, `**Nothing in flight.**` (deliberately NOT
matched by `FORWARD_LABEL_RE`), LIVE/aftermath notes, and `## Milestone`/`## Where to read` are not
scanned. `pending` conflicts **only** with a `merged` doc tag (conservative — no false positives).
Builder also found and fixed a **second latent bug**: the claim check sat after the loop's `continue`
statements, so it never ran for merged reqs even when a claim existed — moved to the top of the loop.
Added `scripts/check-handoff.test.sh`, a planted-failure self-test that asserts the check FIRES on a
merged-req-under-READY and stays silent when placed correctly, and proves it goes red if the parser is
reverted to the old regex-only form. Planner verified: parse returns `{req-101,req-10,req-24:pending}`;
`check_handoff` clean on main (exit 0); the self-test + reverted-parser proof pass; plan-guards,
plan-ledger, `./check` all green. **The repaired check proved itself during its own closeout** — it
flagged NOW.md still listing req-101 as pending against the freshly-merged doc. Merge `c28c4d7`.
Follow-ups Builder surfaced (item #3): `check_backlog_index` is fully rotted (same L-020 class) and
`classify_tag` matches "NEEDS DECISIONS" plural but docs write it singular — both → req-102.

## req-102 — finish the rotted-check sweep: retire check_backlog_index, fix classify_tag, narrow the NOW-scan  (merged 2026-09-18)

Closes the L-020 family. Three fixes to `check_handoff.py`, each with a self-test assertion: **(1)**
retired `check_backlog_index` — it validated a `## Sections`/`§N.N`/`### N.N` index against a
`handoff/work/backlog/` tier dir that was deliberately abandoned (BACKLOG.md is now a prose index), so
retire not repair (Emilio); removed the function, call site, its private constants, and updated the
stale module docstring ("Three checks"→"Two") + the `Finding.check` comment. `BACKLOG_PATH` kept (the
size check's LIVING_DOCS still uses it). **(2)** `classify_tag` now matches `NEEDS DECISIONS?` —
singular (what docs write) and plural; parked reqs were misclassifying `unknown`. **(3)** the
section-scan claims only the first/subject `req-N` per forward-looking line (`.search` not `.findall`),
so an incidental cross-ref no longer false-flags a merged req — the exact bug the req-101 ledger hit.
**Review loop-back (1 round):** Builder's first cut had a self-test assertion (`check_handoff --ref
HEAD` = exit 0) that FAILED on its own branch — the branch-checkout artifact where check_handoff
flags the branch's own not-yet-merged req; Planner caught it by running the full self-test (not the
`tail`ed summary), bounced it back, and Builder replaced it with an environment-independent
import+`run_checks()` no-exception assertion (`6f3b265`). Planner verified from the branch: all 11
self-test assertions pass, `check_handoff` clean on main (exit 0), plan-guards/plan-ledger/`./check`
all green; drift check fired correctly during closeout. Merge `398b95e`. Lessons: [[L-021]]. Tooling
only — no app code, no persisted data.

## req-103 — routine editor: two-line exercise rows, main unlabelled (gym-flow batch 4, F1)  (merged 2026-09-23)

Merge `304e1cf` (branch `bcce94a`, built by the Builder session). Routine-editor rows are now a name line over a
muted meta line from a pure `routineItemMeta` (`ids.js`, unit-tested); main is unlabelled (req-93 rule). Gate:
Planner's own `./check` green in a throwaway worktree (21 test files); screenshot confirmed the rows render.
Follow-up surfaced: History detail (`history/detail.jsx:68,120`) still prints "Main" on every row. Backlog.
Gotcha: `.ui-navlink`'s left inset misaligns a line under it; fixed by dropping the link's left padding in the stack.

## req-104 — exercise screens: drop "Previous" from the done view, smaller exercise title (batch 4, F3+F5)  (merged 2026-09-23)

Merge (closeout 2026-09-23; branch `bdc5704`…`56f4b7b`, throwaway build agent, DEC-055). The done view drops its
Previous section; the exercise title on the log/done screens is scoped to `--ui-text-section` (22px) via
`.ui-exercise-head .ui-title`, the shared `Title` untouched. Static-source test `item.test.js` (3/3). Gate: Planner's
own `./check` green (22 test files); log-screen screenshot confirmed. Follow-up: the done view renders the
exercise title *below* Add set (markup order), backlog.

## req-105 — workout overview: Finish becomes a bottom button, prominent once everything's done (batch 4, F6)  (merged 2026-09-23)

Closeout 2026-09-23 (branch `836b54b`, throwaway agent). Finish is a full-width `NavLink` with the button look (DEC-040)
in a `.ui-workout-end` stack above Abandon: secondary, primary once `allItemsDone(active)` (new pure helper in
`workout-log.js`, also gates the req-84 summary; tested). Rode along: `box-sizing: border-box` on `.ui-btn--block`
(an `<a>` overflowed; buttons were already border-box). Gate: Planner's own `./check` green (23 files); the
all-done-after-Cancel screenshot shows the primary Finish. Follow-up: `npm run shot` can't reach click-behind
states (`--click`/`--scroll-bottom` flag) — tooling backlog.

## req-106 — at the start of an exercise, a small preview of all its sets and weights (batch 4, F4)  (merged 2026-09-23)

Closeout 2026-09-23 (branch `44ee951`, throwaway agent). New pure `setPreview` in `workout-log.js` builds one line per set through
`initialSetFields` (same history/target/override inputs as the form); the target and timed-duration rules moved out of
`item.jsx` into `setTargetFor` / `durationTargetFor` so form and preview can't drift. Shown under the form only while
no set of the exercise is logged. 70/70 `workout-log` tests incl. the fixed-number case. Gate: Planner's own `./check`
green; screenshot shows 4 lines clear of Skip/Complete. Notes: `workout-log.js` now imports `DEFAULT_DURATION_SEC` from
`model.js` (existing cycle, safe — call-time read); Previous-undo of the only set re-shows the preview with normal prefill
while the form shows the restored values (rare, left).

## req-107 — a workout note on the workout overview, carried to Finish (batch 4, F7)  (merged 2026-09-23)

Closeout 2026-09-23 (branch `279f185`, throwaway agent). One workout note: the overview gets an "Add note" reveal (below the list,
above Finish) bound to the existing `activeWorkout.overallNote` via `patchActive` (functional merge, per keystroke);
Finish shows/edits the same value (its local state removed); auto-complete saves it through new pure
`autoFinishArgs` (`src/workout-note.js`, with `activeNote` reading a missing field as ''). No store/model/storage
change, no schema bump. Builder's puppeteer run: 13/13 (persist across reload, Finish write-through, History shows
it, legacy active workout). Gate: Planner's own `./check` green (24 files); screenshot shows the note field.
Follow-up: with the note open on an 8-exercise routine, Abandon falls below the fold (scrollable).
