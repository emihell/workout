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

## L-018 — a schema/key bump must update the reference docs in the SAME req, or the ask-gate goes stale  (2026-09-18)

req-85 bumped `STORAGE_KEY` `v8→v9` and `SCHEMA_VERSION` `8→9` and shipped clean — but left every
"live key" assertion in the docs saying `v8`: `handoff/reference/schema.md` ("Live key: `workout-mvp-v8`;
`SCHEMA_VERSION = 8`"), the `handoff/CLAUDE.md` **ask-gate #2** (loaded every turn — it told Builder to
protect the wrong key), `rules/WORKFLOW.md`, `README.md`, `NOTES.md`. schema.md *states its own rule*
("If the code changes, update this — a DEC- or req that moves the schema updates here in the same pass")
and that rule was the thing skipped. Found by Builder mid-req-99, three reqs later. **How to apply:** when
a req changes `STORAGE_KEY`, `SCHEMA_VERSION`, `LEGACY_KEYS`, or any persisted shape, the SAME req updates
`reference/schema.md`, the `CLAUDE.md` ask-gate key, `rules/WORKFLOW.md`, and the product docs
(`README.md`/`NOTES.md`) — and flips old "live" wording to "legacy". Put it in the req's acceptance
criteria. **The concrete guard:** `git grep 'workout-mvp-v'` (the key string) repo-wide as part of the
bump — not just schema.md — and flip every *live-key* assertion, leaving historical/past-tense refs.
A stale live-key in the ask-gate is the dangerous one: it misdirects the one rule about not
destroying the user's history. See [[L-016]], [[L-017]] (same family: doc/recall lagging shipped code).

## L-019 — never tell Builder unpublished planning work is "on main"; the receipt is `main..planning` empty, not recall  (2026-09-18)

