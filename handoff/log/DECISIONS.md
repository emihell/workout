# Decisions

Append-only, newest at the bottom. One entry per decision that a user could notice or
that constrains future work. Supersede rather than edit — a later entry can overturn an
earlier one, but the earlier one stays.

Format:

```
## DEC-001 — short title  (YYYY-MM-DD)
What was decided, in one or two lines. Who decided it (Emilio, or the planning session
on his behalf — mark "unconfirmed" if it was a default he hasn't ratified). Why, and
what was rejected. Cross-ref the req if there is one.
```

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

Six flat nav items is too many for mobile. **Primary / always-visible: Today** (now) **+ Schedule**
(this week) — the daily-use pairing. **Behind a simple menu** (a "Menu"/"More" affordance):
**Routines, Exercises, History, Settings**. History is review-not-daily, so it moves into the menu
(one tap deeper). The menu can be a plain list for the raw first iteration; grouping (e.g.
Routines/Exercises as a "Plan" area) is refinable later, and analytics (req-08) can validate which
items actually get used. Shapes req-13's `NavBar`.

## DEC-019 — nav: everything goes in the menu; menu closes on item-click or outside-click  (Emilio, 2026-09-10) — supersedes DEC-018's primary items

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
