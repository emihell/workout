# Lessons

Append-only, newest at the bottom. What went wrong, so it doesn't go wrong the same way
twice. A lesson is not a decision — it's a mistake with its cause named.

Format:

```
## L-001 — short title  (YYYY-MM-DD)
What happened, what the real cause was (not the symptom), and the rule that now
prevents it. Cross-ref the req or audit finding if there is one.
```

---

## L-001 — seeded a browser's localStorage for a test without snapshotting it first  (2026-09-09)

While browser-testing req-03, the planning session injected `src/db.json` into
`localStorage['workout-mvp-v8']` on `localhost:5173` to get a workout with a rest running, then
cleared it after. The miss: it **overwrote** whatever was in that key without first reading and
saving the prior value, so if anything had been there it was gone with no restore path. Low harm
here — the dev origin (`localhost:5173`) is separate from where real history lives, and it was
very likely empty — but the principle is the project's core: never overwrite persisted data
without a way back. Rule: before seeding/overwriting `localStorage` for a browser test, first read
the existing value and restore it afterward (or drive the real UI, or use a throwaway browser
profile). Applies to the planning session's own browser tests, not to app code.

## L-002 — an ownership-changing DEC needs a same-turn doc sweep  (2026-09-09)

DEC-008 moved `plan publish` from Emilio to the planning session, but the change wasn't
propagated in the same pass — about five spots in `PLANNING.md` still read "hand Emilio the
publish line" and sat contradicting the DEC until a later full-folder scan caught them. Cause:
recording a decision without sweeping the docs that reference what it changed. Rule: when a
`DEC-` changes ownership or a standing rule, immediately `grep handoff/` for the old model's
phrasing and reconcile every hit in the same turn — never let the DEC and the prose disagree,
because whoever reads the prose won't know a DEC overrode it.

## L-003 — a device API needing a secure context can't be phone-tested from a pre-merge LAN branch  (2026-09-09)

req-09 (wake-lock) is device-verified — only a real idle phone proves the screen stays on. But
`navigator.wakeLock`, like most device APIs (notifications, vibration, …), requires a **secure
context** (HTTPS or `localhost`). A phone hitting the Mac's dev server over the LAN uses plain
`http`, so the API is `undefined` there — the feature no-ops and can't be observed. The usual "test
the branch on your phone before merge" path therefore doesn't work for these features. This time it
was resolved by Emilio approving merge-then-verify-live (low-risk: fail-silent, scoped, wiring
verified + 8 tests). Rule: when a req is **device-verified AND uses a secure-context-only API**, plan
the testing path up front — a preview HTTPS deploy (durable fix; a branch → its own HTTPS URL,
worth a backlog item), a local secure context (tunnel / vite-https / `adb reverse`), or an explicit
merge-then-verify-live decision. Don't discover the gap at the gate.

## L-004 — the req-15 findings are observations; verify each premise before speccing  (2026-09-10)

Two of the req-15 refactor findings (`reports/req-15-findings.md`) had premises that didn't survive
contact with the code. **#10** ("`ExerciseTitle` + `ExerciseSetupHeader` always rendered together")
was false — `WorkoutItemLive` renders them apart, gated on `!resting` — so it was rejected in
planning (see `work/req-16`). **#6** ("`.ui-sub` almost always = Title then `<p>` subtitle", implying
a ~50-site sweep to a prop) also missed: CC found most of the ~50 `.ui-sub` uses are **empty-state
list captions**, not title subtitles, so the `subtitle`-prop migration is only a handful of sites and
the utility class stays first-class. Neither cost much because the premise was checked before/while
speccing — but the pattern is clear: a findings doc written "observe, don't do" (DEC-021) records what
looked true mid-task, not a verified spec. Rule: when turning a finding into a req, re-run its own
`grep`/read and confirm the premise holds; spec against the code, not the finding's summary. (Also why
`req-21` capped the demo migration at provably byte-identical sites instead of "convert all 50".)

## L-005 — `./check` does not catch a missing import of a *local* symbol  (2026-09-10)

