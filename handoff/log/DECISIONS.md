# Decisions

Append-only, newest at the bottom. One entry per decision that a user could notice or
that constrains future work. Supersede rather than edit — a later entry can overturn an
earlier one, but the earlier one stays.

**Layout (req-271, DEC-155 §8).** This file is the entry point: the **digest** below (what's live) and the generated
**index** at the bottom (one line per DEC: date · title · status). Full entries live in `log/decisions/DEC-001-050.md`,
`DEC-051-100.md`, … (50 per file). Append a new DEC to the newest range file; `./plan save` regenerates the index
(`scripts/dec_index.py`), and `check_handoff.py` refuses a dangling DEC reference, a stale index, or a superseded DEC in
the digest. Never hand-edit the index.

Format:

```
## DEC-001 — short title  (YYYY-MM-DD)
What was decided, in one or two lines. Who decided it (Emilio, or the planning session
on his behalf — mark "unconfirmed" if it was a default he hasn't ratified). Why, and
what was rejected. Cross-ref the req if there is one.
```

---

## Current rules digest

The live operational rules, each pointing at its current DEC. The entries below are the
append-only **archive**; this digest is where to find what is *currently* true. Any entry a
later DEC replaced carries a `> SUPERSEDED` marker at its top. Refreshed 2026-10-31 through DEC-155.

**Process**
- **Merge gate** — planning tests everything it can reach (unit receipts + its own browser run on an isolated origin) and
  merges on that; carve-outs: a real migration/bulk rewrite (Emilio's eyes + a fresh Export first) and the independent
  reviewer. → **DEC-035**, **DEC-046**
- **Reviewer trigger** — follows the files a req touches (the list in WORKFLOW check 5 and `plan`'s REVIEWER_TRIGGER_RE),
  not its lane; a SHIPPED gate line quotes `./check`'s output and names the reviewer. → **DEC-057** §1, §4
- **A question isn't a decision**; calls made on Emilio's behalf that a user would see are marked `(unconfirmed)` and go
  on his list. → **DEC-057** §2–3
- **Build** — one throwaway agent per req from `./plan brief`, serial; Planner reviews, merges, and stops at every
  closeout (CLEAN POINT); a live Builder only for feel work; Emilio runs deploys on the server. → **DEC-144**, **DEC-055**,
  batch mode **DEC-047**; lanes **DEC-085** §6
- **Priority** — fixes, review/audit findings, tooling, workflow, structure and cleanups go before any new feature; an
  architectural change is finished before new work. → **DEC-155** §1, §7, **DEC-143**
- **Planner autonomy** — if Planner can do it (incl. what a phone-size screenshot shows), it does it, no asking; Emilio
  gets behaviour calls and feel. → **DEC-094**, **DEC-095**, **DEC-091**
- **Isolation boundary** — planning never touches code, code never touches planning; planning owns planning-worktree git
  (via `./plan save` only, L-032), `publish` and `closeout`. → **DEC-005**, **DEC-008**, **DEC-026**
- **Merge shape** — every req reaches `main` via `--no-ff` (pre-push guard). → **DEC-045**
- **No auto-memory** for either session; licensed third-party data only in a gitignored dir. → **DEC-068**
- **Page feedback** — checked against `reference/PAGES.md`; only a clash with an Emilio (E) decision needs him. → **DEC-137**
- **Session boot** — planning reads `handoff/PLANNING.md` directly. → **DEC-044**
- **Audits 2026-09-24** — all recommendations taken (req-156..160, planning docs, Emilio's actions). → **DEC-085**

**Data & trust**
- **History is the source of truth** — never invent data: the workout's kg comes from the routine the user set, prefilled
  from history when added and updated by a confirmed offer (**DEC-096**); other prefills come from finished-workout data; a
  routine with no kg carries the kg just entered; never invent warm-up reps; hold with no valid increment. → **DEC-002**,
  **DEC-022**, **DEC-030**
- **Carry** — a changed weight carries to the remaining sets, reps never do; an added set with nothing logged stays blank,
  never the routine's number. → **DEC-052**, **DEC-082** §2
- **"Last time"** skips a workout where the exercise was entirely skipped (working sets decide). → **DEC-053**
- **The routine is never updated automatically at Finish**; updating it is a deliberate step. → **DEC-056**
- **Progression** — no new rules until req-149; an unreadable target (range, AMRAP, text) or an assisted exercise holds.
  → **DEC-075**, **DEC-076**
- **Persisted-data safety** — never overwrite an unreadable key (`workout-mvp-v9`; older keys read for migration);
  announce a migration + record count, add a survives-upgrade test; Export before a persisted-data merge. → **DEC-032**,
  **DEC-046** + CLAUDE.md ask-gate #2 (req-157 refines the unreadable-state Import, DEC-085 §2)
- **Numbers** — a comma is a decimal point everywhere a number is typed; "current" workout = started today or within 6 h;
  the Today hero keeps the day's other routines; an empty Finish warns. → **DEC-058**, **DEC-059**

**UI**
- **No native dialogs** — every confirm is the in-app sheet, its action button named for the action; errors are in-page.
  → **DEC-079**, **DEC-080**, **DEC-083**
- **Multi-entry screens** return via `?from=`; a stale `from` falls back to the fixed parent (req-263). → **DEC-092**,
  **DEC-155** §6
- **Back** — `go(…, {replace:true})` replaces the browser entry too; an old in-workout page with no active workout
  redirects to its overview; the dead first Back after finishing an exercise is parked. → **DEC-081**/**DEC-082** §1,
  **DEC-084**
- **Rest** is informational, never a control surface; the next set is live during rest. → **DEC-048**
- **One in-progress workout** — starting a new one abandons the old (with the confirm). → **DEC-038**
- **"You beat last time"** — per exercise, any axis. → **DEC-050**
- **Nav vocabulary** — navigation wears link treatment + §4 verbs, actions wear Button; Back = logical parent; routes may
  carry `?from=`. → **DEC-042**, **DEC-040**, **DEC-039**, **DEC-051**
- **Nav structure** — floating bottom menu (Workout oval + icon-only circles). → **DEC-036**
- **Platform** — mobile is primary; the live workout is mobile-only. → **DEC-010**
- **Styling foundation** — minimal, colorless, Apple-inspired component library + a fixed type scale. → **DEC-017**,
  **DEC-020**
- **Phone-test gate** — local `vite preview` over Tailscale; per-branch previews move to the server setup (req-146).
  → **DEC-041**

**Exercise library**
- Our own library, generated (never hand-edited), a three-level muscle tree, one movement pattern, "common" first; RepDB
  removed; content calls delegated (beginner-first). → **DEC-060**..**DEC-070**, **DEC-072**, **DEC-077**, **DEC-078**

**Server & sync**
- **Own server**, offline-first phone, invite-only, tailnet-only; GitHub Pages shut down. → **DEC-127**, **DEC-128**,
  **DEC-135**
- **Sync never loses data silently** — a value a merge drops is kept in the server's conflict record, on every path; a
  finished workout is never kept in progress. → **DEC-155** §8–9 (req-268), **DEC-133**

**Coach**
- **Coach is a role** with its own brief; builds only what the app can run (a gap → a req); plans enter the DB through one
  apply tool; client facts stay outside git. → **DEC-140**, **DEC-141**, **DEC-145**, **DEC-146**
- **Evidence** — Coach cites checked sources (`coach/EVIDENCE.md`); research beats book notes. → **DEC-149**, **DEC-150**
- **Coach-estimate kg** — allowed, labelled in the backend only. → **DEC-153**

**Product direction**
- **Design for the complete beginner first**; the simple routine is the core. → **DEC-071**
- **Toward a real product** — other users soon, training together; backend on Emilio's own server (req-146, waiting). →
  **DEC-073**, **DEC-075** §2

---

## Decision index

Generated by `python3 scripts/dec_index.py` from `log/decisions/*.md` — don't edit it; `./plan save` regenerates it.
One line per DEC: id · date · title · status (from a `> SUPERSEDED by …` / `> AMENDED by …` marker at
the entry's top; an amendment written only in prose stays `live`). The full entry is in the range file above it.

### decisions/DEC-001-050.md

- DEC-001 · 2026-09-07 · a failed save shows a persistent banner · live
- DEC-002 · 2026-09-07 · no-history exercise carries entered kg + reps to later sets · live
- DEC-003 · 2026-09-07 · rest timer becomes a persistent workout-level bar · live
- DEC-004 · 2026-09-08 · a destructive import auto-downloads current state first · live
- DEC-005 · 2026-09-08 · the planning session owns planning-worktree git; the worktrees stay isolated · live
- DEC-006 · 2026-09-08 · the planning session runs the merge (`plan closeout`) after Emilio's use-it OK · superseded in part by DEC-035
- DEC-007 · 2026-09-09 · error-boundary fallback auto-recovers on navigation; react-test-renderer adopted for render-tests · live
- DEC-008 · 2026-09-09 · the planning session also owns `plan publish`; keeps handoff current between builds · live
- DEC-009 · 2026-09-09 · the two-agent build loop, and the merge gate by req kind · superseded in part by DEC-035
- DEC-010 · 2026-09-09 · mobile is the primary platform; the live workout is mobile-only · live
- DEC-011 · 2026-09-09 · usage analytics: separate key, transition + button counts, export button · live
- DEC-012 · 2026-09-09 · first-time-exercise "setup" is guided calibration from the user's own sets · live
- DEC-013 · 2026-09-09 · in-gym flow cleanup: rest buttons, Back/Previous, drop the per-exercise review · live
- DEC-014 · 2026-09-09 · adding a set to a finished exercise reopens it until that set is logged · live
- DEC-015 · 2026-09-09 · no Back on top-level nav destinations; keep it on drill-down sub-screens · live
- DEC-016 · 2026-09-09 · navigation is links, buttons are actions only; one shared nav-link component · live
- DEC-017 · 2026-09-09 · a minimal, colorless, Apple-inspired component library as the styling foundation · live
- DEC-018 · 2026-09-10 · primary mobile nav is Today + Schedule; the rest go in a menu · superseded by DEC-019
- DEC-019 · 2026-09-10 · nav: everything goes in the menu; menu closes on item-click or outside-click — supersedes DEC-018's primary items · superseded by DEC-024
- DEC-020 · 2026-09-10 · a fixed named type scale; all text uses it · live
- DEC-021 · 2026-09-10 · the styling pass: one req styles the whole app; bigger refactors are observed, not done · live
- DEC-022 · 2026-09-11 · the app never invents warmup reps; the user enters them (audit F1) · live
- DEC-023 · 2026-09-11 · a rest-end cue: sound + vibration, fired once when rest hits zero · live
- DEC-024 · 2026-09-12 · new nav: a 3-tab bottom bar (Workouts / Library / Settings) · superseded by DEC-036
- DEC-025 · 2026-09-12 · the light peek IS the Workout screen; the unified scroll (req-32) is dropped · live
- DEC-026 · 2026-09-12 · the planning session's `git push` grant is scoped to two forms, not a bare push · live
- DEC-027 · 2026-09-12 · `plan doctor`'s exit reflects setup invariants only; drift is reported, not failed on · live
- DEC-028 · 2026-09-12 · the planning grants stay machine-local; tracking them was tried and reverted · live
- DEC-029 · 2026-09-12 · a cross-tab write conflict warns and asks for reload; it does not merge · live
- DEC-030 · 2026-09-12 · a recommendation with no valid increment holds; it never invents a 0.5 kg step · live
- DEC-031 · 2026-09-12 · "referenced" means referenced by finished history; delete confirm must name the slots it removes · live
- DEC-032 · 2026-09-12 · an unreadable `workout-mvp-v8` key is never overwritten; a distinct banner surfaces it · live
- DEC-033 · 2026-09-12 · history detail keeps "Correct" (not "Edit") as a deliberate vocabulary exception · live
- DEC-034 · 2026-09-12 · one canonical progression computation; finish.jsx's narrower matcher was the bug · live
- DEC-035 · 2026-09-12 · planning merges on its own testing; every run is explicitly batch or single · live
- DEC-036 · 2026-09-13 · Bottom menu redesign: floating Workout-oval + icon-only circles (solid) · live
- DEC-037 · 2026-09-13 · Build workflow by lane; batches use fresh ephemeral agents (no /clear) · live
- DEC-038 · 2026-09-13 · One in-progress workout (abandon on new); supersedes the multi-draft feature · live
- DEC-039 · 2026-09-13 · Back's logical parent for the two screens req-49 left to CC's call · live
- DEC-040 · 2026-09-13 · Navigate-only controls are links (NavLink), even when they wear the button look · live
- DEC-041 · 2026-09-13 · Pre-merge phone-test gate = local `vite preview` over Tailscale (not a cloud preview deploy) · live
- DEC-042 · 2026-09-13 · Navigation wears link treatment + §4 verbs; actions wear Button; no off-vocabulary verbs · live
- DEC-043 · 2026-09-13 · Root workflow docs stay the code session's; START-HERE is cold-start-only, workflow single-sourced in handoff/ · superseded by DEC-044
- DEC-044 · 2026-09-13 · Planning boots by reading handoff/PLANNING.md directly; START-HERE.md removed (prompts move to README) · live
- DEC-045 · 2026-09-14 · every req reaches main via `--no-ff`; a pre-push guard enforces it (approach A, not B) · live
- DEC-046 · 2026-09-14 · back up before touching stored data; Planner prompts the export · live
- DEC-047 · 2026-09-16 · batch mode: an opt-in exception to one-req-at-a-time + human-gate testing · live
- DEC-048 · 2026-09-16 · rest is informational, not a control surface; the next set is always live during rest · live
- DEC-049 · 2026-09-17 · Today's completed-today + recent are one list with per-row state, no section header · live
- DEC-050 · 2026-09-17 · "you beat last time" is per-exercise, any-axis; fire on any win, don't suppress on a regression · live

### decisions/DEC-051-100.md

- DEC-051 · 2026-09-18 · routes may carry a `?from=<encoded-path>` return target; the router splits the query before path parsing · live
- DEC-052 · 2026-09-23 · a mid-workout weight change carries to the remaining sets; a reps change does not · live
- DEC-053 · 2026-09-23 · "last time" skips a workout where that exercise was entirely skipped · live
- DEC-054 · 2026-09-23 · batches go to the Builder session, not ephemeral agents · superseded by DEC-055
- DEC-055 · 2026-09-23 · batches go to throwaway agents; the Builder session is for live and single work · live
- DEC-056 · 2026-09-23 · the routine is never updated automatically at Finish; updating it is a deliberate choice · live
- DEC-057 · 2026-09-23 · safety checks follow the files; a question isn't a decision; unconfirmed calls are marked · live
- DEC-058 · 2026-09-23 · flow-audit calls: comma is a decimal point; "current" = started within 6 h; hero keeps the day's other routines; an empty Finish warns · live
- DEC-059 · 2026-09-23 · flow-audit Tier 3 calls · live
- DEC-060 · 2026-09-24 · our own exercise library, pictures on tap first, our own styled images later · live
- DEC-061 · 2026-09-24 · the exercise library file is generated, never hand-edited · live
- DEC-062 · 2026-09-24 · the library's structure: a three-level muscle tree, one movement pattern, fixed lists, "common" first · live
- DEC-063 · 2026-09-24 · clean start: the library is built for the app, not around Emilio's data · live
- DEC-064 · 2026-09-24 · library polish after the critical comparison · live
- DEC-065 · 2026-09-24 · RepDB for pictures only; our library covers everything it does, better; a RepDB-blind audit · live
- DEC-066 · 2026-09-24 · "fully written" and "staple" are two flags; parity comes in batches of ≤40 · live
- DEC-067 · 2026-09-24 · library content calls are delegated; beginner-first, room for advanced · live
- DEC-068 · 2026-09-24 · no auto-memory for either session; third-party data in a gitignored repo dir · live
- DEC-069 · 2026-09-24 · aim: RepDB removed completely · live
- DEC-070 · 2026-09-24 · library order: triage → finish batches → remove RepDB when up to par → fresh scan · live
- DEC-071 · 2026-09-24 · design for the complete beginner first; the simple routine is the core · live
- DEC-072 · 2026-09-24 · library merge rule; merged names redirect in search · live
- DEC-073 · 2026-09-24 · toward a real product: other users soon, and training together · live
- DEC-074 · 2026-09-24 · standing test sanctions for library batches · live
- DEC-075 · 2026-09-24 · progression rules get their own req; until then the app only avoids wrong answers · live
- DEC-076 · 2026-09-24 · what "a plain number" means for the progression hold · live
- DEC-077 · 2026-09-24 · library content calls from the fresh-eyes scan · live
- DEC-078 · 2026-09-24 · the open library/progression calls closed · live
- DEC-079 · 2026-09-24 · native popups are replaced by an in-app confirm sheet, all of them · live
- DEC-080 · 2026-09-24 · the confirm sheet's action button is named for the action · live
- DEC-081 · 2026-09-24 · `go(…, { replace: true })` replaces the browser entry too · live
- DEC-082 · 2026-09-24 · DEC-081's reason corrected; an added set with nothing logged stays blank · live
- DEC-083 · 2026-09-24 · the open calls from req-24 / req-152 confirmed · live
- DEC-084 · 2026-09-24 · req-153's dead-Back fix dropped; the rest ships · live
- DEC-085 · 2026-09-24 · the 2026-09-24 audits: all of planning's recommendations taken · live
- DEC-086 · 2026-09-25 · an unreadable value is kept as an on-device copy before Import may replace it · live
- DEC-087 · 2026-09-25 · the open calls closed with planning's recommendations; follow-ups before any new feature · live
- DEC-088 · 2026-09-25 · a legacy in-progress workout's sets belong only to their own item · live
- DEC-089 · 2026-09-25 · a finished workout's snapshot counts as a reference; a draft-only reference says so · live
- DEC-090 · 2026-09-25 · on load, a workout's routine falls back to the one its snapshot names · live
- DEC-091 · 2026-09-25 · flow before the server; fix the obvious, test it myself, ask only for feel · live
- DEC-092 · 2026-09-25 · a screen with more than one way in returns via `?from=` · live
- DEC-093 · 2026-09-25 · the beginner-run fixes: what ships now, what waits for req-144 · live
- DEC-094 · 2026-09-26 · Planner owns what it can see on a phone-size screenshot · live
- DEC-095 · 2026-09-26 · if Planner can do it, Planner does it; no asking · live
- DEC-096 · 2026-09-26 · the routine sets the workout's weight; history prefills the routine · live
- DEC-097 · 2026-09-26 · adding exercises to a routine: own first, whole library, multi-select, a shown starting plan · live
- DEC-098 · 2026-09-26 · beginners start from a slot template chosen by days per week · live
- DEC-099 · 2026-09-26 · the routine form: Focus gone, Role → one "Warm-up exercise" switch, no warm-up set · live
- DEC-100 · 2026-09-26 · req-178's data gate waived for this batch; Q1 = overwrite · live

### decisions/DEC-101-150.md

- DEC-101 · 2026-09-26 · the routine-kg fill runs once per device; an import never fills · live
- DEC-102 · 2026-09-26 · the Sam-run calls: last-time hint when the routine is blank, keep the note, warn on big jumps · live
- DEC-103 · 2026-10-05 · in-workout feedback 2026-10-05: weight confirm on Complete, Swap in the list, one workout pill · live
- DEC-104 · 2026-10-06 · a swapped-in or added exercise: history's plan, else ask sets and rest · live
- DEC-105 · 2026-10-06 · first-time setup starts from your machines; a new plan starts today · live
- DEC-106 · 2026-10-06 · a Swap with no history copies the replaced exercise's sets and rest, no step · live
- DEC-107 · 2026-10-06 · Add exercise's step prefilled 3 sets / 90 s; reps carry when there's no target · live
- DEC-108 · 2026-10-06 · Emilio's 2026-10-06 gym notes: one-tap effort logging, Failure, pill skips, cardio fields, one today row · live
- DEC-109 · 2026-10-06 · cardio Duration prefills from a single-time target; a range stays blank and required · live
- DEC-110 · 2026-10-07 · app organisation: bar Workouts · Today · History; Home is this week; routines are "Workouts" · live
- DEC-111 · 2026-10-07 · History stays on Home, not on the bar; the bar is Workouts · Today · live
- DEC-112 · 2026-10-07 · no bottom bar: Home is the hub; deep screens get a "Today" link · live
- DEC-113 · 2026-10-07 · Home: the next 3 workouts above, today at the bottom, no past days or rest rows · live
- DEC-114 · 2026-10-07 · Home: the next 6 days, rest days included; no "Today" title; no gap · live
- DEC-115 · 2026-10-07 · "Schedule ›" on Home; History lives inside Schedule · live
- DEC-116 · 2026-10-07 · a new workout is named "New workout #N"; setup asks for the name last; setup lets you pick the days; "Change day" · live
- DEC-117 · 2026-10-07 · Noa-run calls: a small progress arrow, reps carry on uniform plans, no pre-picked days, Total lifted goes, a one-date move from Home, CSV later · live
- DEC-118 · 2026-10-07 · the finish screen's "↑ Heavier on X" line goes; the per-exercise "X ↑ N%" lines replace it · live
- DEC-119 · 2026-10-10 · feedback batch 5: one Done per set, effort once per exercise on a review screen, done-early days, creation without days · live
- DEC-120 · 2026-10-10 · exercises-dataset media is off-limits; openGym and GymMane are ideas only · live
- DEC-121 · 2026-10-10 · progression goes through the user's own AI for now: export with rules → chat → import; in-app AI later · live
- DEC-122 · 2026-10-10 · notes wait for a workout redesign; dumbbells log one bell, one-arm exercises say so plainly · live
- DEC-123 · 2026-10-10 · first-time setup asks once after set 1; AI import keeps history by default; "Export for your AI" on Backup & data · live
- DEC-124 · 2026-10-11 · in-app AI: Claude API (Opus 5) from our backend; AI proposes, req-220's preview confirms · live
- DEC-125 · 2026-10-14 · feedback batch 6: effort stays per exercise, Start opens the first exercise with "Up next", GO counts the workout, a forgotten finish uses the last set, Home sheet + Swap for today · live
- DEC-126 · 2026-10-14 · a one-day swap shows only where it applies, and moves with its workout · live
- DEC-127 · 2026-10-21 · the server starts now: own machine like White Sleeve, data + feedback online, multi-user, export/import kept · live
- DEC-128 · 2026-10-21 · server stage 1 shape: offline-first phone, White Sleeve's hosting pattern · live
- DEC-129 · 2026-10-21 · the GitHub Pages site stays until the server is fully running · live
- DEC-130 · 2026-10-21 · server stage 1 split into req-228..231; backend rules written · live
- DEC-131 · 2026-10-21 · req-229's open choices, recorded · live
- DEC-132 · 2026-10-21 · app sync behaviour kept simple for one user · live
- DEC-133 · 2026-10-22 · after a server restore, the workout in progress survives · live
- DEC-134 · 2026-10-22 · req-231's open choices, recorded · live
- DEC-135 · 2026-10-26 · GitHub Pages shut down · live
- DEC-136 · 2026-10-26 · The scheduled backup is weekly, not nightly · live
- DEC-137 · 2026-10-26 · page feedback is checked against that page's decisions; only a clash with Emilio's needs him · live
- DEC-138 · 2026-10-26 · first-time exercises: no question, a help link instead · live
- DEC-139 · 2026-10-26 · the workout pill: two lines, words not fractions · live
- DEC-140 · 2026-10-26 · a coach agent, run from here first; a proposal Emilio reads, then imports · live
- DEC-141 · 2026-10-26 · the coach's plan goes straight into the server database, through one apply tool · live
- DEC-142 · 2026-10-26 · req-245's open choices, recorded · live
- DEC-143 · 2026-10-26 · an architectural change is finished 100% before new or feedback work starts · live
- DEC-144 · 2026-10-30 · the workflow update: stop at every closeout, agents build and QA, one brief, Emilio deploys · live
- DEC-145 · 2026-10-31 · Coach is a role; it builds plans from a capability file, and sends what the app can't express to Planner · live
- DEC-146 · 2026-10-31 · Coach builds only what the app can run; a missing feature becomes a req, never a workaround · live
- DEC-147 · 2026-10-31 · Coach becomes every user's coach, with their data isolated; iterated here first · live
- DEC-148 · 2026-10-31 · the Coach brief split: method · goal profiles · client; lessons general only · live
- DEC-149 · 2026-10-31 · Coach's evidence library: checked sources, newest first · live
- DEC-150 · 2026-10-31 · Coach learns from three training books: paraphrased notes outside git; research wins a conflict · live

### decisions/DEC-151-200.md

- DEC-151 · 2026-10-31 · Planner's recommendations on the Coach open calls, accepted · live
- DEC-152 · 2026-10-31 · req-254 plan-builder: the choices the spec left open · live
- DEC-153 · 2026-10-31 · a routine's kg may be a Coach estimate: labelled in the backend, calibration only · live
- DEC-154 · 2026-10-31 · Phase 1 order agreed; the 2026-10-30 barbell session stays unlogged · live
- DEC-155 · 2026-10-31 · fixes before features, always: review, tooling and workflow items are cleared first · live
