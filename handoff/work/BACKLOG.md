# Backlog

Open items only. Nothing here is a requirement yet: each becomes `work/req-NN-name.md` when it comes up, and only a
`READY` req goes to a build agent (`rules/WORKFLOW.md`). Shipped work is in `log/SHIPPED.md`, and the reasons are in
`log/DECISIONS.md`. **Rewritten 2026-10-26** (Emilio: "we dont want anything old"): every shipped, superseded or
already-fixed entry was removed after a check against `main`. The old notes are in git (`git log -- handoff/work/BACKLOG.md`).

## The order (Emilio, 2026-09-07)

> *"before we build anything heavy, i want the actual flow of using the app in the gym to be flawless. then the flow to
> create programs — that is probably the most difficult flow."*

Phase 1 in-gym flow flawless (now) → Phase 2 program creation → Phase 3 other users, training together, AI.
The server for Emilio's own data is live (stage 1, DEC-127..136); it no longer gates anything for him.

## Held — READY, waiting for Emilio's go

- **The fix batch (DEC-155)**, in order: req-256 (built, review done, AC2 on the server pending) → req-255 → req-257..265.
  The "Small issues from reviews" and §Tooling items below that became reqs are marked → req-N.

## Phase 1 — the in-gym flow

**Open, needs a call or a spec**
- → **req-264 (a)**, decided DEC-155 §2. **Change exercise across types** (req-242 review, latent): a no-history change keeps the item's sets/reps/rest whatever the
  types — strength → cardio keeps 3 × "8" (Add makes 1 set); timed → strength keeps per-set `durations`. No kg is invented.
  *Q (Emilio):* reset to the new type's default plan when the type changes, or keep as is?
- **Changing the loop length moves "this week"** [measured 2026-10-26: `loopWeeksState` drops slots past the new length,
  no re-anchor, `src/state-reducers.js:289`]. *Q (Emilio):* re-anchor so this week stays this week?
- **Edit rest during an exercise** (DEC-104 §3 follow-up; Emilio: "rest can be filled in during the sets"): an item added
  mid-workout with blank rest can't get a rest on the log screen. Small ui req.
  Run 5 item 29: also edit a **running** rest (only skip exists); real rests on 30 Oct ran about twice the written ones.
