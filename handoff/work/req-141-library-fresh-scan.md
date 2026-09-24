# req-141 — fresh-eyes scan of the whole library

**Status: BUILT, NOT merged — branch `req-141`** — Phase 1, **data only**. **Gate: functional**. DEC-065 §4 + DEC-070 §3: after RepDB's removal (req-142), a
fresh agent scans **every** written entry and improves naming, text and aliases. Emilio: "iterate over our database with a
fresh agent that can fix/improve names and do a scan that does not think about repdb at all — i am a bit afraid that we
might have made choices based only on not being similar to repdb."

## The behaviour

1. **The scanning agent gets our library and nothing about RepDB.** Don't pass it DEC-060..070, the req-138
   originality section, or any RepDB file. Its brief: beginner-first with room for advanced (DEC-067/071), the fixed lists
   (DEC-062), the text rules (req-138 validators), the merge rule (DEC-072).
2. **Scan all 366 written entries** for:
   - **names:** is the shown name the one a gym-goer would use?
   - **aliases:** anything widely typed that's missing, anything wrong or ambiguous;
   - **text:** natural, clear, correct wording. Restore the natural phrasing in any entry that reads stilted: the 19
     rewritten for originality in req-138 are listed in `reports/req-138.md`, but the agent reviews all of them, not only
     those;
   - **tags:** muscles, pattern, equipment, logAs, unilateral, difficulty, staple, family.
3. **Fix in place** (through the source tables, DEC-061). Every change is listed: id | field | before → after | one-line
   reason.
4. **Limits:** no new fields; no reader or screen changes; ids are permanent; the key and alias rules hold; the staple
   set changes only with a reason each.
5. A **coach-eye QA subagent** (planning's) reviews the diff before merge.

## Acceptance criteria

- All validators are green, and the 33 receipts + press/row/machine top-10 hold (changes only under DEC-074, each called out).
- The report lists every change grouped by kind (names, aliases, text, tags), with counts, plus the scanning agent's
  brief (proving it had no RepDB context).
- L-027/L-030 check: every written entry searched by its own shown name comes first; paste the scan result.
- `grep -ci repdb src/library/exercises.json` → 0. Main chunk before/after (baseline 341.64 kB).
- `./check` green; paste the line.
