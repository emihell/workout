# Decisions

Append-only, newest at the bottom. One entry per decision that a user could notice or
that constrains future work. Supersede rather than edit — a later entry can overturn an
earlier one, but the earlier one stays.

**The "Current rules digest" below is the read path** — start there for what's live; the
entries are the archive. Append-only means this grows unbounded: if it becomes unwieldy
(~1000+ lines), superseded entries may be split to a `DECISIONS-archive.md` (digest stays
the entry point) — a move, never a rewrite.

Format:

```
## DEC-001 — short title  (YYYY-MM-DD)
What was decided, in one or two lines. Who decided it (Emilio, or the planning session
on his behalf — mark "unconfirmed" if it was a default he hasn't ratified). Why, and
what was rejected. Cross-ref the req if there is one.
```

---

## Current rules digest

The live operational rules, each pointing at its current DEC. The entries below are the
append-only **archive**; this digest is where to find what is *currently* true. Any entry a
later DEC replaced carries a `> SUPERSEDED` marker at its top. Refreshed 2026-09-24 through DEC-085.

**Process**
- **Merge gate** — planning tests everything it can reach (unit receipts + its own browser run on an isolated origin) and
  merges on that; carve-outs: a real migration/bulk rewrite (Emilio's eyes + a fresh Export first) and the independent
  reviewer. → **DEC-035**, **DEC-046**
- **Reviewer trigger** — follows the files a req touches (store, model, storage, progress, workout-log, migration/load),
  not its Gate tag; a gate line in SHIPPED quotes `./check`'s output and names the reviewer. → **DEC-057** §1, §4
- **A question isn't a decision**; calls made on Emilio's behalf that a user would see are marked `(unconfirmed)` and go
  on his list. → **DEC-057** §2–3
- **Build lanes** — Emilio away + design settled → one throwaway build agent per req; live design/feel → Emilio + the
  Builder session; a single req he wants to watch, or quick fixes → the Builder session. Per-type lanes are being drafted
  (DEC-085 §6). → **DEC-055** (supersedes DEC-054; restores DEC-037), batch mode **DEC-047**
- **Isolation boundary** — planning never touches code, code never touches planning; planning owns planning-worktree git
  (via `./plan save` only, L-032), `publish` and `closeout`. → **DEC-005**, **DEC-008**, **DEC-026**
- **Merge shape** — every req reaches `main` via `--no-ff` (pre-push guard). → **DEC-045**
- **No auto-memory** for either session; licensed third-party data only in a gitignored dir. → **DEC-068**
- **Session boot** — planning reads `handoff/PLANNING.md` directly. → **DEC-044**
- **Audits 2026-09-24** — all recommendations taken (req-156..160, planning docs, Emilio's actions). → **DEC-085**

**Data & trust**
- **History is the source of truth** — never invent data: prefills come from finished-workout data for that field; a
  no-history exercise carries the kg just entered; never invent warm-up reps; hold with no valid increment. → **DEC-002**,
  **DEC-022**, **DEC-030**
- **Carry** — a changed weight carries to the remaining sets, reps never do; an added set with nothing logged stays blank,
  never the routine's number. → **DEC-052**, **DEC-082** §2
- **"Last time"** skips a workout where the exercise was entirely skipped (working sets decide). → **DEC-053**
- **The routine is never updated automatically at Finish**; updating it is a deliberate step. → **DEC-056**
- **Progression** — no new rules until req-149; an unreadable target (range, AMRAP, text) or an assisted exercise holds.
  → **DEC-075**, **DEC-076**
- **Persisted-data safety** — never overwrite an unreadable key (`workout-mvp-v9`; older keys read for migration);
  announce a migration + record count, add a survives-upgrade test; Export before a persisted-data merge. → **DEC-032**,
  **DEC-046** + CLAUDE.md ask-gate #2 (req-157 refines the unreadable-state Import, DEC-085 §2)
- **Numbers** — a comma is a decimal point everywhere a number is typed; "current" workout = started today or within 6 h;
  the Today hero keeps the day's other routines; an empty Finish warns. → **DEC-058**, **DEC-059**

**UI**
- **No native dialogs** — every confirm is the in-app sheet, its action button named for the action; errors are in-page.
  → **DEC-079**, **DEC-080**, **DEC-083**
- **Back** — `go(…, {replace:true})` replaces the browser entry too; an old in-workout page with no active workout
  redirects to its overview; the dead first Back after finishing an exercise is parked. → **DEC-081**/**DEC-082** §1,
  **DEC-084**
- **Rest** is informational, never a control surface; the next set is live during rest. → **DEC-048**
- **One in-progress workout** — starting a new one abandons the old (with the confirm). → **DEC-038**
- **"You beat last time"** — per exercise, any axis. → **DEC-050**
- **Nav vocabulary** — navigation wears link treatment + §4 verbs, actions wear Button; Back = logical parent; routes may
  carry `?from=`. → **DEC-042**, **DEC-040**, **DEC-039**, **DEC-051**
- **Nav structure** — floating bottom menu (Workout oval + icon-only circles). → **DEC-036**
- **Platform** — mobile is primary; the live workout is mobile-only. → **DEC-010**
- **Styling foundation** — minimal, colorless, Apple-inspired component library + a fixed type scale. → **DEC-017**,
  **DEC-020**
- **Phone-test gate** — local `vite preview` over Tailscale; per-branch previews move to the server setup (req-146).
  → **DEC-041**

**Exercise library**
- Our own library, generated (never hand-edited), a three-level muscle tree, one movement pattern, "common" first; RepDB
  removed; content calls delegated (beginner-first). → **DEC-060**..**DEC-070**, **DEC-072**, **DEC-077**, **DEC-078**

**Product direction**
- **Design for the complete beginner first**; the simple routine is the core. → **DEC-071**
- **Toward a real product** — other users soon, training together; backend on Emilio's own server (req-146, waiting). →
  **DEC-073**, **DEC-075** §2

---

## DEC-001 — a failed save shows a persistent banner  (2026-09-07)

When `saveState` can't write to `localStorage` (quota exceeded, Safari private mode), the
app shows a **persistent, app-wide banner** ("couldn't save — your data may not persist,
export a backup") that stays until the next successful save. Emilio decided (chose A over a
transient toast (B) and console-only (C)). Why: this app's whole value is a trustworthy
record, so silent data loss is the one unacceptable outcome, and a toast can be missed.
Drives `req-01`.

## DEC-002 — no-history exercise carries entered kg + reps to later sets  (2026-09-07)

For an exercise with no finished-workout history, logging a working set seeds the next
working set from the most recently logged (non-skipped) working set of that item in the
current workout — **both kg and reps** carry, and it follows the **most recent** set (so
adjusting mid-exercise flows forward). Emilio decided both forks (kg+reps over kg-only;
most-recent over always-set-1). Not invented data — it's the user's own input this
session, filling what would otherwise be blank; stays an editable prefill. Effort does
not carry. Exercises with history keep their per-set history prefill. Drives `req-02`.

## DEC-003 — rest timer becomes a persistent workout-level bar  (2026-09-07)

The rest counter disappeared when leaving the set-logging screen because the countdown UI
+ controls lived only inside that screen while the state was workout-level. Fix: a single
persistent rest bar on every in-workout screen (overview, item log, review, finish),
keeping Pause/Resume/Skip/+30s. Emilio confirmed the reproduction (disappears after leaving
the set screen) and chose the persistent bar over a minimal fix; declined auto-starting rest
between exercises. Audible/haptic end-cue + wake-lock stay a separate Phase-1 item. Drives
`req-03`.

## DEC-004 — a destructive import auto-downloads current state first  (2026-09-08)

Both import sites (`Settings.jsx`, `Today.jsx`) replace all state after one native confirm
with no recovery of the overwritten data. Fix: on the confirm's OK, automatically download a
`buildBackup` of current state (the Export file) before applying the incoming payload — the
download is fired, not blocked on. Emilio chose auto-download over offer-and-wait: offer-first
wants real inline UI and would pull the separate "replace native alert/confirm with inline UI"
backlog item into scope, and its respect-intent benefit is largely moot at Today's empty-state
importer (nothing to lose). This req is a data-safety net, not a UX pass. Both sites route
through one shared import helper (consolidates the duplicated confirm→apply path). Drives
`req-07`.

## DEC-005 — the planning session owns planning-worktree git; the worktrees stay isolated  (2026-09-08)

Previously the planning session wrote `handoff/` but handed every git write to Emilio, on the
stated belief that sandbox git writes from the planning worktree were unreliable. Proven false
2026-09-08: `git reset`, `git commit`, and `git push` all succeed from the planning worktree
and `git rev-parse --git-dir` resolves.

**The governing rule (Emilio, 2026-09-08): planning never touches code, and code never touches
planning.** So ownership is drawn at the worktree boundary, not at "git vs no git":

- **Planning session owns everything inside the planning worktree** — edit `handoff/`, `commit`,
  `./plan save` (commits `handoff/` to the planning branch; runs from and affects only the
  planning tree), and `git push origin planning`. All planning-branch only.
- **Publish is NOT planning's.** `./plan publish` runs *in* the code worktree, merges
  `planning → main`, and moves `main` — that is planning touching code. It stays Emilio's one
  bridge command; the planning session prepares it and hands it over, never runs it. (This
  overrides the earlier in-session answer "I own publish too", which the isolation rule
  dissolves.)
- **Read-only inspection of the code worktree is fine** (e.g. `git log main..<branch>` to
  confirm a build landed) — reading is not touching.
- **Build prompts for the code-worktree CC are handed to Emilio to paste** — planning does not
  drive that session.

Granted via fixed `Bash` allow-rules in planning's machine-local `.claude/settings.local.json`,
scoped to planning writes (`git add/commit/reset/restore`, the narrow push forms
`git push origin planning` and `git push origin main planning`, and the `../workout-codebase/plan`
verbs `save/status/publish/closeout`). The deny on editing the settings files stays. Supersedes the
"Don't run git commands that write" rule in `PLANNING.md`. **Partly superseded by DEC-006/DEC-008**
(planning now runs merge/closeout and publish, which need the `origin main planning` push) and
**DEC-026** (the push grant is scoped to those two forms, not a bare `git push:*`).

## DEC-006 — the planning session runs the merge (`plan closeout`) after Emilio's use-it OK  (2026-09-08)

> **SUPERSEDED in part** — the human-use merge gate here is replaced by **DEC-035** (planning
> merges on its own testing); the standalone-`publish` handover clause by **DEC-008**. That
> planning *runs* the mechanical closeout stays live.

Emilio: *"you can from now on merge."* DEC-005 kept `plan closeout` (merging a built feature
branch to `main`) as Emilio's, because it touches the code worktree. That is now the planning
session's to run — **but the human-use merge gate is unchanged**: Emilio still uses the branch
in a real browser and gives the go for that specific branch; only the *mechanical* closeout
(merge + status-flip + `NOW.md`/`SHIPPED.md` + publish + push) moves to the planning session.
The planning session never merges on green tests alone, and never merges a branch Emilio has
not OK'd.

This is a **deliberate, scoped relaxation of DEC-005's "planning never touches code"**: closeout
merges the feature branch into `main`, moves `main`, and pushes it — planning touching code, on
purpose, for the merge only. Everything else in DEC-005 holds (planning still doesn't build, doesn't
edit code, doesn't drive the code CC). Granted by adding `Bash(../workout-codebase/plan
closeout:*)` to `settings.local.json` (gitignored, planning-worktree-local; the classifier blocks
the planning session from writing its own grant, so Emilio pastes it). Standalone `plan publish`
of doc-only changes was initially left out of the grant — those rode the next closeout or were
handed over — **superseded by DEC-008**, which grants `plan publish` to the planning session
(the widening this note anticipated).

## DEC-007 — error-boundary fallback auto-recovers on navigation; react-test-renderer adopted for render-tests  (2026-09-09)

Two calls from `req-05` (error boundary):

- **The fallback clears its error on navigation, not only on Reload.** A caught React error
  boundary does not reset itself — once `hasError` is true it keeps showing the fallback even as
  the route changes, so the spec's "Back to Today" link (and the still-visible Nav) would be
  inert without a reset. The boundary listens for `hashchange` and clears `hasError`, so
  navigating to a working screen recovers the app with no reload; navigating back to a
  still-broken screen re-throws and re-catches (no loop). This is deliberately one step beyond
  the literal spec (message + Reload + Today link); kept because it makes "the user can navigate
  out" real. Verified in a real browser 2026-09-09 (fallback rendered in place with Nav intact;
  clicking Routines recovered the app). CC surfaced it rather than burying it.
- **`react-test-renderer` (devDependency) is the repo's tool for rendering a component in a
  test.** Emilio chose it over dropping the render-test (weaker — wouldn't prove React actually
  catches a render throw) or adding jsdom + testing-library (heavier). It is devDep-only (not in
  the production bundle), the DOM-free way to run the real reconciler where boundaries actually
  work; it is deprecated in React 19 (cosmetic console warning, filtered in the test). This is
  the repo's **first** React render-test setup — the next component render-test should reuse it
  rather than adding a second approach, unless we deliberately revisit the standard.

## DEC-008 — the planning session also owns `plan publish`; keeps handoff current between builds  (2026-09-09)

Supersedes DEC-006's "standalone `plan publish` stays handed-over." The hand-off proved to be the
bottleneck for the flow Emilio wants — code CC reads the published `handoff/` (the req doc + a
current `NOW.md`) to know what to build, so doc-only updates must reach `main` between builds
without Emilio relaying a publish. `plan publish` is now in the planning session's grant
(`settings.local.json`), alongside a broadened `git push`. It is strictly less than `closeout`
(no code merge), gated identically: publish only with the code worktree on `main` (code CC not
mid-build); `plan publish` also refuses a dirty code tree, and does not push (follow with
`git push origin main planning`). Consequence for the workflow: **the build spec lives in the
published req doc, not in a pasted prompt** — after each closeout the planning session publishes
the next `NOW.md`/req state, and Emilio's trigger to code CC collapses to "build req-NN". The
human-use merge gate (DEC-006) is unchanged; this is only about getting docs to `main`.

## DEC-009 — the two-agent build loop, and the merge gate by req kind  (2026-09-09)

> **SUPERSEDED in part** — the merge-gate-by-kind is replaced by **DEC-035**; the two-agent loop
> is refined/extended by **DEC-037** (lanes). The diff + failure-test review discipline stays live.

The build loop is now: planning session pings code CC (`SendMessage`) to build the next req →
code CC builds on a branch and reports back → planning reviews the diff + tests, loops it back to
code CC for gaps, verifies independently → the merge gate (below) → planning closes out → planning
prunes `NOW.md`/writes `SHIPPED`/publishes → **stop** (does not auto-start the next). Either side
stops for a question, and planning stops at a human gate. First full run: req-03 (2026-09-09).

**Merge gate by kind (Emilio, 2026-09-09).** Refines DEC-006's "nothing merges until a human has
used it":
- **Functional reqs** (logic/bug fixes the planning session can fully verify in a browser) —
  planning browser-verifies and merges itself.
- **UX / feel reqs** (styling, one-handed gym flow — how it *feels*) — planning verifies and
  presents; **Emilio uses it**; planning merges on his OK. The feel is his to judge.
- **Persisted-data reqs** (schema/migration/bulk write — e.g. req-06, req-07) — **always** wait
  for Emilio's hands before merge, never auto-closed. Ties to CLAUDE.md's migration ask-gate.

**Refinement (Emilio, 2026-09-11) — small gym-flow-polish reqs run automatic.** For the gym-flow
notes batch (req-25–29 class: small, reversible UI tweaks with no persisted-data touch), the
"Emilio uses it before merge" step is dropped: **planning browser-verifies and merges itself**, and
Emilio **feels the batch in the gym** afterward, flagging any that feel wrong for a follow-up. Reason:
Emilio was already merging on planning's verification and deferring the feel to the gym (gym feel is
only truly judgeable in the gym), so the present-and-wait round-trip was pure overhead; and these
reqs are reversible with no data risk. **Still get a pre-merge look:** larger or subjective UX where
his eyes matter before it ships — req-10 (setup flow), req-14 (nav), req-24 (inline confirms). Planning
still QAs every one (diff + tests + browser); "automatic" removes the human round-trip, not the QA.
Emilio can always say "show me first."

**Operating rules that came out of the first runs:**
- **`/clear` code CC between reqs** (Emilio's ask). Keeps code CC's context clean per build. The
  planning session **cannot** force it (a message named "/clear" arrives as text, not a command),
  so Emilio triggers it: at each close, planning says "req-NN closed — `/clear` code CC, then
  say build the next." A harness hook on code CC's side could automate it later.
- **Post-closeout maintenance is immediate and mandatory.** `plan closeout` flips the req doc's
  status but does NOT prune `NOW.md` or write `SHIPPED` — planning must, and publish, before doing
  anything else, or code CC reads a stale queue. (Slipped once after req-01/05.)
- **Never ping "build req-NN" until that req's doc and a current `NOW.md` are published to `main`**
  — code CC only sees the last publish.
- **"Done" from code CC is a signal, not proof** — always read the diff, check the failure-case
  test, and run the gate. (Caught req-03's missing recompute test this way.)
- **Loop-hang recovery:** if code CC goes idle without a ready branch (e.g. it stopped to ask
  Emilio a question in its own session), don't wait blind — on the idle notice, check the branch;
  if no ready commit, surface "code CC went idle without a ready branch — did it hit a question?"
- **Reflection cadence:** report workflow issues *during* the process, and reflect + patch the
  workflow (`PLANNING.md`, a `DEC-`/`L-`) at the end of a run. The workflow improves by use.

## DEC-010 — mobile is the primary platform; the live workout is mobile-only  (Emilio, 2026-09-09)

This app is primarily a **mobile** app. The only things reasonably done on a computer are setup —
creating routines, exercises, and the schedule — and even those must be fully doable on mobile
too. The **actual in-gym workout** (Start → log sets → rest → Finish) is **mobile-only** in
practice. Web/desktop is secondary. Every UX/design and prioritization call weighs mobile first:
the "flawless gym flow" pass (`DESIGN.md`) is a mobile, one-handed, screen-on target — wake-lock,
big tap targets, thumb reach, legible numbers are mobile concerns before desktop. A native app is
planned for later; the browser-only version is the current form, and browser features chosen now
(e.g. the Screen Wake Lock API for keep-awake — confirmed feasible on Android Chrome / iOS Safari
16.4+) should be ones that carry over. Drives how DESIGN.md is applied and how reqs are ranked.

## DEC-011 — usage analytics: separate key, transition + button counts, export button  (Emilio, 2026-09-09)

A local press/navigation counter to learn the most-used flows and buttons (drives req-08).
Decisions:
- **Storage: a separate `localStorage` key `workout-mvp-analytics`**, isolated from
  `workout-mvp-v8` — never in the workout backup, no schema migration, and a corrupt/oversized
  analytics blob can't touch workout history.
- **Shape: bounded aggregate counts** — `{ screens: {routeName: n}, transitions: {"from>to": n},
  buttons: {name: n} }`. NOT an ordered event log (rejected: unbounded growth + write-on-every-
  press quota risk). Flows are captured as pairwise screen transitions; screens are keyed by the
  parsed route **name** (~44 bounded names), never the id-bearing path.
- **Readout: an Export button in Settings** (reuse `downloadJson`) → `workout-analytics-<date>.json`,
  analyzed off-device. No in-app dashboard yet (mobile-primary, pre-styling — DEC-010).
- **Writes are best-effort and MUST fail silently** — an analytics write that throws (quota /
  private mode) is swallowed, never interferes with the workout or its save-failure banner. This
  is the *opposite* of req-01's surfaced save failure: losing analytics is acceptable, losing
  history is not.
- **Limitation (accepted):** browser-only analytics is **per-device** — Emilio sees only his own
  device's data (or a tester's exported file); cross-user aggregation needs the backend (Phase 3).

## DEC-012 — first-time-exercise "setup" is guided calibration from the user's own sets  (Emilio, 2026-09-09)

For an exercise with no history, reaching its first working set **auto-prompts** "First time — set
it up, or enter manually?" (drives req-10). The two paths:
- **"Set it up" = guided calibration, never an invented number.** The user picks the first weight
  themselves — the app suggests nothing to start, so the core "never invent a starting weight" rule
  (DESIGN.md) holds. They log the set with an effort rating on the existing scale (Easy/Moderate/
  Hard/Failure, `ids.js`), and the app suggests the **next** set's weight by applying its existing
  effort→load-step rule: `moveToValidWeight(±1)` with the `recommendNextPrescription` thresholds
  (Easy → up one valid step; Hard/Failure or missed reps → down; else keep). The suggestion is an
  **editable prefill with its reasoning shown**, never a lock. Calibration sets are logged as
  normal sets (they're real — honest).
- **"I'll enter it" = the existing manual blank form** + req-02's flat carry.

Rejected: the app proposing an initial weight from a heuristic (bodyweight %, similar lifts) —
that invents a starting weight and breaks the core rule. Bodyweight exercises calibrate **reps**
(per `recommendNextPrescription`'s bodyweight branch); cardio/duration exercises are not offered
setup (nothing to calibrate). Integrates with req-02: in setup mode the carry to the next set is
**effort-adjusted** rather than flat. Gate: ux-feel (a mobile in-gym flow) → Emilio's hands before
merge. Drives req-10.

## DEC-013 — in-gym flow cleanup: rest buttons, Back/Previous, drop the per-exercise review  (Emilio, 2026-09-09)

Several workout-flow refinements (drive req-11):
- **Rest bar buttons:** group `[Pause/Resume]` with `[+30s]`; rename **Skip → "Next"** and place it
  **far right** (Next = end the rest and advance to the next set — the current Skip behaviour).
- **Bottom info:** hide the equipment/setup line + exercise **cues during the REST phase only**;
  keep them on the set-logging screen (cues help right before you lift).
- **Back vs Previous:** today a generic history "Back" sits alongside "Previous" (set-undo) on the
  in-exercise screens — two back-ish buttons doing different things. Resolve by convention (Emilio:
  "do what most similar apps do"): on the in-exercise screens replace the generic "Back" with a
  clear semantic link to the workout overview — **"‹ Exercises"** (the overview IS the exercise
  menu) — and keep **"Previous"** for undoing the last set. One labelled exit, one labelled
  set-undo; no generic history-Back mid-exercise.
- **Per-exercise summary:** today finishing an exercise's sets auto-navigates to a review screen
  (`WorkoutItemDone`) where you tap "Done" to mark it complete. **Remove that from the flow** — on
  completing the last set, auto-mark the exercise done and go **straight to the workout overview**
  (the exercise menu) to pick the next. **Keep `WorkoutItemDone` reachable by re-entering a
  completed exercise** from the overview (view its summary / add a set). The **whole-routine summary
  already exists** (the Finish screen) — unchanged.

Behaviour change to watch: "mark done" moves from the review's Done button to last-set completion;
the overview's completion state, the all-done→Finish path, and re-entry "Add set" must all still
work. Gate: ux-feel → Emilio's hands. Drives req-11.

**Refined by req-25 (Emilio, 2026-09-10):** the "last set → straight to overview" transition above
now **carries a running rest**. Bug #5 was that completing the last set of an exercise armed no rest
(the `done`-suppresses-rest guard), so the final — usually hardest — set got no timer. Fixed: rest is
armed by *completion* (only a skipped set / restSec 0 suppress it), and the last set drops to the
overview with the persistent RestBar counting down there ("rest on the overview") while you pick the
next exercise. Rest suppression now lives solely in the pure `restPatchAfterSet` (`workout-log.js`);
`markItemDonePatch` no longer clears rest (it was a second clearing site that would have wiped the
armed countdown). Verified in-browser (Chest Press restSec 90 → rest bar on overview, ticking;
Rowing restSec 0 → no rest).

## DEC-014 — adding a set to a finished exercise reopens it until that set is logged  (2026-09-09)

Emergent from req-11's mark-done-timing change (DEC-013): since an exercise is auto-marked done on
its last set, re-entering it and tapping "Add set" must first REMOVE its key from
`completedItemIds` (`reopenItemPatch`), or the log screen's `markedDone` guard bounces straight
back to the overview and "Add set" is dead. Visible behaviour: adding a set to a finished exercise
un-checks it ("done" disappears in the overview) until the added set is logged, which re-marks it
done. CC surfaced this during req-11; it is the only way to keep "Add set" working under
auto-mark-done, and it reads sensibly (you're doing more work on it, so it isn't "done" until you
finish). Part of req-11.

## DEC-015 — no Back on top-level nav destinations; keep it on drill-down sub-screens  (Emilio, 2026-09-09)

The persistent top nav (Today · Schedule · Routines · Exercises · History · Settings) is on every
screen, so a top-level destination reached from the nav needs no history-`<Back/>` — it's
redundant with the nav (you leave by tapping another nav item). Rule: remove `<Back/>` from the
section MAIN screens (Settings, Schedule main, Exercises main, History main; Today and Routines
mains already have none); keep `<Back/>` on drill-down / detail sub-screens, where it's the way
back to a list. Emilio asked ("do we need a back button in settings main page?") and directed
folding it into req-11 (same back-button-cleanup thread as DEC-013). Part of req-11.

## DEC-016 — navigation is links, buttons are actions only; one shared nav-link component  (Emilio, 2026-09-09)

A consistency audit (2026-09-09) found the codebase already semantically sound in most respects —
**actions are all `<button>`** (no `<div>`/`<span>` fake-buttons), **lists use `<ul>/<ol>/<li>`**,
**screens are `<section>`s with one `<h1>` + `<h2>` sub-sections** — verified consistent, no change.
The one real inconsistency: **navigation is done two ways** — `<a href="#/…">` links AND
`<button onClick={() => go(…)}>` (9 "Cancel" buttons plus Skip / screen-nav across Exercises,
History, Schedule, Routine, Workout).

Rule (Emilio): **pure route navigation → `<a href>` link** (semantic, keyboard/a11y-correct, matches
the hash router); **`<button>` reserved for state changes / submits** (Complete, Save, Delete, Add,
Pause, Import, applyBackup, etc.). The repeated `<button onClick={() => go(X)}>Label</button>` shape
→ **one shared nav-link component** (renders `<a href={toHash(X)}>`), reused across sites (generalizes
/ aligns with req-11's `ExercisesLink`). **Only PURE-navigation buttons convert**; a button that also
mutates state stays a button. Best done *before* the styling pass so styling lands on consistent
semantics (links and buttons will style differently). Drives req-12.

## DEC-017 — a minimal, colorless, Apple-inspired component library as the styling foundation  (Emilio, 2026-09-09)

The app has zero CSS. Before the full styling pass, build a **component library** — extract every UI
element type into a small set of reusable primitives (drives req-13). First-iteration principles
(Emilio: "as simple and as little code as possible, no colors, as raw as possible, easy to press,
inspiration from Apple apps"):
- **Colorless.** Grayscale only (white / black / grays); **no color or theme** yet. Whitespace, type
  weight, and hairline dividers do all the visual work.
- **System font** (`-apple-system, …`); a small type scale (title / section / body / caption).
- **Easy to press.** Tap targets **≥ 44px** (Apple HIG); generous padding; an 8px spacing rhythm.
- **Apple-inspired** structure: grouped lists with hairline dividers + chevrons, segmented controls,
  large legible numbers (gym), buttons as rounded rects distinguished by weight/border not color.
- **As little code/CSS as possible** — a small `src/ui/` of components + one minimal grayscale
  stylesheet. No design system, no tokens beyond spacing/size, no build changes.
- **First iteration = the library + a `#/components` showcase page** to view every component and
  iterate; **the app screens are NOT migrated to it yet** (that's the subsequent per-screen styling
  pass). Mobile-first (DEC-010). Expect heavy iteration; ux-feel gate.

## DEC-018 — primary mobile nav is Today + Schedule; the rest go in a menu  (Emilio, 2026-09-10)

> **SUPERSEDED by DEC-019** (everything in the menu), then **DEC-024** (3-tab bar) and **DEC-036**
> (floating bottom menu). Dead.

Six flat nav items is too many for mobile. **Primary / always-visible: Today** (now) **+ Schedule**
(this week) — the daily-use pairing. **Behind a simple menu** (a "Menu"/"More" affordance):
**Routines, Exercises, History, Settings**. History is review-not-daily, so it moves into the menu
(one tap deeper). The menu can be a plain list for the raw first iteration; grouping (e.g.
Routines/Exercises as a "Plan" area) is refinable later, and analytics (req-08) can validate which
items actually get used. Shapes req-13's `NavBar`.

## DEC-019 — nav: everything goes in the menu; menu closes on item-click or outside-click  (Emilio, 2026-09-10) — supersedes DEC-018's primary items

> **SUPERSEDED by DEC-024** (3-tab bottom bar), later **DEC-036** (floating bottom menu). Dead.

Two visible items (Today + Schedule) + a Menu felt unbalanced. Revised: the **NavBar is just a Menu
trigger**; **all** nav items (Today, Schedule, Routines, Exercises, History, Settings) live inside
the menu. The menu **closes when an item is clicked, and when the user clicks outside it**.
Supersedes DEC-018's "Today + Schedule always visible". Part of the req-13 iteration.

## DEC-020 — a fixed named type scale; all text uses it  (Emilio, 2026-09-10)

Text sizes must come from **one fixed scale**, not ad-hoc per component. Define the scale as CSS
custom properties in `ui.css` and make every component + the showcase reference **only** these — no
loose `font-size` values. Named tiers (concrete px = CC's call, consolidating the current sizes;
suggested Apple-ish starting point):
- **caption** ~13px — eyebrow labels ("BUTTON"), field labels, captions.
- **body** ~17px — default text, buttons, inputs, list rows.
- **section** ~22px — `SectionHeader` (h2).
- **title** ~32px — `Title` (h1) screen titles.
- **display** ~40px — big data numbers (e.g. the kg number).
- The **RestBar time number is doubled** from its current size (its own large step above display).
Single source of truth for text sizes; part of the req-13 iteration.

## DEC-021 — the styling pass: one req styles the whole app; bigger refactors are observed, not done  (Emilio, 2026-09-10)

The styling pass (drives req-15) migrates the **entire app**'s screens off raw HTML and onto the
req-13 `ui/` component library (Screen, Title/SectionHeader, List/Row, Button, NavLink, Field,
NumberField, SegmentedControl, Checkbox, Textarea, Banner, RestBar, SetLogForm). Grayscale still
(DEC-017 — no color/theme yet). Discipline while migrating:
- **Do inline:** small unintrusive tweaks; changes **required** because the app now uses the
  components; fixing **logical or duplicate functions** (e.g. the app's inline RestBar/SetLogForm →
  the `ui/` ones, deduped helpers).
- **Observe, don't do:** anything **bigger** — what could be **merged**, **separated**, or
  **restructured** in the code/architecture. These go into an **improvement findings report
  delivered at the end** (not acted on during the req), so Emilio reviews it and we spec follow-up
  req(s) for the worthwhile ones.
- Migrate **screen-by-screen** (own commit per screen-group) for reviewability. Gate: ux-feel,
  heavy iteration on Emilio's phone. Big diff expected — behaviour unchanged, only the presentation
  moves onto the components.

## DEC-022 — the app never invents warmup reps; the user enters them (audit F1)  (Emilio, 2026-09-11)

The 2026-09-11 audit (F1) found the routine editor stores `{ reps: 12 }` when "WU set" is
ticked — a rep target the user never entered (`Routine.jsx:278`; bare checkbox, no field),
surfacing as the warmup target in the live workout (`item.jsx:179`) and on skipped warmups
(`workout-log.js:60`). This contradicts DESIGN §1 verbatim ("Never invent warmup … 12 reps").

Emilio decided the **rule is right, not the code**: *"it should not invent anything — we do
not know if 12 is good."* So: add a warmup-reps input to the editor (blank for a new warmup,
the saved value when editing one), store exactly what's typed, and remove every `?? 12` /
`|| { reps: 12 }` substitution. A warmup with no reps shows no rep target — absent is absent.

Rejected the two other reconciliations from the audit: keeping 12 as a "structural default"
and softening the rule (rejected — 12 is not knowable to be good), and dropping warmup reps
entirely (rejected — the user should be able to prescribe them).

**Not a migration.** Existing routines saved with `{ reps: 12 }` keep it until the user next
edits that exercise — rewriting stored setup data would be an invisible bulk edit (CLAUDE.md
ask-gate) and we can't tell which saved 12s were accepted. `warmup` already holds `reps`, so
no schema bump. Go-forward behaviour only. Drives req-30 (which also carries audit F2, the
README `db.json` "first-run data" wording fix). Audit F3 (exported-but-internal helpers) was
reviewed and **skipped** (near-zero payoff, slight risk). Gate: ux-feel → Emilio's hands.

Built (req-30): a blank warmup stores `{ reps: '' }` (spec left `{}` vs `{ reps: '' }` to CC) —
keeps the field shape stable so the `?? ''` readers and the editor re-seed stay consistent;
reps stored as the typed string, matching how `sets`/`targets` are held. No new decision.

## DEC-023 — a rest-end cue: sound + vibration, fired once when rest hits zero  (Emilio, 2026-09-11)

The rest timer (`RestBar`, `useRestCountdown`, `restEndsAt` on `activeWorkout`) only ticks a
number on screen — no sound, vibration, or notification when rest ends. In a gym you must stare
at the phone to know rest is up. Wake-lock (req-09) already keeps the screen on, but a lit screen
in a pocket still tells you nothing. Emilio: cue on rest end = **sound + vibration**.

Decided (Emilio picked sound+vibration; the rest follows to keep it small and buildable):
- **Fire on the natural 1→0 edge only** — when the live countdown reaches `restEndsAt`. NOT on
  **Next** (that ends the rest deliberately — `onNext` clears `restEndsAt`), NOT on pause, and
  **exactly once** per armed rest. Re-arming (+30s, pause→resume) produces a new `restEndsAt` and
  is allowed to cue again when *that* one lands.
- **Sound + vibration, both fail-silent, both feature-detected** — mirror the wake-lock (req-09)
  pattern: a null-rendering component, unsupported API = no-op, any throw swallowed, never
  disrupts the workout/logging/save. `navigator.vibrate` no-ops on iOS Safari (unsupported) — that
  is acceptable degradation, sound still plays. A late fire when the tab returns to foreground
  after rest ended while backgrounded is fine (arguably wanted), not a bug.
- **Silent mode: not detectable on the web** — no reliable API. We do not try. The OS mute switch
  silences the sound (as it should); vibration is unaffected. Documented, not engineered around.
- **No settings toggle in v1** (explicit out-of-scope). The cue fires only during an active
  workout, and the phone's own mute governs sound. A toggle is a clean follow-up if the cue feels
  intrusive in use — not built until Emilio asks.
- **Not persisted-data.** No schema change, no `localStorage` write — pure runtime behaviour, no
  ask-gate. Drives req-31. Gate: ux-feel → Emilio's hands (a cue is felt, not asserted; needs a
  real phone in a gym).

Built (req-31): the fire decision **cues only rest-end edges it actually witnesses**. On first
observation the pure `nextCueState` seeds `lastCued` to the current `restEndsAt` when it's already
past, so a fresh mount over an already-expired-but-uncleared rest (a reload mid-expired-rest) does
**not** beep. The spec's allowed "late fire on foreground return" still fires because that's the
same mounted instance, which witnessed the rest arm (`lastCued` null for it). Tone/vibration are
tunable defaults (880→1175Hz two-tone ~270ms, vibrate `[120,60,120]`) — Emilio ratified the feel on
the branch. Merged `e2aa905` (branch `req-31`, `dca29c3`); `./check` green, 16 cue tests.

## DEC-024 — new nav: a 3-tab bottom bar (Workouts / Library / Settings)  (Emilio, 2026-09-12)

> **SUPERSEDED by DEC-036** — the bottom menu redesign replaced this 3-text-tab `TabBar`.

req-13's top-left **Menu** dropdown of six flat items (Today/Schedule/Routines/Exercises/History/
Settings) was a functional stopgap Emilio disliked ("not a fan of the menu"). Decided the
information architecture and the pattern together (Emilio, 2026-09-12, from a previews round):

**Regroup 6 destinations → 3, as a bottom tab bar** (thumb-reachable, DEC-010; the regrouping is
what makes a tab bar fit — 3 tabs is well under the ~5 HIG cap that blocked it against 6 flat items,
superseding DEC-018/019's everything-in-one-menu):

1. **Workouts** — Today + Schedule + History merged. *(Emilio rejected "Timeline": "this is where
   you can start your workout" — the name must read as active, not a passive log.)* Combine them as
   **one unified scroll**: upcoming above, today anchored in the middle (with the Start action), done
   below, and **schedule edits inline** on that scroll. This is the boldest/hardest piece — its own
   req (req-32), built after the shell.
2. **Library** — Routines + Exercises merged into one screen with a **segmented [Routines | Exercises]
   toggle**, both first-class, `+ New` per list.
3. **Settings** — unchanged content, now its own (third, equal) tab.

Rejected: 2-tabs-plus-a-Settings-gear (Emilio chose 3 equal tabs — Settings always one tap, visible);
a slide-up sheet and a redesigned top dropdown (tabs are more thumb-persistent for daily use); and,
for Workouts, the segmented-control and Today-home-plus-links layouts (the unified scroll is the goal
— though "Today + links to Schedule/History" is the **interim** the shell req ships until req-32 lands).

**Split for build:** **req-14** = the shell (bottom tab bar + Library toggle + Settings tab; Workouts
tab = existing Today with Schedule/History reachable). **req-32** = the unified Workouts scroll
(depends on req-14). Both ux-feel → Emilio's hands, heavy iteration expected (first "designed" nav
surface). No persisted-data change — pure routing/UI.

**Built (req-14), refined over 8 review passes with Emilio:**
- **Tab bar = three `ui-btn`-styled links** (not `<button>`), honouring DEC-016 (buttons=actions,
  links=nav) while keeping the Button *look*: Workouts **primary** / Library **secondary** / Settings
  **quiet** (static hierarchy) + a dynamic active underline (`aria-current`). No custom icons (Emilio:
  component-library only). `activeTab(routeName)` is a pure fn in `route.js`, unit-tested. The bar is
  **hidden during the in-workout flow** (route `workout*`) so it can't jump you away mid-set.
- **First tab is labelled "Workout"** (singular); the group id/route stay `workouts` / `/`.
- **Library toggle reuses the existing `SegmentedControl`** (no new primitive) — [Routines | Exercises],
  active segment derived from the route, hosting the unchanged list screens.
- **Workout screen (interim, until req-32)** — a light version of the unified scroll: header (greeting/
  week/in-progress) → **"Future workouts›"** (a plain link to `/schedule`) + upcoming rows (each with a
  Start-ahead) → **Today** (the focal point: **bold date on top**, name — focus below, big **primary**
  Start; empty day keeps the block with "Nothing scheduled today." + a **disabled** Start) → Completed-
  today → past rows → **"Past workouts›"** (plain link to `/history`) → **"Routines›"**, a **fixed strip
  docked above the tab bar** (plain de-styled link to the `/start` picker). All rows share one info
  format — **`date · name — focus`**, one date formatter (`Mon, Oct 13`, year only when not current),
  `focus` from immutable `snapshot.focus`, never invented (DESIGN §1/§3). Schedule & History screens
  gained a **Back** button (no longer tabs). ("Routines" label → `/start` target is Emilio's pairing.)
- Pure routing/UI, **no persisted-data change**. `req-32` (the full unified scroll + inline schedule
  editing) supersedes this interim later.

## DEC-025 — the light peek IS the Workout screen; the unified scroll (req-32) is dropped  (Emilio, 2026-09-12)

DEC-024 chose "one unified scroll" (upcoming/today/past merged into a single time axis with inline
schedule editing) for the Workout group, and req-14 shipped a **light peek** as the interim toward it
(today + ~2 upcoming + ~2 recent, each section a Show-all link out to the full Schedule/History page).

Having used it, Emilio decided **the light peek is the right final design, not an interim** — *"the
light peek is the right way to go; showing more needs a new component and a new idea."* So the Workout
screen stays as req-14 built it (Future workouts› / Today focal block / Past workouts› + the fixed
Routines strip), and Schedule/History keep their own full pages reached via those links.

**req-32 (the unified scroll + inline schedule editing) is DROPPED** — not built. This overturns the
"unified scroll" clause of DEC-024 only; the rest of DEC-024 (the 3-tab bottom bar, Library toggle,
Settings tab, naming) stands. A real merged-timeline concept, if it ever comes, would be a fresh idea
with its own component — not a merge of the current screens, and not from the req-32 spec.

## DEC-026 — the planning session's `git push` grant is scoped to two forms, not a bare push  (2026-09-12)

req-35. The grant in README §Setup and the planning worktree's `.claude/settings.local.json` carried
a bare `Bash(git push:*)` — authorizing *any* push to *any* branch/remote, `--force` included. That is
wider than the trust model DEC-005 states in prose ("deliberately not... a bare `git push`"). Narrowed
to exactly the forms the workflow uses:

    "Bash(git push origin planning:*)",
    "Bash(git push origin main planning:*)",

(`origin planning` for `plan save`; `origin main planning` for `plan publish`/`closeout`, per DEC-008.)
A wrong-branch or force push is no longer pre-authorized — it re-prompts. Applied to README (merged in
the req-33-35 batch, `8daa8f2`); the machine-local `settings.local.json` is Emilio's to re-paste (the
classifier blocks the session from writing its own grant). If the matcher won't accept
`origin main planning:*` as one rule, split per-branch and record the working form.

## DEC-027 — `plan doctor`'s exit reflects setup invariants only; drift is reported, not failed on  (2026-09-12)

req-33. `plan doctor` ends by running `plan status`, which can exit non-zero on *handoff drift*
(unpublished planning, code behind). Open choice from the build: should doctor's own exit inherit that?
Decided **no** — doctor runs `plan status` with `|| true`, so its exit reflects only the five setup
invariants (layout, hooks, deps, grants, identity). Doctor answers "is this machine set up correctly?",
a stable yes/no; drift is a normal transient working state, not a broken setup. The status output is
still shown, so drift stays visible — just not conflated with a setup failure. Accepted as-built.

## DEC-028 — the planning grants stay machine-local; tracking them was tried and reverted  (Emilio, 2026-09-12)

The planning grants (`git add/commit/reset/restore`, the two narrow push forms, the four
`../workout-codebase/plan` verbs) live in the **gitignored, machine-local**
`.claude/settings.local.json` — not the tracked `.claude/settings.json`. Tried the reverse this
session (move them into the tracked file so they sync across machines, avoiding the per-machine
paste), commit `25d7db2`; the 2026-09-12 audit (F-CONFIG-1) caught two costs and Emilio reverted
(`1f609b5`):
- `plan doctor` checks grants by the **existence** of `settings.local.json` (`plan:569-572`), so
  tracking + deleting the local file made doctor report a false `FIX: grants` failure.
- `main`'s `settings.json` is deny-only; the next `plan publish` would merge the `allow` grants into
  `main`, handing the **code worktree** the planning-only grants — the isolation regression DEC-005
  exists to prevent. (A grant only suppresses a prompt, but it removes the guardrail.)

Rejected keeping-tracked because the drift it avoids is already handled: `plan doctor` flags a
missing file and points at README §Setup step 5 to re-paste, and the grants are effectively static.
Reaffirms DEC-005/026 and the README §Setup model unchanged. Follow-up (backlog): harden
`plan doctor` to compare the grant *contents* to the canonical block, not just check existence — the
one drift kind (content drift on one machine) it can't currently catch.

## DEC-029 — a cross-tab write conflict warns and asks for reload; it does not merge  (Emilio, 2026-09-12)

Audit F-RISK-3: two open tabs each hold their own in-memory state and `saveState` writes the whole
key, so the second tab to finish a workout clobbers the first — silently, no `storage` listener.
Decided: add a `storage`-event listener that, when another tab writes `workout-mvp-v8`, shows a
banner ("another tab changed your data — reload") — **warn only, no auto-merge**. Rejected merging
(reconciling two histories is error-prone without a backend and touches the record directly —
backend/Phase-3 territory) and leave-for-backend (the silent clobber is a real data-loss path worth
closing now). Drives a small req.

## DEC-030 — a recommendation with no valid increment holds; it never invents a 0.5 kg step  (Emilio, 2026-09-12)

Audit F-DIV-1: `moveToValidWeight` (`progress.js:28`) falls back to a hardcoded ±0.5 kg when the
exercise has no valid increments — reachable for a `machine`/`free` exercise left at the
`weightStep:'n/a'` default (`store.jsx:172`). That recommends a load the exercise config never
defines, breaking DESIGN §1/§2 ("never invent … recommendation traceable to a valid increment").
Decided: with no valid increment, the recommendation **holds** (action `keep`, no move); the user can
still adjust manually. Rejected requiring a `weightStep` before recommending (adds a setup gate) and
keeping the 0.5 kg default (it's an invented value). Drives a req.

## DEC-031 — "referenced" means referenced by finished history; delete confirm must name the slots it removes  (Emilio, 2026-09-12)

Audit F-DIV-3: `removeRoutine`/`removeExercise` (`store.jsx:44-67,185-204`) test "referenced"
against finished `workouts` only, so a routine referenced solely by a schedule slot or a
not-yet-performed planned workout is hard-deleted and its slots/plans silently removed. Decided:
the history-only reading is **correct** (DESIGN §3 — "history keeps pointing at what it recorded";
setup objects with no history are not part of the immutable record) — but the delete confirm
(`Routine.jsx:150-158`) must **name the schedule slots / planned workouts it will remove** so the
deletion is not silent. Rejected broadening "referenced" to archive-on-slot (a larger behaviour
change for objects that aren't yet history). Drives a req.

## DEC-032 — an unreadable `workout-mvp-v8` key is never overwritten; a distinct banner surfaces it  (Emilio, 2026-09-12)

Audit F-RISK-2: if the `v8` key is present but not valid JSON, `loadState` (`storage.js:64-80`)
returns `emptyState()` — indistinguishable from a blank device — and the first mutation's
`saveState` overwrites the corrupt (but possibly recoverable) key with empty state, silently. Decided
(mirrors DEC-001's trust stance): on an **unreadable** `v8` value, the app must **not overwrite it** —
hold saves and surface a distinct, persistent banner ("couldn't read your saved data — don't clear
anything, export/seek recovery") separate from the save-failed banner, so the raw value stays on disk
and recoverable. Absent key = empty is unchanged; only corrupt-but-present is the new path. Persisted-
data / trust req → Emilio's hands before merge (DEC-009). Drives a req.

## DEC-033 — history detail keeps "Correct" (not "Edit") as a deliberate vocabulary exception  (Emilio, 2026-09-12)

Audit F-DIV-4: the history detail page labels its edit action **"Correct"** (`history/detail.jsx:53`),
not the "Edit" the action-vocabulary contract names for object-detail pages. Kept as-is: README's own
recommendation section says "*Correcting* meaningful history shows a recalculation preview," and the
flow routes edit→recalc-preview — "Correct" names the recalc semantics precisely where a bare "Edit"
would imply a silent in-place change. Recorded so the vocabulary ledger shows this is chosen, not a
slip. No code change.

## DEC-034 — one canonical progression computation; finish.jsx's narrower matcher was the bug  (2026-09-12)

req-40 (audit F-CODE-1). The per-item next-time recommendation was computed twice with divergent
set-matching — inline in `finish.jsx` (what Finish *saves* onto the routine) vs `progressionFromWorkout`
(the History-recalc path) — so the same workout could yield two different saved plans, failing DESIGN §2.
Unified into one pure helper `progressionForItem` (`model.js`, per L-007 so it's unit-testable); both
callers now use it. Where they differed, the **fuller `model.js` semantics win**: match a working set by
`routineItemId || sessionItemId` against the item id-or-fallback **or** `item.id` (catches
legacy/fallback-keyed sets the finish `routineItemId`-only filter missed), and on **no matched working
sets keep `item.targets`/`item.suggestedWeights`** rather than emitting a from-zero recommendation.
finish.jsx's `routineItemId`-only match + unconditional `recommendation.targets` was the bug. Not a new
user-facing choice — the audit-mandated reconciliation. Common routineItemId-keyed case is unchanged
(regression-tested); only sessionItemId/item.id-keyed and all-skipped items shift. Gate: persisted-data
/behaviour → Emilio used it before merge. Merge `078d2c5` (branch `req-40`, `ab4706b`).

## DEC-035 — planning merges on its own testing; every run is explicitly batch or single  (Emilio, 2026-09-12)

Broadens the merge gate after the 2026-09-12 audit run. Emilio: *"if you can then you test — so always
test all you can — and if all tests pass by your hand then it's ok to merge and complete… it should
always be run as batch or single."*

**Planning merges on its own verification.** The planning session must **test everything it can reach**,
by its own hand — not review the diff and trust CC's pasted `./check`. Reachable testing includes: run
`node --test` / `./check`; spin up a **throwaway git worktree of the branch** (symlink the planning
worktree's `node_modules`) to run the branch's tests without touching the code worktree (stays within
DEC-005 — the temp worktree is planning's, not the code checkout); exercise the req's acceptance checks;
browser-test where reachable. **If everything reachable passes, planning merges and completes** — this
now includes **persisted-data and ux-feel reqs**, which DEC-009 had reserved for Emilio's hands.
Rationale: Emilio delegated the merge to planning's testing; a green suite planning *ran itself* is the
gate. 'Done' from CC stays a signal, not proof — planning re-runs, never trusts the receipt.

**Only the genuinely-untestable is left to Emilio, and it does not block.** Real-device feel (gym,
one-handed), a two-tab browser check with no preview deploy (BACKLOG) — planning tests all it can, merges,
and Emilio feels those after and flags regressions (the DEC-009-refinement pattern, now the default).
For persisted-data especially, "test all you can" means **thoroughly**: migration round-trips, the
anti-clobber/anti-corruption tests, the acceptance receipts — all run by planning's hand before merge.

**Every run is explicitly batch or single; planning asks which at the start and never assumes.**
- **Single** — one req: test all reachable → merge if green → complete → stop.
- **Batch** — build → test all reachable → merge → complete → **continue to the next**, until the whole
  batch is done, no per-req human pause. Choosing batch IS the approval for continuous building
  (supersedes PLANNING.md's "batch needs Emilio's OK" as a separate step) and for skipping `/clear`
  between the batch's reqs. A mode holds for that run only.

Supersedes DEC-009's per-kind merge gate (functional=planning, ux-feel/persisted-data=Emilio's hands)
wherever planning can test the req; DEC-009's "read the diff + failure test, run the gate, never trust
'done'" discipline is kept and strengthened (planning now *runs* it). The human-use gate survives only
for what planning cannot reach.

**Carve-out (Emilio, 2026-09-12) — an actual migration or bulk rewrite of existing stored records still
gets Emilio's eyes before merge.** Autonomous-merge covers guards, go-forward changes, logic, tooling,
and tests — but NOT a schema-version bump or a mass rewrite of saved history. Reason is
*irreversibility, not difficulty*: there is no backup, and a unit test proves the code does what the
test says, not that the test covers your real (messy) `localStorage`. **CLAUDE.md's ask-gate #2**
(announce what changes + to how many records; add a migration test proving an older key survives) is a
separate standing rule that such a req triggers regardless of DEC-035. Everything we shipped in the
2026-09-12 run that was "persisted-data" was a guard or go-forward change (corrupt-v8 guard, backup
validation, UTC date) — none rewrote existing records; those merged fine under DEC-035. The line is:
does this req *rewrite records already on disk*? If yes → Emilio's eyes.

**Counterweight to the lost second perspective — spawn an independent reviewer subagent before
autonomously merging a risky change.** DEC-035 makes planning spec-writer, tester, and merger; the
second set of eyes is restored not by more of planning's own review but by an on-demand **fresh-context
subagent that reviews the diff it did not write** — for anything touching **store / model / storage /
migration** or with wide shared-code blast radius, and for planning's own specs/DECs when subtle. NOT a
standing role (over-engineering for a one-person app) — a subagent call when stakes justify it; skip it
for trivial reqs (test-only, dead-code, docs, nits). It's still an AI review: it catches code-correctness,
not "wrong on your real data" — that's the carve-out's job. The two layers are distinct.

**The reviewer is planning-spawned, not code-CC-spawned (Emilio asked, 2026-09-12).** It gates the
*merge*, which is planning's action, and independence requires it not come from the builder — a reviewer
code CC spawns inherits code CC's framing (the author grading itself). Planning spawns a fresh subagent
that reads the committed diff cold (`git diff main..reqN` + files — read-only, within DEC-005). Code CC
*self-reviewing before it reports* is a welcome build-quality habit but does NOT count as the independent
gate (it's the author). So: code CC may self-check; planning runs the independent review.

**Dry-run owed:** the throwaway-worktree test method above (`git worktree add` a temp dir, symlink
`node_modules`, run `node --test`/`vite build` there) is specced but not yet exercised — prove it with
one dry run before relying on it mid-batch for real app-code, so it doesn't fail at the worst moment.

## DEC-036 — Bottom menu redesign: floating Workout-oval + icon-only circles (solid)

Decided 2026-09-13 (Emilio, from the `/design` mockups). Replaces the req-14/DEC-024
three-text-tab `TabBar`. Form inspired by Apple's "Liquid Glass" (floating capsule
controls) but **solid — no translucency, no shadow** (Emilio trimmed both). Three
controls, left→right **Library · Workout · Settings**:
- **Workout** = wide oval/capsule, **text only, no icon**, `flex:1` so it takes all
  remaining width — the deliberate focus.
- **Library / Settings** = **icon-only circles** (~56px; grid + sliders icons). This
  reverses the prior no-icons stance (req-14) for these two.
- **Selection model A (Emilio):** the **current screen's** control is **ink-filled**
  (`--ui-ink`); the others carry a **faint hairline border** (`--ui-line`, white fill).
  The fill moves with the active tab — reuse `activeTab` (`route.js:113`). (Rejected
  model B: Workout always ink-filled.)
- Same three tab groups/targets as today (Library=`/routines`, Workout=`/`,
  Settings=`/settings`); hidden during the in-workout flow (route starts `workout`).
- **Floating** (inset from the edges), so content clears it via bottom padding +
  `env(safe-area-inset-bottom)` — depends on `viewport-fit=cover` (req-51).
- Extracted into **its own component** in the library (Emilio: "its own component").
Spec: req-52. Rejected en route (the `/design` exploration): icon+label tabs, a
center-Start FAB, a 4-tab IA (Schedule/History top-level), a dark-glass tray, and the
translucent/shadowed glass finishes.

## DEC-035 follow-up (2026-09-13): throwaway-worktree dry-run exercised

DEC-035 left the throwaway-worktree test method "owed" (unexercised). Now proven on
real app-code: req-47 tested in a `git worktree add` branch checkout with symlinked
`node_modules` (lint 0, build ✓, 182 tests); req-48, whose branch was checked out in
the code worktree, tested via a **detached** worktree at the branch SHA
(`git worktree add --detach <sha>`, 182 tests). Both stayed inside DEC-005 (temp trees
are planning's, code checkout untouched). The detached-SHA variant is the move when the
branch is already checked out elsewhere.

## DEC-037 — Build workflow by lane; batches use fresh ephemeral agents (no /clear)

Decided 2026-09-13 (Emilio). Refines the two-agent loop (DEC-009). **The lane is chosen
by whether the DESIGN is settled — not by the req tag, not by "batch vs single".**

- **Settled + mechanical** (functional fixes, or UI whose design is already decided) →
  **autonomous ephemeral build agents**, for BATCH work. Planning spawns a fresh
  general-purpose agent **per req in its own isolated git worktree**; it reads
  `handoff/work/req-N`, builds on branch `req-N` off `main`, runs `./check`, writes
  `reports/req-N.md`, and reports to planning. Planning tests (its own hand), runs the
  independent reviewer for shared code, and closes out. Fresh context per req by
  construction → **no `/clear` ever**. Emilio gets **one consolidated test list at the
  end of the batch** (his after-look; ux-feel merges on planning's testing per DEC-035).
- **Unsettled design/feel** → **Emilio + code CC, live.** Code CC reports to *Emilio*,
  they iterate on screen; the result flows to planning to fold in (the "work happens
  outside the loop" path). This is the hands-on lane Emilio had been losing.
- **Functional single reqs** needing coordination but not taste → the planning-driven
  code-CC loop (DEC-009 as-is), Emilio at the gates.

**Why:** making planning the hub for *every* build cut Emilio out of the work where his
taste is the driver. Ephemeral agents also **free code CC** so Emilio can run a design
req on it in PARALLEL with a mechanical batch. "ux-feel" ≠ "Emilio hands-on" — once the
design is settled the build is mechanical and the test list is the gate.

**No programmatic `/clear` (re-confirmed 2026-09-13, claude-code-guide):** unchanged —
a "/clear" cross-session message arrives as plain text (never executed), hooks/settings/
MCP can't trigger it, no self-clear. The fix is not reusing a session, hence ephemeral
agents. **Ephemeral-agent gotchas:** the fresh worktree has no `node_modules` (symlink
the planning worktree's in the agent's setup); the branch persists in the shared `.git`
after the temp worktree is pruned (closeout finds it); the agent must NOT merge/push —
planning closes out.

## DEC-038 — One in-progress workout (abandon on new); supersedes the multi-draft feature

Decided 2026-09-13 (Emilio, from the req-53 after-look). The app currently keeps
**multiple** unfinished workouts as `draftWorkouts` (`store.jsx:221-261`), resumable from
the Start screen; starting a new workout while one is active saves the current as a draft
("Save draft?", `workout-actions.js:10`). Emilio wants **exactly one in-progress workout**:

- Starting a new workout while one is active **abandons** the current, after a warning
  ("Starting a new workout will abandon the workout in progress"). No draft stacking.
- **Abandon = discard entirely** — no finished-history record (unfinished ≠ real history,
  DESIGN §1). *(Reversible; decided on his behalf.)*
- **Display (supersedes req-53's standalone second hero):** the in-progress workout, while
  started *today*, **replaces** today's Start hero; finishing/abandoning returns today's
  scheduled block. Once it ages to a **prior day** it drops out of the hero and shows as a
  **Continue** row in the main-page recent peek, and as a **Continue + Abandon** row in the
  full History view — never counted as completed history.
- **Legacy stored drafts:** surfaced once in that same UI (Continue/Abandon) so they resolve
  through the normal path, then the mechanism is gone — **non-destructive**, no bulk delete;
  a migration test proves a stored draft is surfaced, not dropped.

Spec: req-55. Persisted-data touch → Emilio's eyes before merge (DEC-035 carve-out) +
independent reviewer (store change). Rejected: keep-drafts-but-surface-them (B), and
one-in-progress-with-no-auto-discard (C).

## DEC-039 — Back's logical parent for the two screens req-49 left to CC's call

Decided 2026-09-13 (CC's call in req-49, recorded on merge). req-49 made every `Back` go to
its logical parent; two parents weren't fixed by the spec table and CC chose, defensibly:

- **`history-set` Back → the workout-exercise screen** (the screen that lists the sets), **not**
  `/history/:id` (the workout detail). A set is opened *from* its exercise screen, so that is its
  true parent, and it matches the set form's existing `cancelTo`. Going two levels up would skip
  the screen you came from.
- **In-workout `Back` (overview/preview/empty-active) → `/` (Today), workout left ACTIVE.** The
  preview route has no in-app link constructing it (Today starts via `startOrContinue`), so its
  launch surface is genuinely ambiguous; Today is the tab landing and the safe single parent.
  Back steps out **without discarding** — the workout stays resumable via Continue; **Abandon is
  the explicit discard** (consistent with DEC-038: unfinished ≠ discarded-by-navigation).

Both reversible. Not in a spec/DEC/rule when built → recorded here per WORKFLOW.

## DEC-040 — Navigate-only controls are links (NavLink), even when they wear the button look

Decided 2026-09-13 (CC's call in req-50, recorded on merge; governed by DEC-016). The req-50
spec bullet had lumped "Cancel-as-dismiss / Add / Done" under *Action → Button*, but DEC-016 says
**navigation without a state change is a link**. Cancel/Skip/row-label links navigate and commit
nothing, so they stayed the `NavLink` primitive — given the **button look** (`ui-btn ui-btn--quiet`
retreat / `ui-btn ui-btn--secondary` in a Row action slot) where they sit beside a real `<Button>`,
so they read as the button they pair with **without** gaining an imperative `go()` handler (which
would be a behaviour change, out of req-50's presentation-only scope). Matches the precedent at
`Routine.jsx:57` (a nav "Edit" already rendered `a.ui-btn--secondary`) and the `a.ui-btn` CSS at
`ui.css:74-87`. The genuine state-changers (Save/Start/Remove/Delete/Add-that-writes) were already
`<Button>` and untouched. Reversible to true `<Button>`s in ~6 one-line edits if the a11y/semantics
call is ever preferred over presentation-only.

## DEC-041 — Pre-merge phone-test gate = local `vite preview` over Tailscale (not a cloud preview deploy)

Decided 2026-09-13 (Emilio; built as the `demo-staging` tooling, recorded as req-63). The way to
test a built branch on the phone **before merging to main** is: `npm run demo` (`vite build && vite
preview --port 4173 --strictPort`, base `/` since `GITHUB_PAGES` is unset) exposed over the tailnet
via `tailscale serve --bg 4173`. `tailscale serve` gives the local app a real **HTTPS** URL, which
unblocks secure-context features (**wake-lock / notifications / add-to-home-screen**) — the L-003
blocker a plain-LAN host had. `serve` (private, tailnet-only), never `funnel` (public). Runbook:
`DEMO.md`. `vite.config.js` gained `allowedHosts: ['.ts.net']` on server + preview.

**Supersedes** the backlog's "per-branch preview deploy (cloud)" tooling item **for Emilio's own
testing**. Caveat: it runs on Emilio's Mac, so the **planning session cannot use it** to browser-test
a branch — planning still tests via `node --test` / a throwaway worktree (DEC-035). Merging touched
`package.json`, so the `main`-push triggers one harmless Pages redeploy of the same site.

## DEC-042 — Navigation wears link treatment + §4 verbs; actions wear Button; no off-vocabulary verbs

Decided 2026-09-13 (Emilio, from the demo — "is *Done* really done?"; built as req-62, rule added to
`rules/DESIGN.md` §4). One vocabulary, two treatments: **navigation** wears the **link** treatment
(chevron `‹` back / `›` forward, reads as a place) and uses only the DESIGN §4 verbs; **actions**
wear the **Button** and use only §4 verbs. No off-vocabulary verb, no navigation dressed as a button.
Applied in req-62: (1) `Back` became the `NavLink` primitive (`‹ Back`, a real `<a href>`) everywhere,
completing the "fold Back into the component treatment" req-50 deferred — same req-49 targets, no
behaviour change; (2) removed "**Done**" from RoutineDetail/ScheduleDay — off-vocabulary, read like it
commits, and made 100% redundant by req-49 (Back now goes to that same list); (3) "**Correct**" →
"**Edit**" (link + the `history/edit.jsx` screen title) — a workout detail is an object detail, which
§4 says owns *Edit*. Deferred (Emilio's optional, not done): "Create exercise"→"New exercise", the
"Already added" status-link. Presentation/label only; no route or data change.

## DEC-043 — Root workflow docs stay the code session's; START-HERE is cold-start-only, workflow single-sourced in handoff/

> **SUPERSEDED by DEC-044** — START-HERE.md was removed entirely; boot prompts moved to README.

Decided 2026-09-13 (Emilio). Trigger: a "Cowork → Claude Code" terminology fix for
`README.md` + `START-HERE.md`. Planning first handed it back as "the code session's",
stating an ownership nothing actually documents, then over-corrected by committing the
root-doc edits on the planning branch. Both were wrong-shaped. The decision:

- **Do NOT relax the `plan save` guard / the "planning writes only `handoff/`" rule.** The
  guard is not arbitrary: it gives the two worktrees **zero shared write surface**, which is
  what makes `plan publish`'s planning→main merge conflict-free and automatic. A carve-out
  for "workflow docs" reintroduces exactly that merge-conflict class (and `README.md` is the
  product contract — code/Emilio territory, edited during builds). Line-level ownership
  inside one file is unenforceable by git anyway.
- **Root docs (`README.md`, `START-HERE.md`) are the code session's / Emilio's to edit.**
  Planning specs the change as a req; the code session commits it. (The reverted attempt was
  `97c637b`, undone by `ce80df3` — net-zero.)
- **The real drift was duplication, not ownership.** `START-HERE.md` restated the loop +
  stages that already live in `handoff/PLANNING.md`/`WORKFLOW.md`; a fact in two files is the
  drift engine (the "Cowork" rot and the stale `~/projects/workout/` path were symptoms). Fix:
  **single-source the workflow in `handoff/`** and shrink `START-HERE.md` to cold-start-only
  (boot prompts + a pointer). Spec'd as **req-64**.
- **Behaviour lesson:** don't state an inferred ownership/rule as fact, and when a rule blocks
  a user-asked change, surface the drift and do the low-risk part — don't invent an owner.

## DEC-044 — Planning boots by reading handoff/PLANNING.md directly; START-HERE.md removed (prompts move to README)

Decided 2026-09-13 (Emilio). **Supersedes DEC-043's "shrink START-HERE to cold-start-only":**
on review Emilio asked whether the file was needed at all — it isn't. The root `CLAUDE.md`
auto-loads every turn and its banner already self-routes each worktree (planning →
`handoff/PLANNING.md`, build → the CLAUDE.md guide), so a cold-started session loads its
context without START-HERE — proven live (the planning session that decided this got no boot
prompt and read `PLANNING.md` first, via that banner). README is the conventional entry; a
second `START-HERE` doc was a competing front door holding prompts `CLAUDE.md` had made
optional — the residue of the duplication DEC-043 targets. So: **delete `START-HERE.md`, move
the two boot prompts into README's Setup**; the planning prompt reads `handoff/PLANNING.md`
(symmetric with build → `CLAUDE.md`). Load-bearing piece kept untouched: the `CLAUDE.md`
banner. Spec: req-64 (re-scoped trim → delete). Reversible (restore the file) if ever wanted.

## DEC-045 — every req reaches main via `--no-ff`; a pre-push guard enforces it (approach A, not B)  (2026-09-14)

req-66. The closeout/status machinery reads a `Merge branch 'req-N'` commit's two parents to compute a
req's status line; a fast-forward merge leaves no merge commit, and the range is **unrecoverable from refs**
afterward — after a pure FF the branch tip *becomes* the merge-base, so `merge-base main <branch>..<branch>`
is empty (measured against the real FF'd req-49, `41ab51c`). So the spec's proposed **B (tolerate — recompute
the range from the branch)** cannot work: it would have to invent a range, against the project's core rule
(never invent data you don't have). Chose **A (guard):** a new `.githooks/pre-push` that refuses a push
landing a `req-*` branch tip on main's **first-parent spine** (the topological signature of a FF); a
`--no-ff` merge puts the tip on the merge's 2nd parent, off-spine, allowed. Does **not** block the legit
paths — `plan closeout` (`--no-ff`, branch still present at push), `plan publish` (doc-commit FF, never a
`req-*` tip), or non-main pushes. Escape hatch `WORKOUT_ALLOW_FF=1`, never silent. Touches nothing in the
`plan` script. Verified independently by Planner in a scratch repo (bare origin + clone wired to the real
hook): FF refused with the fix printed; `--no-ff` push allowed and lands a real `Merge branch` commit;
override + doc-FF + non-main-push all allowed. Known limit (accepted): the guard matches on the local
`req-*` branch still existing — FF-and-delete-before-push leaves no ref, but by then the range is already
lost, which is the thing A refuses earlier to prevent.

## DEC-046 — back up before touching stored data; Planner prompts the export  (Emilio delegated, 2026-09-14)

Ratifies the req-73 "unconfirmed" backup rule (Emilio: "do what you think is best"). The store
(`localStorage['workout-mvp-v8']`) is the user's real, irreplaceable history — no server, no automatic
backup, no undo. The workflow already gates a real migration/bulk-rewrite on Emilio's eyes (DEC-035
carve-out) and CLAUDE.md ask-gate #2, but nothing prompted the one cheap safety net the app already has:
**Export**. So: **before merging any persisted-data / migration req, Planner reminds Emilio to export a
fresh backup first** (Settings → Export → `workout-mvp-backup` JSON, DEC-004/req-01), and periodically
otherwise. It's a reminder, not an automated backup (browser-only, no infra to schedule one) — the point
is that the process names the safety net at the exact moment risk is highest. Reversible: supersede this
DEC to change the cadence or drop it. Home for the operational rule: PLANNING.md (Planner's reminders).

## DEC-047 — batch mode: an opt-in exception to one-req-at-a-time + human-gate testing  (Emilio, 2026-09-16)

The **default workflow is unchanged and stays the norm**: one req at a time, human-gate testing per req
(DEC-035). Emilio was explicit — "i dont wanna loosen up all rules." **Batch mode** is a distinct, opt-in
exception, entered **only** by Emilio's explicit approval **with planning up front** (which reqs, what
order) before a single one starts. Inside an approved batch: **(1) serial-but-continuous** — one req/branch
at a time (DEC-035 still: Builder builds, Planner merges), but Planner does **not** stop between them
(build → `./check` → merge → dispatch the next), with **one summary at the batch end**, not per-req; **(2)
relaxed per-req testing** — this app is not production and Emilio is the only user, so Planner merges on
`./check` green **without** holding for Emilio to feel each `ux-feel` req; he trains with the app and
iterates **after** the batch (extends DEC-035's "feels the untestable parts after" from per-req to
per-batch); **(3) sessions are not cleared during a batch** — Builder's and Planner's both stay alive for
continuity, because Emilio is intentionally out of the loop and context must carry across the reqs. **The
behaviour-decision gate still applies** even in a batch — a gated req still needs Emilio's call, resolved
during the pre-batch planning; only *testing* is relaxed, never *decisions*. Reversible. Home for the
operational rule: WORKFLOW.md §"Batch mode".

**Refinement (2026-09-16, session retro):** "relaxed testing" defers *feel*, not *visibility*. Whether a
UI control **renders / is on-screen / is not occluded** is objective and must be confirmed before merge —
never deferred like feel. req-88 shipped an invisible feedback button precisely because batch mode let
visibility ride as feel. See WORKFLOW.md §"Batch mode".

## DEC-048 — rest is informational, not a control surface; the next set is always live during rest  (Emilio, 2026-09-16)

Ratifies the consequences of req-78's D1/D2 (rest-pill rework). Rest is now a small floating pill that
shows the remaining time and skips on tap — nothing else. Two controls the old blocking `RestBar` carried
are **intentionally gone**: **Pause / +30s** (self-pacing removes their purpose — you can log the next set
whenever, so extending/pausing a countdown that no longer blocks is moot) and the **req-27 progression
↑/↓ marker** (it lived on the deleted `RestUpcoming` panel; the next set's own weight field now shows the
load). Emilio, shown both removals, judged them **"nice to have"** — acceptable to lose now, worth a
possible add-back later (captured as deferred backlog items, not scheduled). So the governing rule going
forward: **rest does not block input and is not a control surface; the next set's form is the live surface
during rest.** Reversible — a future req can re-add +30s or re-surface the marker without contradicting
this (the DEC is about rest not *blocking*, not about forbidding an optional timer nudge). Home for the
operational behaviour: the code (`rest.jsx` RestPill, `item.jsx` form-during-rest) + req-78 in SHIPPED.

## DEC-049 — Today's completed-today + recent are one list with per-row state, no section header  (Emilio, 2026-09-17)

req-94. Two adjacent `<List>`s (each with its own rule + margin) stacked a divider-under+divider-over into
a white seam at the completed↔recent boundary. Merged into one `<List>`; "today vs prior" is carried by
row color (near-black `.ui-workout-info--today` vs gray), not by a `SectionHeader`. The "Completed today"
header was **dropped**: a header over a list whose lower rows are prior-day fights "states in the list"
(Emilio's own framing of the note). Completed-today sessions still render as rows (first, near-black); the
recent list still excludes them by id, so nothing shows twice. Emilio confirmed headerless (2026-09-17),
having asked and been shown the completed row is preserved. Reversible: a lightweight single heading over
the whole merged list is a one-line add if it ever reads as contextless.

## DEC-050 — "you beat last time" is per-exercise, any-axis; fire on any win, don't suppress on a regression  (Emilio, 2026-09-17)

req-96. The Finish-screen celebration decides "better" by comparing each exercise to the SAME exercise
(by id) in the previous same-routine finished workout, on that exercise's natural axis: weighted →
heavier top set, or same weight + more reps; bodyweight → more reps; timed → longer durationSec (best
work set each side, warm-ups excluded). The line fires if ANY exercise improved, and a regression on
another exercise does NOT suppress it (a normal gym day still earns its line). **Total volume alone was
rejected** (Emilio: "longer? more reps? higher weight?") — it's blind to a longer hold and to
bodyweight/timed work, and hides a per-exercise win inside an aggregate. No-invent holds: no prior /
no matched improvement / newly-added exercise → silent, never a "you did worse". History detail gets
NO win line — it's a past record, not a forward celebration. req-84's total-volume "vs last time" on the
auto-complete screen is a separate surface and stays. Reversible: the axes/thresholds live in one pure
module (`src/beat-last-time.js`).

## DEC-051 — routes may carry a `?from=<encoded-path>` return target; the router splits the query before path parsing  (req-99, 2026-09-18)

req-99 needed "edit the exercise from a routine, then land back in that routine". The router
(`src/route.js`) was pure path-segments — no query support. Rather than thread a return path through
component props across the nav stack, Builder added a minimal query mechanism: `parseRoute` now splits
`path` on `?` first, path parsing sees no `?`, and **only routes that opt in** read a param out of the
query (today just `exercise-edit` reads `from`). Link built with `encodeURIComponent`; the value is a
hash-body path that travels through `hashPath`/`go` untouched; missing/malformed `from` degrades to the
normal behaviour. **This is the sanctioned pattern for a return-to target — reuse it, don't reinvent
per-flow prop threading.** Keep params opt-in per route (never a blanket query bag), keep the value an
encoded internal path (not arbitrary state), and keep the fallback lossless. Scope-limited: it's a
return-nav affordance, not a general query-string state store.

## DEC-052 — a mid-workout weight change carries to the remaining sets; a reps change does not  (Emilio, 2026-09-23)

Narrows req-83 (option (c), 2026-09-16), which carried a changed weight **and** reps to the rest of that
exercise's sets this session. Emilio, from real use (push-ups, 2026-09-18): *"set 1 change also changes set
2 — should not be that way — each set is separate from each other."* Reps targets are per set, so a reps
carry overrode the plan; a weight change is usually meant for the rest. **Rejected:** removing the carry
entirely (loses the warm-up 4→5 kg case req-83 was for); keeping both (the reported bug). A stale stored
reps override is ignored, not migrated. The req-02 / DEC-002 no-history carry is a separate rule and
unchanged. Built as req-108.

**DEC-052 amendment (Emilio, 2026-09-23, after the batch-4 external review):** the reps carry stops on
**no-history** exercises too. DEC-002's carry (from the last working set logged this session, when the
exercise has no finished history) keeps the **kg**, and reps come from the set's target, or empty. The review
showed (`setLogSeed({hasHistory:false, carry:{reps:'12'}, target:'15'})` → reps `"12"`) that keeping DEC-002
whole would reproduce the push-ups complaint on every new exercise. DEC-002's kg half stands.

## DEC-053 — "last time" skips a workout where that exercise was entirely skipped  (Emilio, 2026-09-23)

A workout in which every set of an exercise is skipped holds no load or reps data for that exercise, so it
is not "last time" for it. History prefill (`lastSetsForExercise` and its consumers) and the "you beat last
time" comparison look past it to the most recent workout where the exercise was actually done, or treat the
exercise as having no history if there is none. Found by the batch-4 review: a skipped exercise came back
with no kg next session, and beat-last-time reported a false "heavier" win against the skipped record's 0 kg.
Skip/swap (req-109) would have made this the normal case. Not inventing data: skipped records are
excluded, never reinterpreted. Built as req-111, before req-109.

## DEC-054 — batches go to the Builder session, not ephemeral agents  (Emilio, 2026-09-23)

> **SUPERSEDED by DEC-055** (same day) — batches go to throwaway agents again.

Supersedes DEC-037's "batches use fresh ephemeral agents". Planner spawned a subagent to build req-103 in
batch 4; Emilio: *"usually you send you the builder - not an external bot?"* The practice since DEC-047 (batch
mode keeps Builder's session alive) is: Planner pings the **Builder session** (`SendMessage`) one req at a
time, merges, pings the next. The discarded subagent attempt left no commits. Ephemeral subagents stay fine
for **read-only** work (independent spec/diff reviews).

## DEC-055 — batches go to throwaway agents; the Builder session is for live and single work  (Emilio, 2026-09-23)

Supersedes DEC-054 (same day) and restores DEC-037's lanes, now with the reason stated. Emilio: *"would it
be better to send batches to throwaway agents? that way context would not build if i am not available to
clear"*. A batch of N reqs through one Builder session fills its context (compaction by the end, with the
riskiest req last). A fresh agent per req needs no `/clear`. Lanes:
- **Batch** (Emilio away, design settled) → one throwaway build agent per req, in its own worktree; it
  reports to Planner, who merges and dispatches the next.
- **Live design / feel work** → Emilio + the Builder session, iterating on screen.
- **A single req Emilio wants to watch or gate**, and quick fixes while he's at the keyboard → the Builder
  session (Planner pings it; Emilio `/clear`s between reqs).
Cost accepted: batch builds aren't visible in the Builder terminal; Planner relays the results. Batch 4:
req-103 stays with the Builder (already started), and req-104 onward goes to throwaway agents.

**DEC-053 clarification (req-111 review loop-back, 2026-09-23):** "actually done" means a non-skipped
**working** set. A workout where only the warm-up was done and every work set was skipped (warm up, then
the machine is taken) is passed over. A warm-up-only workout counts only when the exercise has never had
a done work set, so it can still seed the warm-up.

## DEC-056 — the routine is never updated automatically at Finish; updating it is a deliberate choice  (Emilio, 2026-09-23)

Emilio: *"maybe we should not auto update? update should maybe be a clean choice? something to do after you
finish a loop?"* Until now `finishWorkout` wrote next kg/reps onto the routine every time
(`applyProgressionToRoutines`, `store.jsx`), which already sat badly with DESIGN §2's "nothing silently rewrites the
plan". The investigation that prompted this found the write was also wrong on skipped sets: `recommendNextPrescription`
(`progress.js:67`) matched each logged set to a target by its position among the logged sets only, so skipping set 1
compared set 2 to set 1's target and could lower the weight (35×8 on target 8 → `[32.5]`), and a skipped set wiped its
own saved weight (`[30,35]` → `[30]`). **Decided:** Finish stops writing the routine. The in-gym flow doesn't need it:
prefill comes from history (DESIGN §1). The routine keeps what you set, which is what README's "prescription … next
time's source of truth" means. The explicit post-correction recalc (preview, then Apply/Skip, `recalc.jsx`) stays. It is
already a choice, and its maths is fixed to be per-set (req-112). **Later (Phase 2):** a deliberate "review and update
the routine" step, e.g. at the end of a schedule loop. Its shape is still open. **Also:** Skip exercise leaves an
already-running rest going; it never starts one (Emilio: "keep").

**DEC-056 correction (independent retro, 2026-09-23):** DEC-056 calls the post-correction recalc a "preview,
then Apply/Skip". The "Update?" screen (`recalc.jsx`) shows **no numbers**. It is a choice, but a blind one.
Showing the numbers belongs to the Phase 2 review step (BACKLOG). Also: where a skipped set sits before a
logged one and the routine has no weight there, recalc records `0`, and the routine editor would show
`0/40 kg`. Emilio (2026-09-23): show `—` for it, never a number → req-113.

## DEC-057 — safety checks follow the files; a question isn't a decision; unconfirmed calls are marked  (Emilio, 2026-09-23)

From an independent retro of the batch-4 session, whose findings Emilio accepted ("yes"):
1. **Reviewer and backup triggers come from the files a req touches** (store, model, storage, progress,
   workout-log, migration/load), not from its Gate tag. The independent reviewer (DEC-035) and the backup
   reminder (DEC-046) both come **before** merge. req-111 and req-112 were tagged `[functional]` and got
   neither.
2. **A question from Emilio is not a DEC** until he confirms. DEC-054 was recorded from a question and
   reversed by the next question (DEC-055) within two minutes.
3. **Calls made on his behalf that a user would see are marked `(unconfirmed)`** and go on his end-of-batch
   list, and so does a builder's "Possible DEC". Batch 4's list was confirmed in one go ("lets go with your
   calls"): req-109's skipped rule, role and rest, labels, no-remove, picker not hiding the original;
   req-110's two primary Starts; req-112 skipped-keeps-routine-value; `—` not `0` (req-113).
4. **SHIPPED's gate line quotes `./check`'s output** and names the reviewer.
The retro also showed that "make spec review standard" is already in DEC-035 (it didn't fire), and that the
closeout ledger is mostly automated already (req-90). Neither needed a new rule. Rules in WORKFLOW.md §READY
checks 5–6 and PLANNING.md.

## DEC-058 — flow-audit calls: comma is a decimal point; "current" = started within 6 h; hero keeps the day's other routines; an empty Finish warns  (Emilio, 2026-09-23)

From the 2026-09-23 flow audit (BACKLOG §Flow audit), each answered and confirmed back:
1. **"22,5" means 22.5.** In weight fields the comma is a decimal point, and `/` is the only separator between
   sets. Emilio chose (a) over rejecting the comma. The Swedish keypad may only offer a comma.
2. **An in-progress workout counts as current if it was started today OR within the last 6 hours.** A workout
   started at 23:50 stays the Today hero at 00:05. Narrows DEC-038's "prior day = stale" (Emilio: "do it").
3. **On a day with two or more routines, the hero shows the one in progress and the others stay visible**
   under the same date with their own Start/Done. This closes the gap between DEC-038 and req-110.
4. **Finishing with nothing logged warns and offers Abandon** instead of silently saving a workout of skipped
   sets. The auto-complete path never auto-finishes an empty workout.
Built as req-114..120 (BACKLOG §Flow audit Tier 1).

**DEC-058 additions (Emilio, 2026-09-23, after the Tier 1 spec review):**
5. **Amends DEC-031:** "referenced" now also includes the **in-progress workout** (its snapshot items and sets).
   Deleting an exercise or routine it uses **archives** it, like finished-history references, and the confirm
   says it's in the current workout. Emilio chose archive over blocking the delete.
6. **In Reps and Duration, `,` separates sets** like `/`: they're whole numbers, so `8,8,8` means three sets.
   **Only Kg** treats `,` as a decimal point.
7. **Kg with fewer values than Sets repeats the last value** (`40` for 3 sets → 40/40/40), as Reps already does.

## DEC-059 — flow-audit Tier 3 calls  (Emilio, 2026-09-23)

1. **A replacement exercise keeps starting with 1 blank set** (DEC req-109 "blank state" stands); Replace now
   lands on the new exercise.
2. **Weight step is entered as a number ("Increment (kg)", comma or dot) plus an "Alternating (4/5)" option**, and
   catalog imports leave it empty instead of inventing 5 or 2. The stored field keeps its string form (`"2.5"`,
   `"Alt 4/5"`, `"n/a"`), so no migration.
3. **Re-adding an archived exercise offers Restore**, which brings back the same exercise with its history, instead
   of creating a duplicate.
4. **A duplicate exercise name warns but allows** ("An exercise called Bench already exists": use it, or create
   anyway).

## DEC-060 — our own exercise library, pictures on tap first, our own styled images later  (Emilio, 2026-09-24)

1. **Pulled forward from Phase 3:** "knowing how to do an exercise" is core, not later. First, a **button** shows the
   pictures we already have (RepDB drawing / free-db photos auto-flipping / a video link the user pastes), on the log
   screen and the exercise page — **never shown all the time** ("they are not really made for in-app showcase").
   Then our **own styled images**, which *can* show all the time because they'll fit the app. Its own req.
2. **Our own copy of free-exercise-db** (Unlicense), extended with our alternative names, muscle groups and better
   text; links to both free-db and RepDB pictures saved per entry.
3. **RepDB is read for structure, never copied** (Emilio: "never a straight up copy"). Planning's line, accepted
   ("sounds good"): our text is written from free-db's public-domain instructions + general knowledge, not by
   paraphrasing RepDB entry by entry (licence term 3: no derived dataset); RepDB images are **not** a reference for
   our own images, since the author is a generative model (term 5) — free-db photos are the reference.
4. **Existing exercises are matched, not user-matched:** Emilio rejected a mandatory "find photo" step. A fixed
   alias list + saved `libraryId` on new adds; an optional "Link to library" for manually added ones.
5. **Manual add suggests the library entry while typing** (one Add screen) so unlinked duplicates stop at source.
Rejected: pixelating the photos (tested — the gym background swamps the figure); fuzzy auto-match (wrong picture).
Built as req-130..133 (BACKLOG §Exercise library).

## DEC-061 — the exercise library file is generated, never hand-edited  (planning, from Builder's req-130 flag, 2026-09-24)

`src/library/exercises.json` is built by `scripts/build-library.mjs` from the sha-pinned free-db source plus our tables in
`src/exerciseLibrary.js` (aliases, groups, own entries); a drift test fails on hand edits. Content work (req-133) edits the
tables and re-runs the script. Library ids are permanent once stored (`libraryId`, req-130 §2). Implementation rule, no user
effect.

## DEC-062 — the library's structure: a three-level muscle tree, one movement pattern, fixed lists, "common" first  (Emilio, 2026-09-24)

1. **Muscles are a tree: group → muscle → part** (Arms → Biceps; Shoulders → Deltoids → Rear delt). Each level has
   everyday and anatomical search names ("arm", "delts", "deltoid", "six pack"). Entries are tagged at the finest
   level (primary/secondary); parents are derived. Choosing a level includes everything under it. Emilio: useful for
   beginners who search "arm" and for advanced users who pick "deltoid". Two levels where a third adds nothing.
2. **Fixed lists** for movement pattern (one per entry), equipment (several), and how it's logged (`logAs` +
   one-sided); a test rejects anything off-list. Full lists: req-133.
3. **Quality before breadth:** the ~150 common gym exercises get every field first, flagged `common` (search ranks
   them first later); the rest stay as they are.
4. **Planning/agents may fill in the obvious, rewrite text and add widely used aliases** (Emilio: "fill in info that
   is obvious to you, improve text if needed, add aliases that you know are used a lot"). Text is ours, never RepDB's
   (DEC-060 §3).
5. **Muscle filter default (later req-134):** several groups = **either** (union), with a "must hit all" toggle.
Rejected: keeping the 17 free-db muscles (too coarse for alternatives/programs); tagging all 879 now (cost, and
rough tags on obscure entries are worse than none). Built as req-133.

## DEC-063 — clean start: the library is built for the app, not around Emilio's data  (Emilio, 2026-09-24)

1. **Don't skew decisions on Emilio's own exercises** ("the app in its whole is the main priority and a clean and good
   database is also important"). req-130's verbatim seed aliases are re-judged on merit in req-133; tests that pinned
   them are replaced, with reasons.
2. **His backup is converted later, by a one-off script**: match his exercises to library entries, show him the full
   mapping, write only after his OK — its own req under CLAUDE.md ask-gate #2.
3. **A user exercise = a library link + only what the user changed** (no copied cues/muscles/equipment that go stale);
   edits win, untouched fields follow the library. Designed in the Add-screen req (req-132). [measured: today
   `catalogItemToExercise`, `exerciseCatalog.js:124`, copies them.]
4. **Order** (planning's recommendation, accepted "ok"): req-133 content → req-134 browse + muscle filter (doubles as
   the review tool) → req-136 "something's wrong" tap into the feedback JSON → req-132 Add screen (+§3) → req-137
   offline library/images → req-131 "How to" → req-135 alternatives → own images, **pattern-based** (one base
   animation per movement pattern + equipment variants), with a 5-exercise style pilot in parallel from req-134.

## DEC-064 — library polish after the critical comparison  (Emilio, 2026-09-24)

From planning's critical comparison of our library vs free-db and RepDB, Emilio's answers:
1. **Our own display names** for the common entries; copying the cleanest standard name is fine ("repdb does not own
   naming of exercises"). Chosen per entry, not a bulk import of RepDB's name list. free-db's `name` stays underneath.
2. **Search uses only our library** — RepDB leaves search; used only for pictures later (req-131). Missing staples are
   added as our own entries instead.
3. **Common exercises first**, the rest on request ("Show more").
4. **Text pass (req-138) moves earlier**: right after req-139, before the browse screen.
5. **Own images:** made with free-db, RepDB and web searches as inspiration — discussed in that req. Planning's flag
   stands for that discussion: RepDB's licence term 5 bans its images as reference for generative models (DEC-060 §3).
6. **free-db's `level` and `category` are dropped from use** (kept in the file only as provenance); re-add when missing.
7. **Real-use corrections** come via the browse screen (req-134) and the "something's wrong" tap (req-136).
New order: 139 → 138 → 134 → 136 → 132 → 137 → 131 → 135 → own images. Built as req-139.

## DEC-065 — RepDB for pictures only; our library covers everything it does, better; a RepDB-blind audit  (Emilio, 2026-09-24)

1. **RepDB is kept only for its pictures** (req-131's "How to", with the Settings credit). Nothing else is taken from it.
   "Our database has to have everything it has but better" → req-140 closes the coverage gap with our own entries.
2. **Fields matched:** our own `difficulty` (beginner/intermediate/advanced) **yes**; training goals **no** (they say
   little); German/Spanish **no** (English only; Swedish would come first if ever).
3. **Originality gate relaxed:** only long word-for-word runs (≥12 tokens) count. The 4-gram-share gate is dropped,
   because it pushed normal gym English away from its natural wording (19 entries in req-138). Emilio: "I am a bit afraid
   that we might have made choices based only on not being similar to repdb."
4. **req-141: a fresh-eyes audit** of names, aliases, tags, text and the common list by an agent given nothing about
   RepDB, including restoring natural wording in the entries rewritten for originality.
Supersedes DEC-060 §3's measurement (not its principle: never copy RepDB's text or use its images as reference).

## DEC-066 — "fully written" and "staple" are two flags; parity comes in batches of ≤40  (Emilio, 2026-09-24)

1. **`common`** = fully written by us (tags, text, difficulty); **`staple`** = a standard gym exercise that ranks in
   Search's first tier. The 178 current common entries are staples. New fully written niche entries (Spoto Press, Couch
   Stretch…) sit behind "Show more". Emilio chose "staples first, rest behind" over "all our entries first".
2. **Parity comes in batches of ≤40** promote+add, each with its own gap checkpoint and coach QA. Emilio chose this over
   "all in one go".
3. **Promote before add:** a non-common free-db entry that is the movement becomes common, keeping its id. No `own-*`
   duplicates. Aliases only for names people actually type, never a bulk copy of RepDB's names. The full gap table
   never enters git (RepDB licence term 3).
Built as req-140 (batch 1).

## DEC-067 — library content calls are delegated; beginner-first, room for advanced  (2026-09-24)

Emilio, relayed by Builder from its terminal (not heard directly by planning): "you can decide, its hard for me to have
an opinion on these things as i am not a coach or a gym buff - i am an amature trying to create an app for other
amatures/beginners - but with the support for more advanced users as well - ill have to trust your judgement - but then
iterate over with when there are actual users". Planning's own recommendation matched, and planning adopts the calls on
its own authority, marked **(unconfirmed)** for Emilio's list:
1. **Variants:** when free-db has a movement only in a loaded version (barbell/kettlebell/Smith), our bodyweight or
   dumbbell version is an **add**, not a promote (equipment is part of an exercise's identity, e.g. Bodyweight_Squat vs
   Barbell_Squat). Promote-before-add holds for the same movement with the same equipment.
2. **Outdoor Run / Outdoor Walk are staples** — what beginners log most.
3. **Yoga/pilates poses and flows are skipped for now;** ordinary stretches stay queued.
4. The difficulty anchors stay as pinned in req-140.
**Standing rule:** exercise-content calls (tags, staples, names, text, difficulty) are the planning/build sessions' to
make, through the lens **beginner-first, with room for advanced**, and are revisited with real users. Behaviour and UX
calls stay Emilio's.

## DEC-068 — no auto-memory for either session; third-party data in a gitignored repo dir  (Emilio, 2026-09-24)

1. Emilio, to Builder mid-build: "dont save anything in memory - EVERYTHING should be in the repo - nothing outside of
   it - if you need to save anything - give it to planner". Builder deleted its one memory note (its content is DEC-067).
   CLAUDE.md §"No auto-memory" updated to match PLANNING.md's rule (2026-09-12). Anything durable goes to planning, which
   records it in `handoff/`.
2. **Carve-out (planning's call, unconfirmed):** licensed third-party data that must stay out of git history (RepDB's
   cached JSON, the full gap table with RepDB's names: DEC-066 §3, licence term 3) lives in the repo folder under a
   **gitignored** `.vendor-cache/`, not in a session scratchpad. That keeps it in the repo folder, persistent across
   sessions, and never committed.
3. **The parity queue** (the promote/add candidates left after batch 1) is **ours**: free-db ids + our own names. It is
   committed in `handoff/work/req-140-parity-queue.md`, so later batches don't depend on a scratchpad.

## DEC-069 — aim: RepDB removed completely  (Emilio, 2026-09-24)

1. **RepDB goes entirely** once req-140 lands. The parity queue is already ours (`work/req-140-parity-queue.md`), so later
   batches don't need it. req-131 "How to" drops RepDB pictures and uses free-db photos + the video link until our own
   images exist. Built as **req-142**: remove the Settings credit, the RepDB comments, `scripts/library-gap.mjs`, the
   originality script's RepDB comparison, and `.vendor-cache/`. The never-copy principle (DEC-060 §3) stays as history.
2. **For the image/avatar req:** Emilio wants to look at RepDB's images for inspiration when that work starts. Planning's
   licence note stays attached to it: **Emilio may browse them himself; they are never given to the pixel-art agent as
   input, reference or conditioning** (RepDB licence term 5), and nothing is traced from them.
Supersedes DEC-065 §1 ("kept only for its pictures").

## DEC-070 — library order: triage → finish batches → remove RepDB when up to par → fresh scan  (Emilio, 2026-09-24)

1. **RepDB removal is its own req (req-142), and only once our database is up to par.** "Up to par" means: every RepDB
   exercise is either covered by a written entry of ours or deliberately skipped, and no rough entry is shown.
2. **Before that:** req-143 triages the 697 rough entries (finish / merge / hide), then parity batches (req-140b…, ≤40
   each) finish the queue.
3. **After removal:** req-141, a fresh agent scans **all** our exercises (naming, text, aliases…), knowing nothing of
   RepDB. (This reorders DEC-065 §4: the scan now comes after removal.)
4. **Images/animations are a completely separate req** (the avatar work).
Planning's call: "ship only our schema" moves to req-132, where the readers switch to our fields.

## DEC-071 — design for the complete beginner first; the simple routine is the core  (Emilio, 2026-09-24)

"lets build from the perspective of a fresh beginner - me - and start there - priority one is to make the app as
accessible as possible for someone completely new/first time at the gym - to start using the app and start to get into a
routine - the advanced options we keep in mind - but we dont design for right now - when the easy flow is in - we can start
adding complexity - but with the rule of not disturbing the simple routine - that is the core that you build upon."
1. **Persona #1 = the first-time gym-goer** (Emilio as the stand-in). req-144 designs this flow only.
2. **Advanced options are kept in mind, not designed now.** The model must not rule them out (planning checks
   extensibility), but no advanced UI is designed yet.
3. **The rule for everything added later:** it must not disturb the simple routine. The beginner flow is the core that
   everything else builds on.
Answers req-144 Q1 (persona) and the core of Q2 (the rule's wording is refined in session).

## DEC-072 — library merge rule; merged names redirect in search  (planning, from req-143's coach review, 2026-09-24)

1. **A merge never crosses how an exercise is loaded:** same `logAs` family (bodyweight vs weighted) and equipment that
   maps into the target's `equipmentList` (an EZ bar counts as a barbell). One-arm **dumbbell** variants may merge into
   bilateral targets (same load per hand); one-arm **cable/stack** moves don't (the load scale differs). Enforced by
   `triageProblems` where the data shows it; the one-arm cable case is judged in the rows.
2. **Exact merged name → its target:** typing a merged entry's exact name shows the written target, scored 0.5 (after
   direct exact hits, before prefix hits, so "air bike" keeps Fan Bike first). No aliases are added for it.
3. Warm-up drills (arm/shoulder/hip circles) aren't logged → hidden. Band variants are their own exercises (home
   trainees). Content calls under DEC-067, unconfirmed.

## DEC-073 — toward a real product: other users soon, and training together  (Emilio, 2026-09-24)

Emilio's reason for a server and multiple users: "to get closer to a real product and to allow other users to enter
soon, i also want users to be able to collaborate and to workout together, as i often do with my coworkers - so we all
can have the same routine, but have our own values saved in them, and when one of us start an exercise, its start for all
of us". This opens the **backend fork** (BACKLOG Phase 3) as a design req, **req-146** (no code), deciding: hosting (his own
computer vs a managed service), accounts, the data model with sharing (a shared routine, each user's own values), live
group workouts, moving existing phone data over, offline use in the gym, and privacy (real users' health data, GDPR).
The creation design (req-144) waits until Emilio starts it. Library batches continue (req-145).

## DEC-074 — standing test sanctions for library batches  (planning, from Builder's req-145 note, 2026-09-24)

For every library batch under req-140's rules (req-145 onward), these test edits are sanctioned without listing them in
the spec. Each is still called out in the report:
1. count pins (common, unilateral, staples, OWN_EXERCISES, COMMON_COUNT_RANGE, triage class and Show-more counts);
2. a fixture or receipt that names an entry the batch has now written moves to an equivalent unwritten one, keeping its
   intent;
3. new staples may enter the press/row/machine top-10 lists, as long as the prior relative order is unchanged;
4. a test asserting "no common entry in rest" may check `staple` instead of `common` (the req-139 shoulder-press case).
Anything else still needs an explicit sanction.

**DEC-074 addition (planning, 2026-09-24, from req-147):** 5. the req-140 "every prior common entry is a staple" test
gains each batch's non-staples in its exclusion list; 6. when no real row remains for a pending-target check, a fixture
row may stand in (same intent).

## DEC-075 — progression rules get their own req; until then the app only avoids wrong answers  (Emilio, 2026-09-24)

1. "i dont want the app to change anything yet - i want a separate req where we set the rules and the code for how the
   app should upgrade the routines - for now - do not touch them - but if there is an issue fix it." → **req-149
   progression rules** (a design req, later), where the rules for ranges, AMRAP, assisted, and how routines get upgraded
   are set. **req-150** fixes the three known-wrong cases by **holding** (no change), adding no new rule.
2. **Server:** it runs on a computer Emilio uses as a server (details when req-146 starts). req-146 (backend) and req-144
   (creation design) **wait**; current follow-ups are finished first.

## DEC-076 — what "a plain number" means for the progression hold  (planning, from req-150, 2026-09-24; unconfirmed)

Holding never gives a wrong answer, so the conservative reading stands: only a whole number (`"10"`, `" 10 "`, `10`)
is judged. Ranges (incl. "8–12", which main misread as 812), AMRAP, durations, "10 reps", "12+" and "10.0" **hold**.
Blank or missing targets are judged as before. In mixed items each set is judged on its own. "Assisted" = the 3 library
ids or /assisted/i in the name (interim; req-149 brings a real flag). **Known gap:** the hold reason is saved on the
workout but no screen shows it since req-96; surfacing it belongs to req-149.

## DEC-077 — library content calls from the fresh-eyes scan  (planning under DEC-067, 2026-09-24; unconfirmed)

1. **Overhead presses:** front-delt primary + side-delt secondary, consistently (landmine press: + upper chest instead).
2. **High rows** are vertical pulls. Kettlebell sumo high pull stays `olympic`.
3. **Not staples:** Copenhagen Plank, Bayesian Curl, Pendulum Squat, Belt Squat, Z Press, Meadows Row (niche or uncommon
   equipment for a beginner's commercial gym). Still fully written, behind "Show more".
4. **American English** in library text. Aliases are exact (no "close enough" names).
5. **Process lesson (L-031):** a fresh reviewer with no history proposes undoing earlier coach and seed decisions; keep the
   applicator's before-check and a planning filter on every future scan.


## DEC-078 — the open library/progression calls closed  (Emilio, 2026-09-24)

Emilio: "1. you choose on data you have - i dont know enough to answer 2. yes 3. yes 4. yes 5. yes".

1. **Rhomboids → Back, rear delts → Shoulders** — planning's call, delegated by Emilio. Data: free-db, our seed, files
   rhomboid work as "middle back", which we map to `rhomboids` (`exerciseLibrary.js:127`, group Back `:59`); the rear
   delt is a head of the deltoid, and our tree already has `rear-delt` under deltoids (`:95`), group Shoulders (`:60`).
   Rear-delt flies carry rhomboids/traps as secondaries (`library/common.js:49-51`), so the back link isn't lost.
2. **A renamed exercise keeps its `libraryId`** (req-130); relinking is req-132's "Link to library". Confirmed.
3. **DEC-072** (merge rule; merged names redirect in search) — confirmed.
4. **DEC-076** (only a whole-number target is judged; the rest hold until req-149) — confirmed.
5. **DEC-077** (fresh-eyes content calls, incl. the six non-staples) — confirmed.

Stale after this: the "(unconfirmed, req-130 spec)" comment at `exerciseLibrary.js:56` — Builder drops it with the next
library req; not worth a req alone.

## DEC-079 — native popups are replaced by an in-app confirm sheet, all of them  (Emilio, 2026-09-24)

Emilio, after a native import dialog froze planning's browser test: "i think we need to exchange those alerts to something
in app - do not get stuck like this and to cover all prompts with our own code". Pattern chosen: **(a) a bottom confirm
sheet** ([Cancel] + a distinct destructive button); errors become in-page notices. Rejected: tap-twice (misfires on a real
delete), undo-instead (every action must be reversible — riskier in a history app). All 14 sites (req-24, re-measured);
a guard test keeps native `confirm`/`alert`/`prompt` out of `src/`. Import validates the file before asking.

## DEC-080 — the confirm sheet's action button is named for the action  (Builder, from req-24, 2026-09-24; unconfirmed)

The spec left the label open. The destructive button reads **Delete** (exercise, routine, workout), **Remove** (routine
exercise, loop weeks, slot, set), **Abandon** (×4), **Replace** (import) — never the native "OK". Messages unchanged.
Cancel is left and focused (a stray Enter never destroys); backdrop, Escape and navigation cancel. On Emilio's list.

## DEC-081 — `go(…, { replace: true })` replaces the browser entry too  (planning, from req-152 QA-1, 2026-09-24; unconfirmed)

> **Reason corrected by DEC-082 §1**; confirmed by DEC-083. The decision stands.

Builder measured that `replace` only swaps the app's own visit stack (`route.js:81-88`, `applyVisit`); the browser entry
is always pushed (`location.hash = …`). So the in-app ‹ Back already skips replaced screens while device/browser Back stops
on them, and on a dead finish route ("Not found."). **Chosen (A):** `replace` is real in the browser too
(`location.replace` of the same URL with the new hash) at every site — ~15 existing ones (item.jsx ×5, overview.jsx:212,
replace.jsx ×2, setup.jsx:59, Exercises.jsx ×4, workout-actions.js) plus the 3 req-152 exits. Why: it makes device Back
match in-app Back and what those sites already say ("replace rather than stacking history"); the stacked entries are the
same dead-Back class as QA-1. Rejected (B, only the 3 exits): leaves two Backs that disagree. User-visible: swipe-back
skips the replaced intermediate screen. On Emilio's list.

## DEC-082 — DEC-081's reason corrected; an added set with nothing logged stays blank  (planning, from req-152, 2026-09-24; unconfirmed)

1. **Correction to DEC-081's "why".** Planner wrote that the in-app ‹ Back follows the visit stack; it doesn't — it is a
   fixed link (`<Back to=…>`, `shared.jsx:43`; Builder, req-152). The decision (A) stands on the rest: after it, every
   device Back from those sites lands on a live screen instead of a replaced or dead one. (L-035.)
2. **QA-3's fallback dropped.** req-152 said an added set with no in-session kg falls back to "the appended suggested
   weight". Builder measured that the live seed never reads `suggestedWeights`, so that would be a new prefill source. Not
   built: the added set carries the kg just logged this session, else stays blank — history and this session only, never
   the routine's number (the core rule).

## DEC-083 — the open calls from req-24 / req-152 confirmed  (Emilio, 2026-09-24)

Emilio: "yes to open calls". Confirmed: **DEC-080** (the confirm button is named for its action); **DEC-081** (replace is
real in the browser at every site — swipe-back skips the replaced screen; reason as corrected in DEC-082 §1); **DEC-082 §2**
(an added set with nothing logged this session stays blank, never the routine's number); **req-152's two calls** (the rest
pill keeps top-centre and size; History reuses the overview's "· skipped"). Still unconfirmed: req-153's redirect of an
in-workout route with no active workout to `/workout/<id>`.

## DEC-084 — req-153's dead-Back fix dropped; the rest ships  (Emilio, 2026-09-24)

req-153 item 1 (no duplicate entry after overview → item → last set) grew, over two rounds and a reviewer, into history
stamping + `history.back()` + a 400 ms / 1 s timer + a capture-phase click listener + a 10 s popstate watch with
`history.forward()` — timing-based navigation that neither Builder nor planning can test on an iPhone, for one Back press
that does nothing. Emilio chose **"Drop it, ship the rest"** (over "merge as built" and "try a simpler idea now").
`route.js` goes back to req-152's `go()` (`location.replace` on replace); items 2–5 ship. Parked in BACKLOG with the simpler
idea to try later: on a popstate that lands on an entry identical to the one just left, step back once more.

## DEC-085 — the 2026-09-24 audits: all of planning's recommendations taken  (Emilio, 2026-09-24)

Emilio: "all your recs", on the 10-item list from `audits/2026-09-24.md` (code) + `audits/workflow-2026-09-24.md`:
1. Warm-up/cardio sets stop saving a hidden effort; **old rows left** (no bulk write) → req-156.
2. Unreadable stored data (DEC-032): Import first **downloads the raw stored value**, then may replace → req-157.
3. Stop recording `workout.progression` and new `legacyRecommendations` entries; existing data kept → req-158.
4. README / DESIGN behind DEC-056/073/req-150/152: **planning drafts, Emilio reviews**, Builder applies (README is code-side).
5. Deploy on every merge stays, **gated by a scripted smoke test of the core flow** → req-159.
6. **Per-type lanes** (UI, bug, data/schema, content, design, backend, tooling, audit) replace the one-size gate; planning drafts.
7. **Backend rules written when req-146 starts:** secrets out of git (`.env` ignored), who runs the server, a third ask-gate for
   anything that deploys to or reaches other users, a restore drill.
8. Builder runs in the **same permission mode as Planner** (messages were held 4× on 09-24) — Emilio's action.
9. Emilio provides a **fresh Export for migration dry runs**, kept in the scratchpad, never in git — Emilio's action.
10. Phase-2 prep: a **render-test harness** for `.jsx` (F-TEST-1, → req-156) and the **`storage.js` split** (F-STRUCT-6, later).
Planning's own list (no objection): `plan qa` (isolated build + serve + seed + dialog stubs), skills (qa-branch, review,
closeout, spec), the DEC digest refresh + archive split, stale-doc fixes, and removing the raw `git commit:*` / `git
reset:*` grants (L-032) — settings are Emilio's to edit.

## DEC-086 — an unreadable value is kept as an on-device copy before Import may replace it  (planning, from req-157's review; Emilio approved the merge, 2026-09-25)

Refines DEC-032 / DEC-085 §2. In the unreadable state, Import first writes the raw string to
`workout-mvp-unreadable-<ISO ts>` and verifies it by read-back (`===`); any failure aborts with the lock kept and nothing
saved. Then it downloads the `.txt`, and only then lifts the lock and imports. The app never reads, migrates or deletes a
copy key. Why: a triggered download is not a backup — on iPhone the save could proceed after a cancelled "Download?"
prompt or a PWA that ignores blob downloads, losing the only copy (reviewer blocker on `7731c59`); a Blob also mangles an
unpaired surrogate, the copy doesn't. Emilio chose "merge now, fix later" for the two rare should-fixes → req-161.