Found while merging req-19 (a by-hand split of two view files into folders). oxlint does **not** flag
undefined identifiers, and esbuild treats a bare undefined identifier as a global reference — so a
module that uses a helper it forgot to import **passes `./check`** (lint + tests + build all green)
and only blank-screens at runtime on the screen that calls it. The green gate is therefore *not*
sufficient evidence that a file-move/split is correct. Rule: for any refactor that relocates symbols
across modules (a split, an extraction, a barrel), the receipts are (1) an import-block-stripped
old-vs-new **body diff** proving the executable lines are unchanged, plus (2) an explicit **import
audit** (every used symbol resolves to an import or a local def; every JSX tag imported), plus (3) a
**browser walk** of the affected screens — not the `./check` line. CC ran all three here and flagged
the blind spot; worth building the audit into how we review splits.

## L-006 — code CC must always build on a req branch; planning is the QA/PO merge gate  (Emilio, 2026-09-11)

req-27 was committed **directly onto the code worktree's local `main`** instead of a `req-27` branch —
a workflow slip (CLAUDE.md already says "implement on a branch named after the requirement"). Emilio
reinforced the rule: *code CC always makes a branch; planning reads the report, QAs, and merges to
main* — planning is QA + PO here, and merging is planning's job, never code CC's. Recovery when it
happens: from the code worktree, `git branch <req>` at the stray commit, `git reset --hard origin/main`,
`git checkout <req>` — the commit is preserved on the branch and `plan closeout` then works normally
(done for req-27: main back to e9f3928, branch `req-27` at 5a09046). Prevention: every "build req-NN"
handoff must say **branch first** (`git checkout main && git pull && git checkout -b req-NN`), and
planning should sanity-check the branch exists before reviewing. A code-CC pre-push/commit hook that
refuses commits on `main` would enforce it — worth adding.

## L-007 — `store.jsx` behaviour is unreachable by the `node --test` gate (no JSX transform)  (2026-09-12)

Found building req-38 (F-CODE-2, a fix inside `store.jsx`). The gate runs plain `node --test`, which
has **no JSX transform**, so any module that is `.jsx` — `store.jsx` above all — **cannot be imported
by a test.** That is why no existing test imports the store; the tested logic all lives in pure `.js`
(`model.js`, `workout-log.js`, `storage.js`, `progress.js`, `schedule.js`). Consequence: you cannot
drive `startWorkout`/store mutations directly in a unit test. req-38 worked around it by pinning a
boundary `new Date()` to prove the *substituted expression* (`dateKey(new Date())`) is local-not-UTC,
plus a source-guard test that reads `store.jsx` as text — deterministic, but not a real store-behaviour
test. Rule: **when a req's logic must be unit-tested, put that logic in a pure `.js` module** (a helper
in `model.js`/`workout-log.js`), not inline in `store.jsx`/a view `.jsx`; the store/view then just
calls it. Directly relevant to the queued audit reqs that touch `store.jsx`: **req-40** (progression
unify — the shared helper must land in a pure module, not inline in `finish.jsx`) and **req-41**
(cross-tab warn — the storage-event reconcile logic should be a pure function the store wires up). A
JSX-capable test runner would remove the constraint but is a real toolchain change — not in scope for
an audit-fix; flagged here so store-testing limits are planned for, not discovered at the gate.

## L-008 — the canonical grant list now lives in two places, coupled only by a comment  (2026-09-12)

