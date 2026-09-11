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
