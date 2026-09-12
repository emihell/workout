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