Handing req-99 over, Planner `SendMessage`'d Builder that the spec was "already on main via the
planning merge" — while it was still uncommitted in the planning worktree; `plan save`/`plan publish`
hadn't run. Planner self-caught the next turn and Builder independently caught it too, so nothing was
built against a phantom spec — **zero damage this time, large latent radius**: a false "it's on main"
actively suppresses Builder's own "this looks stale → say so" safeguard, and Builder would have read
the last publish (three reqs old, still on the v8 key) as the base. This is the **planner-side twin of
[[L-016]]/[[L-017]]/[[L-018]]** — asserting from recall ahead of the receipt — but applied to *publish
state* rather than shipped code. Three prose rules already forbid it (`PLANNING.md:174–179` "CC's
knowledge is exactly the last publish", the cycle's publish-then-ping at `:222–223`, and `:190` "do not
describe a draft as sent") — so another prose rule is worthless. **How to apply:** publish is a state
you *check*, never one you remember. Before any Builder ping that names work as landed, the receipt is
`git log main..planning` empty (or `./plan status` "fully published") — run it, don't recall it. Order
is always: `plan save` → `plan publish` → verify → *then* SendMessage. (If the `plan ping` guard lands,
it enforces this; until then it's manual.)

## L-020 — a rotted check that silently matches nothing is worse than no check; verify the harness still FIRES, don't trust its green  (2026-09-18)

NOW.md carried a stale block for most of a session — the "Gym-flow batch 2" paragraph listed req-82/83/84/85/86
as "NEEDS DECISION / in flight" when all five were BUILT AND MERGED. Planner missed it (edits NOW.md
surgically — touches the added lines near the top, never re-reads the whole ≤50-line file against reality)
AND told Emilio "no drift" on the strength of `check_handoff.py`'s green output. But [measured]
`parse_now_md_claims` extracts `{}` from the current NOW.md: its `QUEUE_LINE_RE` (`:243`) expects a
`[ ] req-N … READY` checkbox format and `done YYYY-MM-DD:` lines that NOW.md no longer uses, and it doesn't
know the phrase "NEEDS DECISION" at all. So the NOW.md↔status cross-check runs on an empty claim set and can
never fire — it reports clean by construction. **This is the dark side of "receipts over claims"
([[L-018]]/[[L-019]]): a receipt from a check that verifies nothing is a false receipt.** How to apply:
(1) when you touch NOW.md, re-read the WHOLE file and reconcile every req-N against its real status — it is
capped at 50 lines precisely so this is cheap; (2) a green from a checker only means "no findings," not
"the check exercised anything" — periodically prove a check still catches a planted failure (the way
`plan-guards.test.sh` asserts refusals), and when a doc's format evolves, its checker's parser is now
suspect until re-verified. A drift checker whose parser has drifted is the highest-value thing to catch.

## L-021 — two gotchas when writing `check_handoff` self-tests (req-102)  (2026-09-18)

Both surfaced building/reviewing the self-tests that back the drift checker; both waste a review
round or 20 minutes for the next person who touches `scripts/check-handoff.test.sh`.

1. **`check_handoff --ref HEAD` on a feature branch flags that branch's own not-yet-merged req.** Its
   reverse check ("tagged not-yet-merged but `<commit>` already merges it") fires because the req's
   implementing commit IS in the branch HEAD's history while its doc still reads READY — exit 1. This
   is a branch-checkout artifact, not a defect: `check_handoff` is meant to run against **main /
   planning** (how `plan save`/`publish` invoke it, `--repo CODE_DIR`/`PLANNING_DIR`). It bit twice —
   the req-101 review AND a req-102 self-test assertion that asserted "exit 0 on live HEAD" and so was
   RED on its own branch. **How to apply:** never assert "zero findings on live HEAD" in a self-test;
   test a check's *intent* against an isolated fixture, or assert import+`run_checks()` runs without
   raising. When you want a real "is the repo clean" read, run it against main/planning, not a branch.
2. **On Python 3.9, load `check_handoff` in a test via `sys.path.insert(0, dir)` + `import
   check_handoff`, NOT `importlib.util.module_from_spec`.** The latter leaves the module out of
   `sys.modules`, which breaks its `@dataclass` (dataclass needs the module registered) — a confusing
   failure unrelated to your assertion. The existing test's pattern is the one to copy.

Caught by running the FULL self-test output, not the `tail`ed "all passed" summary — see [[L-020]]:
a green summary only means "no findings," so read what actually ran.

## L-022 — a question from the owner got recorded as a decision, then reversed by his next question  (2026-09-23)

Emilio asked *"usually you send you the builder - not an external bot?"*. Planner wrote DEC-054 ("batches go
to the Builder") and edited PLANNING.md. Two minutes later he asked *"would it be better to send batches to
throwaway agents?"* and DEC-055 reversed it. The fault wasn't the rule conflict (DEC-037 vs recent practice).
It was treating a question as an instruction: two DECs of churn, and a stopped subagent's work thrown away.
**How to apply:** answer a question with a recommendation. Write the DEC only after he confirms, and confirm
it back in one line (DEC-057 §2).

## L-023 — the Gate tag decided which safety checks ran, so shared-code reqs skipped them  (2026-09-23)

req-111 (`storage.js` `lastSetsForExercise`, which drives every prefill) and req-112 (`store.jsx` finish path,
`model.js`, `progress.js`) were tagged `[functional]`. The independent reviewer and the backup reminder were
keyed off `[persisted-data]` in practice, so neither ran for them. req-109 was tagged `[persisted-data]` and
got both, and its reviewer caught real should-fixes. **How to apply:** decide the checks from the diff's files
(WORKFLOW READY check 5). A `plan closeout` warning when such a diff lands with no reviewer line would make it
mechanical (BACKLOG tooling).

## L-024 — a "visual no-op" is proven by a repeatable before/after capture, and a text-node split shows up in it  (2026-09-23)

req-122 (a wide NavLink/Actions refactor) was verified by building main and the branch, freezing the clock, seeding the
same state through the UI, and comparing `#root` innerHTML and PNG bytes on 23 screens (a before-vs-before rerun matched,
so the capture was repeatable). The only pixel diff came from `chevron="back"` splitting "‹ Exercises" into two text
nodes: identical DOM text, sub-pixel anti-aliasing. **How to apply:** for any refactor claimed invisible, require this
capture (the script is in the req-122 report) and treat a pixel-only diff with identical DOM as explainable, not a
failure. Add the screens the change touches but the standard set misses (the reviewer found 6 uncovered call sites).

## L-025 — a guard exemption must not reopen the hole the guard exists for  (2026-09-23)

The pre-push fast-forward guard false-positived on a fresh, still-empty req branch at main's tip (req-120). The first spec fix
("exempt a branch with no commits beyond main") would have exempted exactly the fast-forwarded branches the guard refuses; the
spec review caught it. req-129 instead exempts only a branch whose reflog shows nothing but its creation, and its self-test
proves that an FF'd branch **with** commits is still refused. A narrow hole remains: `git branch req-N <unmerged sha>` followed
by an FF. **How to apply:** every exemption to a safety check gets a self-test of the case the check exists to catch, run
against the new code **and** failing against a copy that has the exemption but not the check.

## L-026 — a data table imported by a shared module lands in the main bundle  (2026-09-24)

req-133's first cut put the tagging tables + validator in modules the app imports eagerly: main bundle 340.93 → 368.86 kB,
unnoticed by any test. Builder caught it from the build output and moved the data behind the library's lazy import (back
to 340.93 kB). **How to apply:** any req that adds data or a large table pastes the **main** chunk size before/after, not
just the lazy chunk's, and a jump is explained or fixed before review.

## L-027 — a search over a joined string matches across field boundaries  (2026-09-24)

Since req-130 the alias tier matched `compactText(aliases.join(' '))`, so "rdl" hit "Dumbbell Forwa**rd L**unge", "row" hit
"P**row**ler", "ring" hit "hamst**ring**". Nothing failed until req-139's short common-first list put the false hits on top;
planning found it by running real queries at the gate, not from any test. Fixed: per alias, from a word start only.
**How to apply:** match per field and per word start, never on a concatenation; any search change gets a gate run of 10+
real queries whose top hits are read by eye, and a before/after diff over a broad query set.

## L-028 — writing without looking isn't enough to be original; measure it  (2026-09-24)

req-138's text was written without opening RepDB, yet 19 of 178 entries scored over 0.15 on 4-gram overlap with RepDB and
7 lines shared 12-token runs, all from stock gym English ("Lie on your back with…"). req-139's own-* text had already
drifted the same way (median 0.08 vs free-db's 0.00). A per-sentence "≥0.8 token overlap" rule would have flagged every
short cue instead. **How to apply:** for any authored content that must not derive from a source, pin the source, score
entry-level n-gram share + long contiguous runs after writing (never showing the source text to the writer), rewrite the
flagged items, and paste the distribution beside a known-independent control.

## L-029 — a top-level `new Set`/`new Map` in a data module defeats tree-shaking  (2026-09-24)

req-140's first cut put `new Set(...)`/`new Map(...)` at module top level in `common.js`; the bundler can't prove those
side-effect-free, so the tables rode into the main chunk (340.97 → 345.31 kB). Builder caught it from the L-026 size
receipt and moved them inside `commonExercises()`. **How to apply:** data modules export plain literals or functions
only; anything constructed runs inside a function. The L-026 main-chunk receipt is what catches a slip.

## L-030 — compacted-substring matching hides short exact names behind longer ones  (2026-09-24)

"l-sit" compacts to "lsit", a substring of "wallsit", so the staple Wall Sit filled Search's first tier and L-Sit sat
behind Show more (req-151). L-027's class of bug, in names. Fixed: an exact hit on a listed non-staple's own name is
pulled into the first tier whenever a staple hit exists. **How to apply:** every search tier change runs the "search
each entry by its own shown name — is it first?" scan over the whole listed library; it found exactly the 2 cases here.

## L-031 — a history-free reviewer will undo earlier decisions  (2026-09-24)

req-141's fresh agents (deliberately given no history) proposed 6 changes that reverted a coach safety fix, removed seed
aliases stored exercises resolve through, or broke validators and pinned receipts. The applicator's "before must equal
current" check plus Builder's and planning's filter caught all six. **How to apply:** a fresh-eyes pass gets no history
by design, so it always needs a gate that knows the history: a mechanical before-check, then a reviewer holding the DECs.


## L-032 — a raw `git commit` of handoff/ skips the planning tool and trips the guards  (2026-09-24)

Planner committed DEC-078 with a bare `git commit`; `.githooks/pre-commit` refused it, then auto mode denied the
`HANDOFF=1` retry as a guard bypass, and Emilio had to authorise it by hand. `./plan save` already commits with
`HANDOFF=1` (`plan:177`), refuses anything outside `handoff/`, and runs the drift check. **How to apply:** planning
commits go through `./plan save "msg"` only — never a raw `git commit`, never a hand-set `HANDOFF=1`.

## L-033 — a native dialog freezes an automated browser test; planning can browser-test without touching code  (2026-09-24)

Planner's first browser run (closing the owed test lists) triggered the import `window.confirm`; the tab froze until
Emilio clicked it by hand. **How to apply:** before any click that may confirm, stub `window.confirm/alert/prompt` in the
page (log + auto-answer), and re-stub after every reload — until req-24 removes them. The method that worked, and keeps
the worktrees isolated: `git archive main` into the scratchpad, symlink `node_modules`, `vite build`, `vite preview` on a
`127.0.0.1` port (its own origin: no real data), seed from `src/db.json` (v8 → migrates), a 375 px iframe for phone-width
geometry. A countdown screen (Finish, 10 s) outruns screenshot-paced clicks — act on it inside one script.

## L-034 — `git checkout -- file` to undo a probe also wipes the file's uncommitted work  (Builder, req-24, 2026-09-24)

Builder reverted its deliberate-fail guard probe with `git checkout -- edit.jsx`, which also discarded that file's
uncommitted req-24 edit; it restored it from a copy. **How to apply:** remove a probe line by editing it out (or commit
first); never `checkout` a dirty file to undo one line.

## L-035 — a DEC's reason is a claim too; Planner recorded an unread one  (2026-09-24)

DEC-081 said "the in-app ‹ Back already uses the visit stack" — inferred from `applyVisit`'s name, never read; the Back is
a fixed link (`shared.jsx:43`). Builder caught it; the decision survived on its other reason, by luck. **How to apply:**
the "why" in a DEC gets the same receipt as a number — a file:line read in this session — or it is marked `[inferred]`.

## L-036 — a scope revert is a change too: re-run the browser, not only the tests  (2026-09-24)

req-153's revert of the step-back code (DEC-084) passed `./check` and every unit test, and Builder didn't re-run the
browser ("covered by the unit test"). Planner's browser run then found Finish → Save / Abandon landing on the overview, not
Today: finish.jsx's new redirect fires after the exit's `go('/')`, and the dropped code had been silently swallowing it (the
reviewer had flagged it as "latent"). **How to apply:** after removing code, re-run the flows that code sat on in a real
browser; and a reviewer's "latent" finding is re-checked whenever the code that made it latent goes away.

## L-037 — fix a parse where every reader of the raw text sees it, not only at the save  (Builder, req-154/155, 2026-09-24)

req-154 fixed the comma kg at the four saves, but the carry (`nextSeedOverrides`) still got the raw text ("22,5" never
carried); req-155 found the DurationTimer readout showing "0s" for "30,5" while the save read 31. **How to apply:** when a
typed value gets a parser, grep every consumer of that field's raw string (compare, carry, readout, save) and route all of
them through the one parsed value.

## L-038 — a hidden control must not submit its default  (Builder, req-156, 2026-09-24)

`SetLogForm` hid Effort on warm-up/cardio sets but still submitted its seeded value (rpe 3), so History showed "Moderate"
for sets the user never rated — it existed since 2026-09-12 and only a rendered form test would have caught it. **How to
apply:** the form owns "not shown → no value"; a render test per hidden-field case (the req-156 harness makes it cheap).
