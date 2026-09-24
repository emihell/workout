# req-151 — library batch 5 (last): the rest of the parity queue, written or hidden

**Status: BUILT AND MERGED, 2026-09-24 — branch `req-151` (`eaeafab`…`9077e19`, 2 commits).** — Phase 1, **data only**. **Gate: functional**. It's a follow-on batch under req-140's spec (DEC-066 §2),
so its rules, validators and receipts apply unchanged. Emilio 2026-09-24: "yes lets finish this". It uses the lighter
process (planning, 2026-09-24; batches 2–4 = req-145, req-147, req-148): no separate spec review, since it reuses req-140's reviewed spec; a coach QA of the
written entries before merge.

## The behaviour

1. Take **≤40** ids from `handoff/work/req-140-parity-queue.md`, both the promote lists (free-db ids, including the ones
   req-143 added) and the add list (queued `own-*`, incl. `own-kettlebell-deadlift`, `own-lateral-band-walk`). Rank them by
   how widely they're done in gyms, **beginner-first** (DEC-067/071).
2. **No checkpoint stop:** the queue is already agreed. Report the chosen 40 (id → shown name [staple yes/no]) in the report.
3. Write each one fully, exactly as req-140 phase 2: tags, displayName where needed, req-138 text, `difficulty`, `staple`
   as judged (a real commercial-gym staple, or behind "Show more"). A promoted id keeps its id. Remove a written
   `own-*` from `PENDING_ADDS` in `triage.js`. Re-check the `merge-later` rows that point at a written id: they now redirect
   (DEC-072 §2).
4. Apply the queue's **batch notes** (Alternating_Renegade_Row → dumbbells; Weighted_Sissy_Squat → "Sissy Squat",
   bodyweight-reps; Plate_Twist → "Weighted Russian Twist", weight-reps).
5. **No new fields** (req-144 decides those). No reader or screen changes.

## Acceptance criteria

- All req-133/138/140/143 validators are green. The DEC-072 merge rule holds for re-pointed merge-later rows.
- The report lists the 40, the difficulty counts, the staple count and the queue remainder. Planning removes the 40 from
  the queue file.
- Originality `--runs-only` = 0. `grep -ci repdb exercises.json` → 0. L-026 main chunk before/after (baseline 341.24 kB).
- Sanctioned test edits: DEC-074 standing sanctions, each called out.
- `./check` green; paste the line.

## Batch 5 specifics (the last batch)

- **Empty the queue:** each of the remaining 34 is either written, or **re-triaged to hide** with a one-line reason.
  Beginner-first (DEC-067/071): hide what adds risk or noise without serving beginners or typical intermediates. That's
  at least the **behind-the-neck presses and pulldowns** (a known shoulder-risk position). Donkey calf raise, neck
  harness work and rare Olympic variants are the builder's judgement. Advanced staples of real calisthenics (L-sit,
  archer push-up/pull-up, levers) may stay, marked advanced.
- `PENDING_ADDS` ends empty, and every merge-later row is resolved (merge or hide).
- **Up to par check (DEC-070 §1), in the report:** re-run the gap script's counts against the pinned RepDB list. Every
  RepDB name is now covered by a written entry, an alias, a redirect, or a recorded skip/hide. Paste the counts. Show-more
  holds 0 rough entries.
