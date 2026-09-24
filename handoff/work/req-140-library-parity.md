# req-140 — library parity, batch 1: our own entries for what RepDB covers and we don't, plus our own difficulty

**Status: READY** — Phase 1, **data only** + one search-tier rename. **Gate: functional** (library data, validators, tests,
and one line in the search split; no screen or stored-data change). Emilio 2026-09-24 (DEC-065, DEC-066): "our database has
to have everything it has but better", done **in batches of ≤40**, with **staples first and the rest behind "Show more"**.
RepDB is kept only for its pictures (req-131). Spec reviewed independently 2026-09-24 (8 findings folded in). Followed by
req-140b… batches, then **req-141**, the RepDB-blind fresh-eyes audit.

## Why [measured 2026-09-24 on `main`, reviewer]

- **401** of RepDB's 601 names match none of our names, displayNames or aliases (`catalogNameKey`). 50 more match only a
  non-common free-db entry. By category: strength 312, stretching 74, olympic 8, cardio 5, plyometrics 2.
- From a 58-name sample: ~45% are already covered, ~22% are real gaps, ~33% are skips. Scaled up, that's about 90 new
  entries plus some promotions. That's too many for one reviewable branch, so they go in batches.
- free-db's `level` is dropped from use (DEC-064 §6).

## New concept: `staple` (DEC-066 §1)

`common` has meant two things: "fully written by us" (the only gate for tags and text, `NEW_FIELDS`) and "ranks first in
Search" (req-139). They split now:
- **`common: true`** = fully written (tags, text, difficulty). Every entry this req writes is common.
- **`staple: true`** = a standard commercial-gym exercise that ranks in Search's first tier. All 178 current common entries
  get `staple: true`. A new entry gets it only if it is a real staple.
- `searchCommonFirst` splits on **`staple`** instead of `common` (the only reader change). `staple` implies `common`
  (validator).

## Phase 1: gap table, then STOP

1. A gap script (committed on `req-140`; it reads RepDB's `name_en` only, nothing else) takes RepDB at the pinned sha
   `9ed9357f09c7566ea0256c57ebd6374ebb8b575e`, cached **outside** the repo, and lists every name that matches none of our
   name/displayName/alias keys.
2. Classify each one (one-line reason, judged on our own knowledge, not RepDB's other fields):
   - **covered + alias:** the movement exists in a common entry, and this name is one people actually type. Add it as an
     alias. **Not** for RepDB's own long phrasing ("One Arm Kettlebell Floor Glute Bridge Press") — no bulk import of
     their name list (DEC-064 §1).
   - **covered, no alias:** the movement exists; nothing is added.
   - **promote:** the movement exists as a **non-common free-db entry**. That id becomes common (tags, text, difficulty),
     keeping its id. An `own-*` add is **forbidden** when a free-db entry is the same movement.
   - **add:** a real, distinct exercise we lack → a new `own-*`.
   - **skip:** a duplicate, a yoga/pilates pose, a non-exercise, or too niche.
3. **Batch 1 selection:** ≤40 promote+add in total, ranked by how widely they're done in gyms. Mark each one `staple`
   yes or no. The rest become the queue for later batches.
4. **Where it goes:** the **full table** stays outside the repo (`<cache dir>/req-140-gap.txt`) and goes in the SendMessage
   to planning. It never goes in git (RepDB licence term 3: no derived dataset). The committed report carries **counts,
   our batch-1 list under our own names, and the 20-name alias sample** only.
5. **Stop:** SendMessage planning with the counts, the path, the proposed batch-1 list (promote/add, staple yes/no) and
   the proposed aliases. End the turn. **Continue only on a planning reply that contains the agreed lists verbatim.**
   Silence, or "wait", means stay stopped.

## Phase 2: authoring, on the agreed lists

6. Aliases, promotions and adds as agreed. Everything is fully ours: legacy fields on own-*, tags, displayName where
   needed, text (req-138 validators), difficulty. Written from general training knowledge; RepDB contributes only the fact
   that an exercise exists. Aliases go on **common entries only**.
7. **Difficulty:** a new own field `difficulty` ∈ `beginner` `intermediate` `advanced` on **every common entry**. It goes
   in `OWN_FIELDS` + `NEW_FIELDS` **and must be emitted in `withOwnFields`** (`exerciseLibrary.js:411-429` copies named
   tags only). It judges skill, coordination and setup, not strength. It is set without RepDB's same-named field, which
   the gap script never reads. Anchors, pinned in a test:
   - **beginner:** Leg Press, Lat Pulldown, Plank, Seated Leg Curl
   - **intermediate:** Back Squat, Deadlift, Walking Lunge, Pull-Up
   - **advanced:** Power Clean, Pistol Squat
   - Own-* legacy `level` is legacy and never read; new own-* entries set `level` equal to `difficulty`.

## Originality: the lighter rule (DEC-065 §3)

Only `scripts/originality.mjs` **Measure 2** counts: any line of ours sharing a contiguous run of ≥12 tokens with a RepDB
description sentence, instruction or tip. Tokens: `toLowerCase().match(/[a-z0-9°]+/g)`. Add a `--runs-only` flag that
skips Measure 1. The baseline is 0; report the count after writing. It must be 0, and any hit is rewritten.

## Sanctioned test edits (exactly these)

- `req-138.test.js:29` (`common.length === 178`) and `:168` (`oneSided.length === 19`) → the new counts.
- `req-139.test.js:141-149`: the `rdl` exact id list, and `firstShown('ring') === 'Suspended_Row'`. Update these **only if
  a new entry is the reason**, named in the report.
- `COMMON_COUNT_RANGE` in source → the new count ± a margin.
- Every other existing test is unedited, including the other 32 top-1 receipts and press/row/machine.

## Scope

`src/library/own-exercises.js`, `common.js`, `text.js`; `src/exerciseLibrary.js` (difficulty, staple, validators);
`src/exerciseCatalog.js` (the split reads `staple`); `scripts/originality.mjs` (`--runs-only`); a new gap script; the
regenerated `exercises.json`; tests.

## Out of scope

Later batches (the queue). Rewriting existing entries (req-141). Screens. Training goals, translations. Pictures.

## Acceptance criteria (written before implementation)

- **Checkpoint:** the batch-1 lists are reported before any entry is written. The report quotes planning's agreeing reply.
- **Batch 1:** every agreed promote/add is common, carries `staple` as agreed, and passes all req-133/138 validators. No
  `own-*` duplicates a free-db movement. The 20-alias sample: `searchCommonFirst`'s first shown hit is the named entry
  (test).
- **staple:** all 178 prior common entries are staples. `staple ⇒ common` (validator + fixture). The req-139 receipts
  hold with the split on `staple`. Test: a common non-staple hit shows only behind "Show more".
- **difficulty:** on every common entry, from the list only. The anchors hold (test). Counts per level in the report, and
  the advanced list.
- **Originality:** Measure 2 = 0 (pasted).
- **Licence hygiene:** `grep -ci repdb src/library/exercises.json` → 0. The committed report holds no RepDB name list
  beyond the 20-name sample. The RepDB cache and the full gap table are not in git (`git ls-files` shows only the script).
- L-026: main chunk before/after (baseline 340.97 kB).
- `./check` green; paste the line.

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: parity "but better"; difficulty yes, goals/translations no; the lighter originality rule; staples
  first with the rest behind Show more; batches of ≤40.
- **(unconfirmed)**: the difficulty anchors; the skip criteria (yoga/pilates poses out); aliases only when people really
  type them; promote-before-add.
