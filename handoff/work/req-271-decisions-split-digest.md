**Status: READY** · **Lane: tooling** · DEC-144 §4 (moved to now by DEC-155 §7), DEC-087, DEC-155, L-032. Before req-272 (both touch `scripts/check_handoff.py` + `plan`).

# req-271 — DECISIONS.md: a generated index, entries split by range, no dangling DEC refs

## Why (observed)

Workflow audit 2026-10-30 §8: "**Refresh the DEC digest and add the check for it** (09-24 B7b). Do the archive split
(2,264 lines; DECISIONS.md:8-10 sets the trigger at ~1,000)." §E1: the digest is "Refreshed 2026-09-24 through
DEC-085"; it still lists superseded DEC-036 / DEC-041 / DEC-055 as live and misses DEC-091/094/095/127/128/141/143. §B6:
`check_handoff` exits 0 with that stale digest. DEC-144 §4 put it "after Phase 1"; DEC-155 §7 moves it to now.

[measured 2026-10-31, `planning` `54a047b`]
- `handoff/log/DECISIONS.md`: **2,431 lines, 200,983 bytes (~50k tokens)**, 157 `## DEC-` headings = DEC-001..155 (no
  gaps) + the format example `## DEC-001 — short title` (:15) + `## DEC-035 follow-up` (:797).
- Hand digest `## Current rules digest`: lines 23–93 (~70 lines), last refreshed through DEC-085 (:27).
- `> SUPERSEDED` markers: 8 (:168,227,419,431,532,925,1095 + the rule text :27). 39 entries say amends/supersedes/
  overrides/replaces another DEC in prose only.
- Entries by range: DEC-001..050 1,039 lines · 051..100 629 · 101..155 749.
- `DEC-NNN` references: 3,269 in 474 files (handoff, src, server, scripts, `plan`, `check`, README, .githooks); 223
  files outside handoff/. Dangling today: **1** — `scripts/check-skills.test.sh:27` `DEC-999`, a planted fixture.
- Readers: CLAUDE.md:91, WORKFLOW:10,160,275, PLANNING:102,318,363, BUILDER:81, `.claude/skills/review/SKILL.md:14`
  ("grep `handoff/log/DECISIONS.md`").

## Scope

Builder builds the tools (handoff/ is read-only to it); Planner does the move with them in the recording pass.

1. **`scripts/dec_index.py`** (generator, Planner runs it via `plan save`): reads every entry file and writes the
   **index** — one line per DEC: `DEC-NNN · date · title · status`, status = `live` | `superseded by DEC-x` |
   `amended by DEC-x §k`, taken from `> SUPERSEDED by …` / `> AMENDED by …` markers at an entry's top (markers are the one
   allowed edit to an old entry, as today). Deterministic output (same input → byte-identical file).
2. **The split layout** (a move, never a rewrite):
   `handoff/log/DECISIONS.md` = header + the topical digest + the generated index (~250 lines).
   Entries → `handoff/log/decisions/DEC-001-050.md`, `DEC-051-100.md`, `DEC-101-150.md`, `DEC-151-200.md` (new DECs
   append to the newest range file; a new file every 50). `scripts/dec_split.py` performs the move and proves it:
   the concatenated entry text after == the entry text before (byte-equal), every heading in exactly one file.
3. **Checks in `scripts/check_handoff.py`** (fail, not warn):
   a. every `DEC-NNN` cited in handoff/, src/, server/, scripts/, `plan`, `check`, README.md, .githooks/, .claude/skills/
      resolves to exactly one entry heading (allowlist: the planted fixture in `check-skills.test.sh`);
   b. the committed index equals the generator's output (stale index → fail, message names the command);
   c. the topical digest cites no DEC whose status is `superseded` (the E1 class of drift).
4. **`plan save` regenerates the index** before committing when any `log/decisions/*.md` changed, so it is never stale.
5. Update the code-side readers: `.claude/skills/review/SKILL.md:14` and `check_skills.py` if it resolves DEC ids by path.

## Out of scope

- Rewriting any entry's text (move only). Marking the 39 prose amendments with `> AMENDED` markers — Planner does that
  over time; the generator handles both marked and unmarked entries.
- LESSONS.md (633 lines, 51 KB, 68 entries) and SHIPPED.md (2,827 lines, 246 KB, 239 entries) — **candidates** for the same
  pattern; the audit counted them (D1) but asked only for the DECISIONS split. SHIPPED is the largest file in handoff/.
- The handoff/ text edits (CLAUDE.md:91, WORKFLOW, PLANNING pointers, the refreshed digest) — Planner's, in the recording
  pass, listed below so the check goes green.

## Steps

1. Generator + split script + checks, tested against a fixture DECISIONS.md (in a temp dir, not handoff/).
2. `plan save` hook; `plan help` line.
3. Dry-run the split against the real file read-only (`git show main:handoff/log/DECISIONS.md` → temp dir) and paste the
   byte-equality receipt and the resulting line counts.
4. Report the exact commands Planner runs in the recording pass.

**Planner, after merge (recording pass):** run the split; refresh the topical digest through DEC-155 (drop DEC-036/041/055
lines, add 091/094/095/127/128/141/143/144/155); point CLAUDE.md:91, WORKFLOW:160 ("grep `log/decisions/`"), PLANNING:102,
363 at the new layout; `./plan save`; check green.

## Acceptance criteria

1. Split dry run on the real file: entry text byte-equal before/after; 157 headings, each in exactly one file; the
   format example stays in the header.
2. **Guard fires — dangling ref:** a fixture citing `DEC-777` → check fails naming file:line; the allowlisted `DEC-999`
   fixture does not fail it.
3. **Guard fires — stale index:** edit a fixture entry's title without regenerating → check fails, names the command.
4. **Guard fires — superseded in digest:** a fixture digest citing a DEC marked `> SUPERSEDED by` → fails.
5. **Failure case — an entry with no date or a malformed heading:** the generator refuses with the line, writes nothing
   (no partial index).
6. Generator is deterministic: two runs → identical bytes.
7. `./check` green, test count equal to main's + the new tests (L-067: read the count).

## Decisions made on Emilio's behalf

- Implementation: range files of 50, the index format, the generator run by `plan save`.
- (confirmed DEC-155 §8) — Emilio reading decisions: `DECISIONS.md` stays the entry point (digest + index); a full entry opens
  from its range file. His steps don't otherwise change.

## Siblings

req-257 (`plan`), req-258/req-266 (`check`), BACKLOG "untriaged audit findings check" (also `check_handoff.py`) —
none open on these files today. req-272 after this (ratchet sees the final layout; excludes `log/`).
