# req-90 — `plan closeout` auto-writes the SHIPPED stub + bumps NOW's shipped range

Branch `req-90`. Extends the `plan` tool's `closeout` path to do the two
mechanical ledger edits that followed every closeout by hand (and went wrong twice
this session). Stub + range-bump only; SHIPPED substance and the "Building:" marker
stay the Planner's. Merge/gate logic unchanged. No app change.

## Technical

**What changed — all in `plan`**
- Two new helpers after `flip_status`:
  - `append_shipped_stub PATH REQID TITLE DATE` — appends
    `## req-N — <title>  (merged <date>)` + a one-line `_Stub — Planner: …_`
    placeholder to `SHIPPED.md`. Guarded by `grep -Eq "^## req-N "`, so a re-run
    (or an entry the Planner has since filled) is left untouched — never doubled,
    never clobbered.
  - `bump_now_range PATH N` — rewrites NOW.md's first `**Shipped: … **` span:
    extends the final range in place (`…–(N-1)` → `…–N`, or a bare `req-(N-1)` →
    `req-(N-1)–N`) when N abuts it, else appends `, req-N`. If N is already covered
    by any span, the file is untouched (prints `unchanged`). The span is one line,
    so it never adds a line.
- `cmd_closeout` step **4b** (new): after the status-flip and **before** the
  existing `plan save`/`publish`/`push` (step 5), computes title/date and calls the
  two helpers against `$PLANNING_DIR/handoff/log/SHIPPED.md` and `…/NOW.md`. Both
  calls are non-fatal (warn, don't abort — the merge has already landed) and the
  writes ride the same publish. Then warns if NOW is now > 50 lines.
- `cmd_closeout` step **7**: the printed checklist no longer says "append the
  heading / bump the range" (now automatic) — it prints only what stays the
  Planner's: fill the SHIPPED substance, move the "Building:" marker, add any
  DEC-/L-, then a fresh `save`/`publish`.
- One test seam: `_PLAN_NO_MAIN=1 source ./plan` loads the functions without
  dispatching, so the helpers can be unit-tested. No effect on normal invocation.

**New test — `scripts/plan-ledger.test.sh`** (sources the real functions; no
merge/publish). Covers: stub append + heading/date/placeholder; idempotent re-run;
no-clobber of a filled entry; contiguous extend; already-covered → unchanged;
non-contiguous append; single-token abut; no-span failure; and that the range bump
adds no line and leaves the rest of NOW intact.

**Acceptance criteria — receipts**
```
$ bash scripts/plan-ledger.test.sh
# append_shipped_stub
ok   - stub heading appended with title + merge date
ok   - one-line placeholder appended
ok   - re-run does not double-append (still 1 heading)
ok   - existing filled entry left untouched
ok   - no stub written over a filled entry
# bump_now_range — contiguous extend
ok   - reports 'extended'
ok   - range req-33–89 bumped to req-33–90
ok   - no line added (≤50 rule: range is one token)
ok   - rest of NOW untouched (Building line intact, once)
ok   - Building marker left for the author (not moved)
# bump_now_range — idempotent / already covered
ok   - re-run on 90 is 'unchanged'
ok   - an in-range id (25) is 'unchanged'
# bump_now_range — non-contiguous append
ok   - non-abutting id (95) reports 'appended'
ok   - ', req-95' appended to the list
# bump_now_range — single-token abut
ok   - bare req-88 + 89 reports 'extended'
ok   - single req-88 became range req-88–89
# bump_now_range — no Shipped span
ok   - exits nonzero when no '**Shipped: …**' span (caller warns)
plan-ledger: all checks passed.   (exit 0)
```
- **Stub appended / range includes req-N / rest of NOW unchanged:** the first two
  blocks above. [measured]
- **NOW stays ≤50:** the bump adds no line (`no line added` check); a `> 50` NOW is
  warned, not silently overflowed (step 4b line-count guard). [measured for the
  no-line property; the warn path is by inspection]
- **Idempotent / safe:** re-run leaves both files untouched (`unchanged`, `still 1
  heading`); the writes are before `save`, and are non-fatal, so a mid-way failure
  is the same recoverable "merged but not published" state as today. [measured]
- **Existing closeout behaviour unchanged:** merge / status-flip / publish / push /
  branch-delete are byte-for-byte the same (steps 1–3, 5, 6); only step 4b was
  inserted and step 7's *print* reworded. `bash -n plan` → syntax OK; `./check` →
  green (lint, 261 tests, build). [measured, by inspection for the merge path — see
  Workflow]

## Workflow

- **Could not run `plan closeout` end-to-end** — it merges + publishes + pushes,
  and per CLAUDE.md that command is the Planner's to run, not mine. I verified the
  merge/gate path is unchanged by inspection + `bash -n`, and unit-tested the two
  new helpers in isolation (the only parts req-90 adds). The first real closeout
  under this (req-90's own, run by Planner) is the live end-to-end check.
- No scope added or dropped. Kept it stub + range-bump; the "Building:" marker move
  and SHIPPED substance stay Planner's (still printed as reminders).
- One decision worth a note (not asked, chose it): the stub placeholder is a
  visible italic one-liner (`_Stub — Planner: …_`) rather than an HTML comment, so
  an un-filled entry is obvious in the rendered ledger. Easy to change if you'd
  rather it be invisible.
- The new `scripts/plan-ledger.test.sh` is **not** wired into `./check` (that's the
  app gate; CI wiring is out of scope per the spec). Run it directly. If you want
  the `plan` tool's tests gated, that's a small separate follow-up.
