# req-138 — library text pass: description, form cues, steps and mistakes for the common exercises

**Status: READY** — Phase 1, **data only**. **Gate: functional** (library data + validators + tests; no reader, screen or
stored-data change). Split from req-133 by its spec review; moved before the browse screen by DEC-064 §4. Emilio
2026-09-24: "improve text if needed". Feeds req-134 (browse can show the description) and req-131 ("How to").

## Why [measured 2026-09-24 on `main`]

The 178 common entries carry only free-db's `instructions`, averaging ~724 characters of boilerplate ("This will be your
starting position", "Repeat for the recommended amount of repetitions"). That's too long to read between sets, and it
has no short cues and no common mistakes. RepDB has descriptions and tips, but we write our own (DEC-060 §3).

## The behaviour (data)

1. **Four own fields on every common entry** (appended to `OWN_FIELDS`; free-db's `instructions` stays byte-unchanged
   underneath, so the provenance test holds):
   - `description` — one sentence: what it is and what it trains. ≤120 characters.
   - `formCues` — 2–3 short in-gym reminders, each ≤70 characters ("Elbows under the bar", "Drive through the whole
     foot"). Named `formCues`, **not** `cues`, so it can't be confused with the stored `exercise.cues` (req-133 review).
   - `steps` — 3–6 numbered-in-order instructions, each ≤140 characters: setup → movement → finish.
   - `mistakes` — 1–3 common errors, each ≤90 characters, phrased as the error ("Hips rise before the chest").
2. **Style:** plain English, second person, imperative, no filler. Say what to do, not why it's great. **No numbers the
   app would be inventing:** no weights, rep or set prescriptions, and no tempo counts, except where a count *defines*
   the movement (e.g. "pause at the top" is fine; "3×10" is not). No medical or injury claims ("prevents back pain").
   Unilateral entries say "each side" where it matters.
3. **Sources:** free-db's own instructions (public domain; rewrite, correct and shorten them freely) + general training
   knowledge. **Never RepDB text:** don't open RepDB descriptions/tips/instructions while writing (DEC-060 §3).
4. **own-* entries:** their legacy `instructions` may be rewritten to match `steps` (they're ours).
5. **Non-common entries:** untouched.

## Scope

The content source under `src/library/` (a data file per DEC-061's amendment), `src/exerciseLibrary.js` (field list +
validators), regenerated `exercises.json`, tests. **Not** `exerciseCatalog.js`, views or `catalogItemToExercise`: saving
our text on add is req-132's (DEC-063 §3). Batching the writing across agents is the builder's call.

## Out of scope

Any reader/screen change. Non-common entries. Swedish. Pictures. Changing tags or names (report any tag error found
while writing as a list for req-136 rather than fixing it here, unless it's a one-line obvious fix, which you call out).

## Acceptance criteria (written before implementation)

- **Complete:** every common entry has `description`, 2–3 `formCues`, 3–6 `steps`, 1–3 `mistakes`, all within the length
  caps. Test (a failing fixture per rule).
- **No boilerplate:** a test rejects free-db stock phrases in our fields ("This will be your starting position",
  "Repeat for the recommended amount", "as you breathe in", "as you exhale") and empty or duplicate lines within an entry.
- **No invented prescriptions:** a test rejects set×rep patterns (`\d+\s*[x×]\s*\d+`), "reps"/"sets" with a number, and
  kg/lb amounts in our fields.
- **Originality receipt (one-off, not a test):** a script run after writing compares every sentence in our four fields
  against the live RepDB English text (descriptions, tips, instructions) and against free-db's instructions. The report
  pastes: sentences with ≥0.8 token overlap vs RepDB → **0** (any hit rewritten); overlap vs free-db → informational.
- **Provenance untouched:** the stripped-`OWN_FIELDS` sha test is green; `grep -ci repdb src/library/exercises.json` → 0.
- **Review dump:** the report includes 25 entries in full, spread across patterns (every pattern with a common entry at
  least once), plus the 22 staples everyone knows (bench, squat, deadlift, pull-up, row, OHP…) in full.
- **Sizes (L-026):** main chunk before/after (must not grow beyond noise); library chunk before/after.
- Existing tests unedited except `OWN_FIELDS`-list assertions if any (called out). `./check` green; paste the line.

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: our own text, better than the source, never RepDB's (DEC-060 §3, DEC-062 §4).
- **(unconfirmed)**: the four fields and their caps; the name `formCues`; no tempo/rep numbers; no medical claims;
  non-common entries left for later.
- implementation: file format, batching, validator shape, the overlap script — builder's call.
