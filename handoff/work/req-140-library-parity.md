# req-140 — library parity: everything RepDB covers, done better by us, plus our own difficulty

**Status: READY** — Phase 1, **data only**. **Gate: functional** (library data + validators + tests; no reader, screen or
stored-data change). Emilio 2026-09-24 (DEC-065): "our database has to have everything it has but better"; RepDB is kept
**only** for its pictures (req-131). Followed by **req-141**, a fresh-eyes audit of the whole library by an agent that knows
nothing about RepDB.

## Why [measured]

- About 499 of RepDB's 601 exercise names are neither a name nor an alias in our library (req-130/139 reviews). Many are
  variants we cover, or niche moves, but some are real gaps: 10 of 40 staples were missing before req-139.
- RepDB carries a difficulty level. free-db's `level` is dropped from use (DEC-064 §6: arbitrary, mostly "beginner").
  Training goals and German/Spanish are **not** matched (DEC-065 §2).

## The behaviour

**Phase 1: gap table. STOP and report before authoring.**
1. A script lists every RepDB exercise (English name, pinned sha `9ed9357f09c7566ea0256c57ebd6374ebb8b575e`, cached
   **outside** the repo) whose `catalogNameKey` matches no name, displayName or alias in our library.
2. Classify each one, with a one-line reason:
   - **covered:** the same movement exists in ours; an alias is enough (name the entry).
   - **add:** a real, distinct exercise we lack.
   - **skip:** a duplicate, a non-exercise, a stretch we don't want, or so niche it adds noise.
3. The report pastes the table (counts per class + the full lists) and the planned `add` list, grouped by pattern.
   **Stop there and report to planning.** Planning (and Emilio if he wants) trims the list; then phase 2 runs on the agreed
   list.

**Phase 2: authoring, on the agreed list.**
4. **covered** → add the alias to the named entry (the key rules from req-133/139 hold).
5. **add** → a new `own-*` entry, **fully ours**: legacy fields, tags (muscles/pattern/equipmentList/logAs/unilateral/
   family), displayName where needed, text (description/formCues/steps/mistakes). Every add is `common` (only common
   entries may carry these fields, `NEW_FIELDS`). Written from general training knowledge; RepDB contributes **only the
   fact that the exercise exists**. No RepDB text, and its names only where the name is simply the exercise's standard name.
6. **Difficulty** — a new own field `difficulty` ∈ `beginner` `intermediate` `advanced` on **every common entry**
   (existing + new), our judgement of skill, coordination and setup demands, **not** strength needed. Add it to
   `OWN_FIELDS` + `NEW_FIELDS`, with a validator. As guidance: most machines and supported moves are beginner; free-weight
   compound barbell lifts and unsupported unilateral moves are intermediate; Olympic lifts, advanced calisthenics and
   high-skill balance moves are advanced.

## Originality: the lighter rule from now on (DEC-065 §3)

Drop the 4-gram-share gate. It pushed normal gym English away from its natural wording. Keep **only** the long-run check:
flag any line of ours sharing a contiguous run of **≥12 tokens** with any RepDB sentence, and rewrite only those. Run it
after writing; it prints our lines only. Paste the count.

## Scope

`src/library/own-exercises.js`, `common.js`, `text.js` (new entries, aliases, difficulty), `src/exerciseLibrary.js` (field
+ validator; `COMMON_COUNT_RANGE`), `scripts/originality.mjs` (run in long-run-only mode), the gap script (a new
script, not committed with RepDB data), the regenerated `exercises.json`, and tests.

## Out of scope

Rewriting existing entries' text or names (that's req-141). Reader or screen changes. Training goals, translations.
Pictures. Non-common free-db entries.

## Acceptance criteria (written before implementation)

- **Phase 1 checkpoint:** the gap table is reported before any `add` entry is written. The report shows the checkpoint
  message and planning's reply.
- **Every agreed add** exists, is common, and passes all req-133/138 validators. Every agreed `covered` alias resolves:
  searching that RepDB name finds the named entry first (a test over a sample of 20, listed).
- **Difficulty** is on every common entry, from the list only; the validator has a failing fixture. The report gives
  counts per level and lists the `advanced` entries.
- `COMMON_COUNT_RANGE` is updated to the new count ± a margin (sanctioned edit), and the entry-count test → the new N own-*
  (sanctioned).
- **Long-run check:** 0 lines with a run of ≥12 tokens after rewrite; the count before/after is pasted.
- Provenance sha test green; `grep -ci repdb src/library/exercises.json` → 0; the gap script's RepDB cache is not in git
  (`git ls-files | grep -ci repdb` → only code, no data).
- L-026: main chunk before/after (baseline 340.97 kB).
- `./check` green; paste the line. Existing tests unedited except the sanctioned ones (called out).

## Decisions made on Emilio's behalf

- confirmed 2026-09-24 ("sounds good"): parity "but better"; difficulty yes, goals no, translations no; the lighter
  originality rule; RepDB for pictures only; a fresh-eyes audit next.
- **(unconfirmed)**: every add is common; difficulty measures skill, not strength; the skip criteria.