- **A rest timer learned from your own set gaps** (H8, DEC-119). Sets carry `loggedAt` since req-212, so the data exists.
- **Dead first Back after finishing an exercise** (parked, DEC-084; req-153's fix dropped as too fragile). History ends
  `[…, /workout/x, /workout/x]`. Idea: on a popstate that lands on the entry just left, step back once more. iPhone test first.
- **Supersets / circuits in the workout** (Emilio, 2026-10-31, DEC-146): items alternated set by set with a smooth hand-over
  (the next item opens after a set; rest only after the pair). Coach may not plan them until this ships. Supersets save time with no loss of gains (coach/EVIDENCE.md §11). Run 4 —
  supersets written as notes were done as straight sets, ≈55 min not ≈43, the finisher dropped. Overlaps req-184 item 15
  (Phase 2). **Phase 1** (Emilio, DEC-151). Extends req-254's `ITEM` + checks if it ships after it.
- **Interval chaining in the workout** (Emilio, 2026-10-31: "we will build a tabata timer in the app"): both timers exist
  (set countdown `src/ui/index.jsx:430`, rest on Done `src/views/workout/item.jsx:355`), but each round needs Done + Start —
  16 taps in a 4-min Tabata. Chain them: the work countdown ends → the set logs → rest runs → the next round starts. EMOM also
  needs rest = the rest of the minute. Until then Coach builds only ≥ 30 s intervals (DEC-146 §4); req-254 C6 refuses shorter — relax it here.
  **Cardio too** (run 5 item 5): Rowing is `cardio` without `hasDuration`, so a 30 s / 30 s row is only text; run 5 dropped
  three rowing finishers. Work/rest × rounds must cover cardio items.
- **Exercise cues are never shown in the workout** [measured 2026-10-31]: `exercise.cues` appears only in the exercise
  editor; the rest block shows library `formCues` (`src/library-hints.js:52-57`). Emilio wants cues on the exercise; they
  should reach the log screen. Coach can't place technique cues anywhere he sees them until then.
- **Notes before set 1** (Coach run 5, item 22): item notes show only during rest (CAPABILITIES), so a starting-weight
  instruction ("empty bar × 10, then add plates") arrives after the set it's for. Show them when the item opens. Pairs with cues.
- **Bar weight on barbell exercises + plate helper** (run 5 items 4, 25; Emilio: "all erxcersises that are bar with weights,
  it should be prefilled with 20kg, but you should be able to change the bar weight in the actual exercise settings"). Barbell
  kg includes the bar from now on; helper shows bar + plates a side (50 = 20 + 15 a side; 1.25 plates exist). His one
  plates-only log (Romanian Deadlift 2026-10-09) reads +20 under this rule — a data question before any build.
- **"Short on time? skip X"** (run 5 item 28): Coach orders each session so the last item is the one to cut; show it on the overview.
- **Target text is logged as reps** [measured 2026-10-31, `src/workout-log.js:613-615`]: a "10-12" / "AMRAP" target prefills
  Reps and is logged as typed unless retyped. And `isDurationTarget` labels "12 reps" as Duration (`src/progress.js:89-92`); req-254 C6 refuses such targets until fixed. → **req-256** (READY) fixes the "12 reps" half; the range/AMRAP half stays here.
- **Duration targets the rule still misreads** (req-256 review, latent): "45s each side", "30s/side", "60s x2", "1:30" read as
  not-a-duration; "tempo 3s" reads as Duration (`src/progress.js:92`). And `countableReps` on strings is masked by
  `unreadableTarget` (`progress.js:107-110`) — re-check if req-149 loosens the hold.
- **Coach's app gaps from the training books** (DEC-150, notes in `workout-data/coach/books/`): a planned effort/RIR target
  per item; rep-range progression in the app's recommendation (req-149); a weekly recovery check-in (5 questions); several
  warm-up sets with kg (req-184 item 10); drop sets / myo-reps; a time for a whole item (the S&S bell trigger); left/right
  alternation inside one item; sets that change week to week inside a routine. Each is a req candidate; none specced.
- **Tips during rest** (generic form/motivation tips) — parked (DEC-108 §6): no evidence it helps, needs a cited tip set.
- **req-77 active-workout affordance** — PAUSED (Emilio, 2026-09-16). Don't raise it until he revives it.

**Small issues from reviews** — each logged with file:line when found and not re-checked since. Recheck against `main` when
one is specced.
- → req-262. req-176: a snapshot item with neither `id` nor `routineItemId` would miscount skips (`workout-log.js`; no known producer).
- → req-261. req-173: the active set edit (SetEditForm) saves a blank kg as 0 with no note (History keeps `''`); an unexplained
  `targetWeight: 60` on a seed set after the v8→v9 migration (probably `legacyRecommendations`; not shown to the user).
- → req-263. req-171: recalc → Routine → an inner editor loses the Back chain (`navForBase`); a stale `from` id (`/history/<deleted>`)
  lands Back on "Not found.".
- → req-264 (b) (DEC-155 §2); the app-path test gap was fixed by req-226. req-220: *(Emilio's call)* the import sheet fills "Replace everything" and leaves "Keep my history" plain. Planner
  recommends flipping that. Separately, the anti-staleness app-path test doesn't cover History edit/recalc, Swap/Add/timed/Skip, or `applyPlan`.
- Missed rep on Easy: kept (DEC-155 §2). 11 remounts: fixed by req-226. Days row → req-264 (c); library chunk → req-265. Batch 5: *(Emilio's call)* a missed rep lowers only that set, even on an Easy exercise. 11 rendered tests still remount
  StoreProvider per screen (move them to the L-051 pattern). The Days row reads long in a multi-week loop. The library chunk
  (264 kB gzip) loads on the first log-screen open.
- → req-261 (DEC-155 §2). req-222/244: `workoutPosition` N = done + 1, so opening exercise 2 before finishing 1 shows "Ex 1 of 9" — in words
  (req-244) it reads as "you are on exercise 1". Emilio's call: done count vs the current row's place.
- Fixed by req-227; the pre-req-188 double count is dropped (only a workout started before req-188). req-222: Add set on a swapped-away exercise isn't counted by `workoutPosition` (the cap hides "5/4" as "4/4",
  `workout-log.js:1157`). A pre-req-188 swap counts both items.
- Shown/saved time and auto-complete line fixed by req-227; Back guard → req-262. req-224: Finish computes its time at mount but the store saves at Save (55 min shown, 50 saved). A left-open earlier-day
  workout saved > 6 h after its last set skips req-116's Back-after-Finish guard. Auto-complete shows the shorter Duration
  with no "left open" line.
- → req-262. req-225: past one-date swaps are never pruned. An imported swap whose slot routine is missing has no "Back to".
- Sticky bar fixed; Burpee → req-264 (d). req-180 picker: the sticky Cancel/Add N bar has no background. Empty-search grouping by first muscle puts Burpee under Chest.
- → req-261. req-188: a fast double tap on Add N or Swap can commit twice. Sets has no upper bound (99999 accepted).
- Browser checks → req-264 (e); cardio `[0]` → req-262. Abandon falls below the fold with the overview note open on a long routine (req-107). The `.ui-navlink` inset misaligns a
  wrapped second line. Apply on a cardio item writes `suggestedWeights` `[]` → `[0]` (not shown).

## Phase 2 — program creation

- **Define the model first** — program vs routine vs schedule: what a program owns, how it maps onto the weekly loop, how
  progression flows through it. A decision doc before any build. **`req-184` creation design session 2** (NEEDS DECISIONS:
  advanced users, programs) is where this happens. Session 1 → DEC-096..102.
- **The "review and update the routine" step** (DEC-056). Finish doesn't rewrite the routine, so updating it is a deliberate
  choice, e.g. at the end of a loop. Shape open. The History "Update?" screen still shows no numbers [measured 2026-10-26,
  `src/views/history/recalc.jsx`]. The review step must show them.
- **`req-149` progression rules** (waiting on Emilio, DEC-075): rep ranges, AMRAP, an assisted flag (req-150 holds today:
  `ASSISTED_LIBRARY_IDS`, `progress.js:114`), suggest vs apply, the missed-rep rule above, whether the routine auto-update stays.
- **Active overview Back → Today** even when started from Routines (req-171). Is the overview home base? Decide with req-184.
- **Creation friction** (flow audit 2026-09-23): the parallel Sets/Reps/Kg/Duration strings → a per-set grid; one tap per
  reorder step; per-item rest. Data quality: free-text weight step, blank or duplicate names, no un-archive (re-adding an
  archived exercise splits its history), Start on an empty routine.
- **Gyms** (Emilio, 2026-09-24): your own gym(s) with their equipment (DEC-062 vocabulary), so alternatives and programs fit
  what's there. The weight step belongs to a gym's machine, not the exercise. A workout knows which gym. A shared gym library
  needs other users (Phase 3).
- **Programs from the library**: movement patterns + muscles + level balance a program.
- **Log a past workout** (run 5 items 1, 24): a session done outside the app (a date, exercises, sets). Today a workout
  can only be logged live, dated now; a past session can't be entered with its real date [measured 2026-10-31: no date
  edit in `src/views/history/`]. Emilio's 2026-10-30 barbell session waits for this.
- **Schedule history + weekly adherence view** (run 5 items 10, 27): the schedule is stored only since 2026-10-25, so planned
  sessions skipped can't be counted. Emilio: "I want to get better" at consistency.
- **Calendar export (.ics)** of the schedule (run 5 item 26): missed sessions come from lunch meetings.
- **An "optional" schedule slot** (run 5 item 20): weekend routines carry "(bonus)" in the name today.
- **Running import (Strava/GPX)** (run 5 item 9): his runs live in Strava; cardio sets already take duration + distance.
- Gyms (above) — run 5 item 8 repeats it: Emilio: "we might need a way to add gyms/machines that are available to you".

## Exercise library (DEC-060/064)

Shipped: req-130, 133, 138–143. **Next, in order:** req-134 → 132 → 137 → 131 → 135 → own images / avatars.
- **`req-134` muscle search + filter**: group chips with "More specific" → muscles; "must hit all" toggle (DEC-062 §5);
  aliases match. Rank `common` entries first ("air bike" → Fan Bike, "shoulder press" → Dumbbell Shoulder Press). Custom
  exercises get a muscle pick (stored field → persisted-data gate). Also the feedback note carries `libraryId` (was req-136).
- **`req-132` one Add screen**: your exercises first, then library hits, then "Create '<name>'". "Link to library" on an
  unlinked exercise. Offline never blocks.
- **`req-137` own exercise images offline** (service worker cache). The library chunk is already cached by the server build's
  service worker (audit 2026-10-30 F-DRIFT-8, `src/sync/sw.js:29-31`); only images are open. Before own images.
- **`req-131` "How to" button**: free-db start/end photos flipping, else the exercise's video link (new optional field).
  No RepDB pictures (DEC-069).
- **`req-135` alternatives**: same pattern + primary muscle, your equipment first.
- **Resolver bug** (req-233): `libraryEntryFor` (`src/exerciseLibrary.js:588-595`) returns hidden and merged entries by
  name/alias and doesn't follow `mergedInto`. An unlinked "Biceps Curl" resolves to the dumbbell curl. Only Emilio's
  data was fixed. Small bug req.
- Hyperextensions and Russian Twist are `bodyweight-reps` but are often done with a plate.
- **Images from Mannequin Studio** (offered 2026-10-25): `~/Dev/mannequin-studio`, contract `EXPORT.md`. 9 ready, all live
  ids, 6 in Emilio's routines. How images enter the app (bundle size, offline cache, DEC-064 photo rules) is unspecced.
- **Avatars + pixel-art style** (Emilio-led, live lane): the avatar is the figure that does the exercises; skeleton + layers;
  a pixel-art agent with a deterministic renderer + validator. RepDB images are never input to it (DEC-069 §2). Supersedes
  the separate style pilot.

## Phase 3 — other users, training together, AI (`work/req-146-backend-design.md`)

Stage 1 (own server, own data) is live. Stage 2 (other users) and stage 3 (together, AI) need Emilio's decisions:
- **Coach for every user** (DEC-147): a general coach, per-user data isolated, later an in-app API (DEC-124). Iterated from
  Claude Code until the brief is general.
accounts and the sharing model (shared routine, own values), privacy/GDPR (what leaves the device, retention, deletion),
AI cost per user, live group sessions. The in-app AI design is decided (DEC-124).
- **Two training partners get accounts soon** (run 5 item 12): each needs a coach folder + `CLIENT.md` (DEC-147) once their
  user exists on the server. Before a second client gets a Coach plan: DEC-153 §5 (show "estimate" in-app?).
- **A Researcher role** (Emilio, 2026-10-31: "i have an idea for a researcher as well, instead of saving books, and to keep our
  coach up to date with the latest scientific data on the hu man body/mind and excersice"): a role like Coach (DEC-145) that
  searches new studies and proposes checked updates to `coach/EVIDENCE.md` (DEC-149's method), replacing book notes (DEC-150).
  Needs a design pass with Emilio: cadence, what happens to the 3 existing book notes, who approves an EVIDENCE change.
  Emilio's brief: `researcher/EMILIO-BRIEF-2026-10-31.md`. **Not now; an MVP soon** (Emilio, 2026-10-31). Planner's read:
  adopt its rigour (hierarchy, levels, full-text/abstract/metadata, retractions, finding vs interpretation vs advice), grow
  scope from Coach's questions rather than all 20 domains, own summaries + metadata in git (no abstracts), dashboard later.
  → **req-267** (design, NEEDS DECISIONS): five questions with options + recommendations.
- **Audit the Coach workflow** (Emilio asked when, 2026-10-31): no review of the Coach role has run since DEC-145; five runs
  done. A read-only audit (`rules/AUDIT.md` style) of COACH.md/CAPABILITIES/GOALS/EVIDENCE + run 1–5 reports + what came back
  to Planner. Run reports live on the server (`workout-data/coach/run-*`), so it runs there.
- **A nutrition app** (run 5 items 11, 19): a separate product with its own Nutritionist coach; Coach's MVP brief is
  `workout-data/coach/nutrition-app-brief.md` (outside git: it holds client facts). Emilio wants bodyweight/waist out of
  this app. Not started; needs Emilio's go on when, and on one login across both apps or two.
- **Before a second user logs in** (req-230 review): logging in as someone else on a device with unsynced changes replaces
  them; an expired-session re-login unmounts the open screen (data survives, timers reset); a change rebased during an
  in-flight sync isn't recorded as a conflict (the loser survives only as an unmarked revision, pruned after 14 days).
- **Before any public hosting** (ask-gate 3, req-229 review): login rate limiting, a body cap before auth, pruning expired
  sessions.
- **Ops nits** (req-231 review; not fallout, DEC-143): the DEC-133 scan `JSON.parse`s every revision since the marker (slow
  only after a restore; use `json_extract`); `start` doesn't XML-escape plist paths (none have `&<>` today); launchd runs an
  nvm node. A failed bootstrap already fails the deploy (`set -e`); the doctor runs after each deploy (CLOSEOUT step 4). The corrupt-copy-as-backup nit is fixed (req-237's doctor counts only
  scheduled backups).
- **Full visual-design pass**: its own milestone.

## Tooling

**From the 2026-10-30 audits, never triaged until 2026-10-31** (`audits/2026-10-30.md`, `handoff/audits/workflow-plan-2026-10-30.md`):
- **F-SYNC-1 (bug):** a three-way merge can leave a finished workout in progress → finishing again stores two workouts with
  one id; `validState` accepts duplicate ids (`src/sync/merge.js:112-131`, `server/store.mjs:27-47`). → **req-268**.
- **F-STRUCT-8:** `workout-log.js` 1,232 lines, 71 exports, 33 importers — split by job like req-164 did `storage.js`.
  → **req-270**, after req-261/262 (same file).
- **Cleanup nits:** F-DEAD-8 `storage.js` shim (0 app importers, 22 test importers); F-STRUCT-9 `sameKind` twice in
  `set-values.js:66-69,93-96`; 09-12 F-DEAD-2 unused `@types/*` (`package.json:24-25`, 3rd audit); F-DEAD-7's other
  test-only exports. → **req-269**, after req-261 (same file). (F-DEAD-7 `activeSetPatch` itself is in req-261.)
- **F-DRIFT-7:** `reference/schema.md` lacks the server tables + sync keys; stale `storage.js` pointer (schema.md:16).
  Planner's doc to fix → being written 2026-10-31.
- **F-SYNC-2 (needs a decision, stage 2):** whole-state sync stores ~1.5 MB/rev at 200 workouts, 7.4 MB at 1,000; phone
  localStorage ~5 MB ≈ 650 workouts, nothing warns (09-24 F-RISK-6). → §Phase 3, with the sync redesign.
- **Untriaged audit findings check** (L-068): `check_handoff.py` flags any `F-*` id in `audits/*.md` that appears in no
  BACKLOG line, req or SHIPPED entry (or is marked fixed/rejected in a later audit). The 10-30 audit sat untriaged a day.
- **Workflow "later" list** (DEC-144 §4 "after Phase 1"): DECISIONS split + digest (2,428 lines today); drop the
  `git commit/reset` grants + doctor's list; hook text; doc-size ratchet. *Emilio's call:* keep "after Phase 1", or now (DEC-155)?

- **A plan-builder for Coach** (DEC-145 §4): a short change list (routine X: order, kg, rest, notes; new library exercise;
  schedule slot) → a full plan file in the Export shape, checked (workouts identical, only the named parts changed) and
  ready for `./server/ops plan preview`. Today each coach run writes its own build script against `src/exchange.js` /
  `src/exerciseCatalog.js` (run 3, run 4 `scripts/build_import.mjs`). → **req-254** shipped 2026-10-31: `./server/ops plan build`.
- **`plan build` C5 opt-in for a Coach-estimate kg** → **req-255** (READY, DEC-153).
- → **req-260**. **`plan build` warns over every live routine** (run 5 item 7), not only the changed items: run 3's plan left supersets /
  EMOM in 6 untouched routines; run 5 found them with its own `scripts/dec146_scan.py`.
- → **req-257**. **`find_worktrees` can pick the wrong code worktree** (req-251 report): with an extra top-level worktree, "last
  non-planning worktree wins", so `CODE_DIR` — and closeout's merge — may point at an agent/scratch worktree. White-sleeve
  refuses closeout while >1 non-planning worktree exists. Also: `plan ping` still prints the pre-BUILDER.md handover.

- → **req-257**. **`plan closeout` exits 1 silently when the req doc has no `# ` title**: `co_title=$(grep -m1 '^# ' …)` under `set -euo
  pipefail` [still there 2026-10-26, `plan:890`]. Fall back to the req id or print why.
- **More `plan closeout` abort traps** (req-257 report, not measured): `review_warn="$(reviewer_warning …)"` (step 4c) aborts
  closeout under `set -e` if `reviewer_warning` returns non-zero; `flip_status` (step 4) has no guard.
- → **req-258**. **dates-tz guard passes on an empty cases file**: `/# pass [1-9]/` (`src/dates-tz.test.js:25`). Assert the count
  `dates-tz.cases.js` defines (L-045).
- → **req-259**. **`plan qa --empty`**: serve a true first-time user. The seed is re-injected whenever storage is empty (`scripts/qa.mjs`).
- → **req-258** (as "no file runs zero tests"; partial files → req-266). **Fail `./check` when the test count drops** (req-248 report): one pre-watchdog run ended at 2096 of 2108 tests — req-10's
  12 rendered tests missing, no ✖ line for the file; red only by luck (an unrelated unit failure). Not reproduced. A floor
  (e.g. the count can't fall below main's without a named test edit) would catch a silently dropped file.
- → **req-258**. **CI actions on Node 20** (req-238 run 40354463101): `actions/checkout@v4` / `setup-node@v4` are deprecated, forced to Node 24.
  Bump both to their current majors when it's convenient.
- **`check`'s req-248 comment says the suite takes 80–105 s**; it takes ~9 s (req-266 report). Trim the comment.
- **[optional] Slim the readiness taxonomy** (`scripts/check_handoff.py`). Only if it gets in the way.

## Already built — don't re-spec

Export/Import (`src/exchange.js`, Keep my history / Replace everything, a copy kept first), the feedback note on every
screen (synced to the server `notes` table), the coach round-trip (`./server/ops plan`, DEC-140/141). Module map:
`reports/req-164.md`; stored fields: `reference/schema.md`; pages: `reference/PAGES.md`.
