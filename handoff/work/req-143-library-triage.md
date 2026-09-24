# req-143 — library triage: every rough entry is finished, merged or hidden

**Status: READY** — Phase 1, data + one search rule. **Gate: functional** (library data, validators, tests, and the search
filter; no stored-data change). Emilio 2026-09-24 (DEC-070): the database must be **up to par** before RepDB is removed
(req-142), then a fresh-eyes agent scans everything (req-141). This req sorts the rough tier. The parity batches
(req-140b…) then finish what it queues.

## Why [measured 2026-09-24 on `main`]

915 entries: 218 fully written (common), **697 rough** free-db entries (untagged, free-db names and boilerplate text).
They show behind "Show more". They were never triaged themselves: req-140 only looked at them from RepDB's side (108
queued to promote). Many aren't worth finishing: strongman (Car Deadlift, Axle Deadlift), dozens of stretches, band/ball
duplicates, oddities (Front Cone Hops).

## The behaviour

1. **Triage every rough entry** into one class, with a one-line reason, judged beginner-first with room for advanced
   (DEC-067), on our own knowledge (no RepDB):
   - **finish:** a real exercise someone would log. Its free-db id goes into the queue
     (`handoff/work/req-140-parity-queue.md`'s promote list; planning appends it from the report). Not written here.
   - **merge:** a near-duplicate of a written entry. Its free-db name becomes an **alias** on that entry (the key rules:
     it may shadow a non-common name), and the entry is **hidden**.
   - **hide:** junk, too niche, or a movement we don't want. Hidden.
   The 108 already queued stay `finish`. Target: the report states the counts; no quota.
2. **`hidden: true`** — a new own field (OWN_FIELDS + NEW_FIELDS-style validation: `hidden` ⇒ not common). Hidden entries
   are **never shown in Search** (neither tier nor "Show more"). They **stay in the library** so `libraryEntryFor` still
   resolves a stored exercise that points at one (by libraryId or exact name). Nothing is deleted; ids are permanent.
3. **"Show more" after this** holds only written non-staples + not-yet-finished `finish` entries. The report states how
   many rough entries still show there (the batch queue shrinks it to 0).
4. The triage table (our free-db ids + class + reason) is **committed** in the report. These are ours; no RepDB data.

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
- Provenance sha test green; `grep -ci repdb exercises.json` → 0; L-026 main chunk before/after (baseline 340.97 kB).
- `./check` green; paste the line. Existing tests are unedited except the car-deadlift receipt in `req-139.test.js`
  (sanctioned if it's hidden: the "no common hit → rest shows directly" case moves to a non-hidden rough entry).

## Decisions made on Emilio's behalf

- confirmed 2026-09-24: up to par before RepDB goes; triage; images are their own req.
- **(unconfirmed)**: hidden entries leave Search entirely (not just "Show more"); merge = alias + hide; "ship only our
  schema" moved to req-132.