req-45 gave `plan doctor` a content check that compares `settings.local.json`'s `permissions.allow` to a
canonical grant list — so that list is now hardcoded in **both** README §Setup step 5 (the printf paste a
new machine runs) **and** `plan`'s `canonical_grants` array, joined only by a "KEEP IN SYNC WITH README
§Setup step 5" comment. Nothing enforces the sync: change the grants in one place and the other silently
disagrees — README would hand a new machine a list that `plan doctor` then flags as drift, or vice-versa.
This was the deliberate trade (reading the list *from* README was ruled fragile/out-of-scope, req-45), so
it's an accepted coupling, not a mistake — but it's real. Rule: **whenever the planning grants change (a
new push form, a new `plan` verb), update all three together in the same commit** — README §Setup step 5,
`plan`'s `canonical_grants`, and the relevant `DEC-` (DEC-005/026 enumerate them) — and re-run `plan
doctor` to confirm they agree. A future consolidation (single source both read from) would retire this.

## L-009 — `viewport-fit=cover` is the precondition for any `env(safe-area-inset-*)`

req-51. The app had safe-area CSS (`--ui-tabbar-h: calc(61px + env(safe-area-inset-bottom))`)
since req-14, but the bottom bar still clipped the home indicator in standalone. Root cause
[measured]: `index.html` viewport meta lacked `viewport-fit=cover`, so iOS resolves EVERY
`env(safe-area-inset-*)` to `0` — the safe-area math was silently inert the whole time.
**Lesson:** safe-area CSS written before `viewport-fit=cover` does nothing and reads as
"handled" in review. When adding `env(safe-area-inset-*)`, confirm `viewport-fit=cover` is in
the viewport meta, and keep every inset `env()`-driven with a `0px` fallback so no-notch
devices get no dead gap.

## L-010 — `node --test` has no JSX transform; components can't be render-tested here

req-52. The `./check` gate runs `node --test` with no JSX/Babel transform, so a `.jsx`
component cannot be imported and rendered in a unit test. Two working substitutes are already
in the tree: **behavioural coverage via the pure helper** the component reads (`activeTab` in
`route.test.js`), and **static-source assertions** that read the component file as text
(`safe-area.test.js`, `BottomMenu.test.js` — assert the aria-labels, the null-on-`workout*`
guard, the targets). **Lesson:** don't spec "render-level" asserts for a UI req under this
gate; ask for the pure-logic test + a static-source lock, and treat the true render check as
the browser after-look. If render-level asserts become common, adding a jsdom/transform test
lane is the real fix.

## L-011 — an isolation:worktree agent leaves its branch checked out; remove it before closeout

DEC-037 batches. A build agent spawned with `isolation: worktree` does `git checkout -b req-N`
inside a worktree under `<code>/.claude/worktrees/agent-<id>`, which is NOT auto-cleaned once it
has commits — so branch `req-N` stays checked out there, and `plan closeout`'s `git branch -d`
would fail ("checked out at ..."). **Lesson:** after the agent reports and before closeout, run
`git -C <code> worktree remove --force .claude/worktrees/agent-<id>` then `git worktree prune`.
The branch's commits persist in the shared `.git` after removal, so closeout still finds and
merges `req-N`. (Verify branch is free: `git branch` shows no leading `+`.)

## L-012 — modules needing `node --test` coverage must use explicit `.js` import specifiers

req-55. `workout-actions.js` imported `./route` / `./schedule` (extensionless); Vite resolves those, but
`node --test` (no bundler resolution) could not load the module to unit-test it, so the logic was
uncovered. Fixed by using `./route.js` / `./schedule.js`. **Lesson:** any module you intend to cover with
`node --test` (the project gate) must use explicit `.js` extensions on its relative imports — extensionless
specifiers pass lint/build but silently block node from loading the module under test.

## L-013 — don't merge a flagged behaviour fork on your own reading — confirm it first

req-57. Emilio's "remove schedule from front page" had two visibly-different readings — remove just the
Schedule **nav link**, or remove the **whole upcoming preview**. Planning picked the broad one, flagged
it "reversible / decided on his behalf," and **merged** — he meant the narrow one, so it shipped wrong
and needed req-59 to correct (a wasted build + a correction). DEC-035 lets planning merge ux-feel on its
own testing, but that covers *implementation/quality*, NOT a genuine **behaviour fork** where two
outcomes are both plausible and a user notices the difference — that is Emilio's call (CLAUDE.md "when to
ask" #1). **Lesson:** when a UX instruction forks into materially-different visible outcomes, CONFIRM the
fork before building/merging; "flag it reversible and merge anyway" is not a substitute for the one-line
ask. Prefer the narrower/less-destructive reading when unsure.

## L-014 — a whole session lost to a stale local branch never fetched  (2026-09-16)

Planning opened a session, never ran `git fetch`, and concluded from a grep of the **local** branch that
Emilio's gym-flow notes were "lost" — then spent a large part of the session re-running a grounding sweep,
re-creating an INBOX, and "restoring notes to TRUE verbatim." All of it duplicated `req-76..86`, which
already existed on `origin/planning` (`2719ba8`/`c81fd6e`, made a prior session). `git log --all` would
have found them in one command. It also produced three false claims ("verbatim" over notes it had reworded,
"lost"/"0 hits" over reqs that existed). **Root:** asserting from memory / local state instead of checking
ground truth (origin). **Fixed:** git-fetch-at-session-start (PLANNING.md), check-it-exists-before-creating
(WORKFLOW.md §Rescan). **Lesson:** the fetch/`--all` check is mechanical and mandatory at session start;
and "lost"/"missing"/"verbatim"/"done"/"merged" are claims that need the command output **beside** them
before the word is written — the honesty *rule* alone did not hold (it broke again the same session), so
the discipline is receipts, not intentions.

## L-015 — brace a `$var` immediately followed by a non-ASCII byte in bash  (2026-09-16)

req-91. A `$PREVIEW_PORT` written directly before a multibyte `…` in the `plan` script was parsed as one
undefined variable name (bash reads the following bytes as part of the name), which under `set -u` aborted
the build. Fixed by `${PREVIEW_PORT}`. **Lesson:** in the `plan` script especially — it's full of `…`,
`–` (en-dash) and other non-ASCII — **always brace `${var}` when the next character is non-ASCII**, or the
var name silently swallows it. Cheap to prevent, annoying to diagnose.

## L-016 — verify a "dead/unused/write-only" claim across the full call graph before writing it into a doc  (2026-09-17)

req-96 aftermath. Planner relayed Builder's flag — "`workout.progression` is write-only, `formatProgressionLine`
unused" — into BACKLOG + a SHIPPED note as broadly removable dead code (commit 582803f). It over-reached:
`buildFinishProgression`/`progressionForItem` still feed **`applyProgressionToRoutines`** (`store.jsx:351,377`),
a live (RPE-gated) WRITE path that updates routine templates at finish — not dead. Caught and corrected the
same session (req-97 narrowed to delete only `formatProgressionLine`, the one truly-unused symbol), so nothing
bad shipped. The subtle trap flagged by the external review: the claim carried a `[measured]` tag, but the
measurement only covered the **render** surface ("nothing renders it") and was extrapolated to "therefore
removable" without grepping the callers. **How to apply:** before writing dead/unused/removable about a symbol,
`grep -rn` its full call graph (readers AND writers, not just the UI), and make `[measured]` cover the exact
claim — not a narrower fact standing in for it. See [[verify-dont-recall]] / receipts discipline (L-014).

## L-017 — read the adjacent already-shipped req's code before speccing a feature or taking a design decision to Emilio  (2026-09-17)

Same session, same root habit. For the req-96 "item 2" (compare timed exercises), Planner wrote a full
"build timed-actual capture" spec AND asked Emilio two design questions (capture method A/B/C, adoption)
**before** reading req-85's implementation. On finally reading it, the editable-actual capture (option A)
already existed end-to-end in `SetLogForm`'s DurationTimer — so item 2 collapsed from a feature to a one-line
guard (req-98), and a design question had been put to Emilio that a code-read would have made unnecessary.
Both this and L-016 are one failure mode: **propose/decide from recall, then correct after reading the
adjacent shipped code.** **How to apply:** when a task extends or touches an existing feature, read that
feature's current *implementation* (not just its req/spec) before framing scope or asking Emilio to decide —
the code often pre-answers the question. Cheapest guard against wasting Emilio's decisions. See [[L-016]].
