# req-46 — workflow hardening: save-time drift warning, publish --push, closeout checklist

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-46` (`ca12ddc`…`ca12ddc`, 1 commit).** From the post-audit workflow reflection (2026-09-12), Emilio's
"fix all". **Gate: infra** (`plan` script + workflow); planning verifies by running
the commands + merges. No app code, no persisted data. Same class as req-33/34/35.

Three independent `plan` changes, one branch. Each earned by friction in the
2026-09-12 audit run (10 reqs).

## 1. Surface handoff drift at `plan save`, not only after publish

**Observed:** `NOW.md` exceeded its own ≤50-line rule; `plan publish` printed
`handoff drift found (published anyway)` and pushed to `main` anyway — so the drift
was only noticed *after* it landed, costing a trim-and-republish cycle. Twice.

**Do NOT make publish refuse on drift.** `cmd_publish` deliberately treats drift as
a warning (req-34's comment: "a publish blocked by a stale line number is a tool
that gets bypassed") — that decision stands. The fix is to catch it **one step
earlier**, at `plan save` (planning-only, always run before publish):

- `cmd_save`, after a successful commit, runs
  `python3 "$PLANNING_DIR/scripts/check_handoff.py" --repo "$PLANNING_DIR"` (or the
  path check_handoff expects from the planning worktree) and, if it prints drift,
  echoes it as a **non-blocking warning** (`plan save: handoff drift — <lines>`).
  The commit still succeeds; save never refuses on drift (mirrors publish).
- Net: the author sees `NOW.md`-too-long at save time and fixes it before publish,
  instead of discovering it post-merge.

## 2. `plan publish --push`

**Observed:** standalone `plan publish` (doc-only updates) does not push (DEC-008);
every doc cycle was `plan publish` then a separate `git push origin main planning`.
Ran ~10× this session. (`plan closeout` already pushes; this is only for the
standalone-publish path.)

- Add an opt-in `--push` flag to `cmd_publish`: on success, run
  `git push origin main planning` and echo the result. **Default unchanged** (no
  push) so DEC-008's separation holds for anyone who wants it; `--push` is the
  convenience. Refuse `--push` cleanly if the publish itself refused/failed (don't
  push a no-op or after an error).

## 3. `plan closeout` prints the post-closeout maintenance checklist

**Observed:** every closeout was followed by the same manual ritual (DEC-009 step
9): append a SHIPPED entry, bump `NOW.md`'s shipped range, move the "building"
marker, then save+publish. The prose stays the author's, but the mechanical values
are derivable.

- After a successful closeout, `cmd_closeout` **prints** (does not edit handoff — too
  risky, and it can't know the prose) a checklist with pre-filled values, e.g.:
  ```
  plan closeout: done. Now (DEC-009 step 9), before anything else:
    1. SHIPPED.md — append:  ## req-NN — <title>  (merged YYYY-MM-DD)
    2. NOW.md — bump the shipped range to include req-NN; move the "building" marker
    3. ./plan save "..."  &&  ./plan publish --push
  ```
  Date from the closeout; `NN`/title from the req doc filename/heading. Printing, not
  writing — a safe nudge that removes the "what were the steps again" friction.

## Scope / Out of scope

- **In:** the three `plan` changes above; each independently testable by running it.
- **Out:** making publish *refuse* on drift (req-34 stands — see #1); auto-editing
  handoff from closeout (#3 prints only); any change to `./check`, the merge-gate
  rules, or DEC-008's default no-push.

## Ordered steps

1. `cmd_save`: post-commit non-blocking `check_handoff` warning (from the planning
   worktree). Verify: make `NOW.md` >50 lines on a throwaway edit → `plan save`
   commits AND warns; a clean tree → no warning.
2. `cmd_publish`: parse a `--push` flag; on success run `git push origin main
   planning`. Verify: `plan publish --push` on a doc change pushes; bare
   `plan publish` still doesn't; `--push` after a refusal does not push.
3. `cmd_closeout`: print the maintenance checklist with filled values. Verify: a
   closeout prints the three-line checklist naming the right req/date.

## Acceptance criteria (written before implementation)

- `plan save` warns on a >50-line `NOW.md` and still commits (non-blocking) — paste
  the run. Clean tree → no warning.
- `plan publish --push` pushes on success; bare publish unchanged; no push on
  refusal — paste the runs.
- `plan closeout` prints the filled checklist — paste it.
- `./check` green (app unaffected, but run it). Report notes `plan` is the only
  changed file (+ its report).

## Decisions

- **#1 is a save-time warning, NOT a publish refusal** — req-34 deliberately keeps
  publish non-blocking on drift; do not re-open that. This closes the "noticed too
  late" gap without fighting it. (Recorded so it isn't re-proposed as a block.)
- **#2 default stays no-push** (DEC-008); `--push` is opt-in.
- **#3 prints, never writes handoff** (closeout stays a code-side command; handoff
  edits are the planning session's, by hand).

## Notes

Verify #1/#3 against throwaway edits; never leave `NOW.md` broken (L-001 spirit).
Infra req — planning runs the three commands and merges; no browser, no data.
