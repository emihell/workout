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

Granted via fixed `Bash` allow-rules in planning's `.claude/settings.json`, scoped to
planning-only writes (`git add/commit/reset/restore`, `git push origin planning`,
`../workout-app-codebase/plan save`, `plan status`) — deliberately **not** `plan publish` or a
bare `git push`. The deny on editing the settings files stays. Supersedes the "Don't run git
commands that write" rule in `PLANNING.md`. **Partly superseded by DEC-006** (the planning
session now runs the merge/closeout, relaxing the isolation line for that operation).

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
edit code, doesn't drive the code CC). Granted by adding `Bash(../workout-app-codebase/plan
closeout:*)` to `settings.local.json` (gitignored, planning-worktree-local; the classifier blocks
the planning session from writing its own grant, so Emilio pastes it). Standalone `plan publish`
of doc-only changes is still not in the grant — those ride the next closeout or are handed over —
which can be widened later if the hand-off proves annoying.

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
