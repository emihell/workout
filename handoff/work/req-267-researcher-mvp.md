**Status: NEEDS DECISIONS** · **Lane: design** · DEC-145 (roles), DEC-149 (EVIDENCE.md), DEC-150 (book notes), DEC-151, DEC-155 (fixes first). Not now: after the fix batch (Emilio, 2026-10-31: "we will not build this now, but we will aim for an mvp of it soon").

# req-267 — Researcher MVP: keep Coach current with checked science

## Open questions (Emilio) — answer each; then this req → `DECIDED` + a build req

1. **Scope of the MVP.**
   (a) *Coach-driven* — start from EVIDENCE.md's 17 topics + the questions Coach raises in a run; a new domain enters when
   Coach needs it. **Recommended:** Coach uses ~17 topics today; all 20 domains is thousands of papers to verify, most unused.
   (b) All 20 domains of the brief up front.
2. **Where the research lives and who writes it.** `handoff/` is Planner-only (CLAUDE.md), Coach writes outside git (DEC-145).
   (a) *Researcher writes a proposal outside the repo* (`workout-data/research/`), Planner reviews it and merges the checked
   result into git (records + syntheses under `handoff/researcher/`, EVIDENCE.md stays Coach's short cited summary).
   **Recommended:** same review gate as every other role; nothing unreviewed reaches Coach.
   (b) Researcher writes straight into `handoff/` (breaks the Planner-only rule).
   (c) A database on the server.
3. **Cadence.**
   (a) *On demand* (Coach's open questions, a new goal) **+ one sweep a month** for new reviews on the existing topics.
   **Recommended.** (b) Weekly. (c) On demand only.
4. **The three book notes** (DEC-150, `workout-data/coach/books/`).
   (a) *Keep them as "coach experience", add no new books*; the Researcher checks their claims against research over time.
   **Recommended:** already made, cheap to keep, research already wins a conflict (DEC-150). (b) Retire them now.
5. **Who approves a change to what Coach cites.**
   (a) *Planner merges; Emilio sees a short "what changed in the evidence" list after each sweep* and can veto. **Recommended.**
   (b) Emilio approves every change first.

## Why

Emilio: "i have an idea for a researcher as well, instead of saving books, and to keep our coach up to date with the latest
scientific data on the hu man body/mind and excersice". Today EVIDENCE.md (118 lines, 17 topics) was built once by a
research agent (DEC-149) and is not refreshed. Emilio's brief: `handoff/researcher/EMILIO-BRIEF-2026-10-31.md`.

## MVP scope (as recommended; changes with the answers)

1. `handoff/researcher/RESEARCHER.md` — the role brief, derived from Emilio's brief, keeping its rules:
   evidence hierarchy (§3, not absolute); levels HIGH…INSUFFICIENT / GRADE (§5); each record marked full text / abstract /
   metadata only (§6); retraction/correction check and DOI verification (§9); "Not reported", never invented (§4);
   finding vs interpretation vs practical advice kept apart (§11); no medical diagnoses (§8).
2. **Records**: one per paper, a subset of §4's fields — ID, title, authors, year, journal, DOI, PMID, URL, OA, study type,
   population, n, duration, main finding (own words), effect size if reported, limitations, access level, verified date,
   retraction status, topic(s). Metadata + own summaries only — no abstracts or full texts (copyright, §6).
3. **Syntheses**: one per topic, §7's shape, every claim citing record IDs. EVIDENCE.md becomes the short layer generated
   from the syntheses' practical recommendations, so Coach's file stays small.
4. **First run**: re-verify EVIDENCE.md's existing sources into records (DOI resolves, not retracted, superseded?) and write
   syntheses for 3 topics Coach uses most (proposed: weekly volume, effort/RIR, progression).
5. **Run report**: what was added, changed, superseded, retracted; what remains uncertain.

## Out of scope (MVP)

- The dashboard (§10) — later, once records exist (an Artifact page or a script).
- The 20-domain discovery (§12 phase 2) — grows from Coach's questions.
- Nutrition beyond what Coach cites today — that belongs with the Nutritionist (BACKLOG §Phase 3).
- Any app change.

## Acceptance criteria (for the build req that follows)

1. RESEARCHER.md exists; each rule above is in it with its brief § reference.
2. Every record's DOI resolves (receipt: the resolver output per DOI); retraction status checked for each, with the source.
3. **Failure case — unverifiable:** a source whose DOI doesn't resolve or whose claim isn't in the abstract is marked
   unverified and never cited in a synthesis or EVIDENCE.md (test: one deliberately bad DOI in the run → shows unverified).
4. **Failure case — access honesty:** no record marked "full text" without a full-text URL that was opened.
5. 3 syntheses; every claim cites a record; Planner spot-checks 3 claims against the source.
6. EVIDENCE.md's existing claims all still trace to a record (or are marked superseded/removed with the reason).

## Decisions made on Emilio's behalf

None yet — every behaviour question is in "Open questions" above.

## Siblings

Coach workflow audit (BACKLOG §Phase 3) — read the audit's findings before RESEARCHER.md is written. Nutritionist
(BACKLOG §Phase 3) shares the nutrition domain.
