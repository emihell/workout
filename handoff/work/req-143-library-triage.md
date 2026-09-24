# req-143 — library triage: every rough entry is finished, merged or hidden

**Status: BUILT, NOT merged — branch `req-143`** — Phase 1, data + one search rule. **Gate: functional** (library data, validators, tests, and the search
filter; no stored-data change). Emilio 2026-09-24 (DEC-070): the database must be **up to par** before RepDB is removed
(req-142), then a fresh-eyes agent scans everything (req-141). This req sorts the rough tier. The parity batches
(req-140b…) then finish what it queues. Spec reviewed independently 2026-09-24 (9 findings folded in: §Precise rules).

## Why [measured 2026-09-24 on `main`]

915 entries: 218 fully written (common), **697 rough** (695 free-db + 2 extras: Prone YTW, Reverse Snow Angels) (untagged, free-db names and boilerplate text).
They show behind "Show more". They were never triaged themselves: req-140 only looked at them from RepDB's side (79 free-db ids
queued to promote; the queue's 29 `own-*` adds aren't in the library yet). Reviewer's 60-entry sample [inferred]: of the 618
unqueued, ~80 finish, ~165 merge, ~370 hide. Many aren't worth finishing: strongman (Car Deadlift, Axle Deadlift), dozens of stretches, band/ball
duplicates, oddities (Front Cone Hops).

## The behaviour

1. **Triage every rough entry** into one class, with a one-line reason, judged beginner-first with room for advanced
   (DEC-067), on our own knowledge (no RepDB):
   - **finish:** a real exercise someone would log. Its free-db id goes into the queue
     (`handoff/work/req-140-parity-queue.md`'s promote list; planning appends it from the report). Not written here.
   - **merge:** a near-duplicate of a written entry → **hidden**, with `mergedInto: <targetId>`. Its free-db name becomes
     an alias on the target **only when people actually type it** (DEC-066 §3). Long free-db phrasings don't.
   - **hide:** junk, too niche, or a movement we don't want. Hidden.
   - **merge-later:** a near-duplicate of a queued-but-unwritten entry (a finish id or a queued `own-*`). Hidden now,
     with `mergedInto` pointing at the queued id; the batch that writes the target re-checks it.
   The 79 queued promote ids stay `finish`. Extras are triaged too. The report states the counts; there's no quota.
2. **`hidden: true`** — a new own field (OWN_FIELDS + NEW_FIELDS-style validation: `hidden` ⇒ not common). Hidden entries
   are **never shown in Search** (neither tier nor "Show more"). They **stay in the library** so `libraryEntryFor` still
   resolves a stored exercise that points at one (by libraryId or exact name). Nothing is deleted; ids are permanent.
3. **"Show more" after this** holds only written non-staples + not-yet-finished `finish` entries. The report states how
   many rough entries still show there (the batch queue shrinks it to 0).
4. The triage table (our free-db ids + class + reason) is **committed** in the report. These are ours; no RepDB data.

## Precise rules (spec review 2026-09-24)

- **Fields:** `hidden` and `mergedInto` go in **`OWN_FIELDS` only, never `NEW_FIELDS`** (which rejects its fields on
  non-common entries). Validator: if present, `hidden` is `true` and the entry is neither `common` nor `staple`;
  `mergedInto` needs `hidden` and a target that exists and isn't hidden (for merge: the target is common). They're
  emitted only when set (never `hidden: false`), from the triage file, not from `tags`.
- **Triage file:** `src/library/triage.js`, plain literals returned by an exported function (L-029):
  `{ id, class, target?, reason }`, one row per rough entry. It's the single source; the report pastes the counts and
  points at it. Planning appends the finish ids to the queue from it.
- **One listing rule:** export `listable(entry)` (= not hidden) and filter in **`rankedHits`**, so both search
  functions skip hidden entries. **Rule: hidden = never offered anywhere** (req-134 browse, req-135 alternatives and
  req-132 Add inherit it).
- **Exception: exercises the user already has.** A hidden entry that matches one of the user's stored exercises (live or
  archived, via `libraryItemMatch`) **still shows in Search** with Already added / Restore, so owning one never
  becomes "No matches" **(unconfirmed)**.
- **Resolver unchanged:** `libraryEntryFor` keeps name → displayName → alias. Redirecting a stored exercise to its
  `mergedInto` target is req-132's (the live link) and the DEC-063 §2 conversion's job.
- **Invariant tests (reading nothing from `handoff/`):** every non-common entry has exactly one triage row; every
  non-common entry that isn't hidden is `finish`; the 79 queued ids are `finish`; no `finish` row is hidden. There's no
  `finish ⇒ non-common` assertion, since batches promote them later.
- **Alias additions:** run the L-027 check (10+ real queries, before/after top hits read by eye) and paste it.

## Scope

`src/library/` (a triage data file), `src/exerciseLibrary.js` (`hidden` field + validator), `src/exerciseCatalog.js`
(search skips `hidden`), regenerated `exercises.json`, tests.

## Out of scope

Writing any finish entry (the batches). Removing RepDB (req-142). Shipping only our schema: the readers (search muscle
matching, `catalogItemToExercise`) still read free-db's legacy fields, so that moves to **req-132** where the Add path
switches to our fields (DEC-063 §3). Renaming written entries (req-141).

## Acceptance criteria (written before implementation)

- **Complete:** every one of the 697 rough entries has exactly one class; the counts are in the report. The table is
  committed.
- **Hidden:** a hidden entry never appears in `searchCommonFirst`'s `common` or `rest` (test over all hidden ids with their
  own names as queries). `libraryEntryFor` still resolves a hidden entry by libraryId and by exact name (test).
  `hidden ⇒ !common` (validator + fixture).
- **Merge aliases:** searching a merged entry's free-db name shows the written target first (test, 20 samples listed).
  The key rules hold; press/row/machine top-10 and the 33 receipts unchanged.
- **Examples (test):** "car deadlift" and "front cone hops" return no hits, if hidden. Any non-hidden result is justified
  in the report.
- **Sanctioned test edits (keep each one's intent, move it to a non-hidden entry or query):** `req-139.test.js:117-121`
  (air bike → `rest[0] === 'Air_Bike'`); `:103-107` (Shoulder Press - With Bands in rest); `:130-137` ("press" cap/count:
  use a query whose rest is still > 25 after triage); `:136` (restCount vs the flat search, which now also skips hidden);
  the car-deadlift receipt. Everything else stays unedited.
- Provenance sha test green; `grep -ci repdb exercises.json` → 0; L-026 main chunk before/after (baseline 340.97 kB).
- `./check` green; paste the line. Existing tests are unedited except the car-deadlift receipt in `req-139.test.js`
  and the edits listed above.

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: up to par before RepDB goes; triage; images are their own req.
- **(unconfirmed)**: hidden entries leave Search entirely, except ones the user already has; merge = hide + `mergedInto`,
  with an alias only when it's really typed; merge-later; "ship only our schema" moved to req-132.
