# Backlog

Open items only. Nothing here is a requirement yet: each becomes `work/req-NN-name.md` when it comes up, and only a
`READY` req goes to Builder (`rules/WORKFLOW.md`). Shipped work is in `log/SHIPPED.md`, and the reasons are in
`log/DECISIONS.md`. **Rewritten 2026-10-26** (Emilio: "we dont want anything old"): every shipped, superseded or
already-fixed entry was removed after a check against `main`. The old notes are in git (`git log -- handoff/work/BACKLOG.md`).

## The order (Emilio, 2026-09-07)

> *"before we build anything heavy, i want the actual flow of using the app in the gym to be flawless. then the flow to
> create programs — that is probably the most difficult flow."*

Phase 1 in-gym flow flawless (now) → Phase 2 program creation → Phase 3 other users, training together, AI.
The server for Emilio's own data is live (stage 1, DEC-127..136); it no longer gates anything for him.

## Held — READY, waiting for Emilio's go

- **Batch 7** (feedback J1..J8, 2026-10-16..22; DEC-138/139): req-239 (J2 first-time prompt) → 240 (J3+J6 one side, timed and
  own exercises) → 241 (J4+J7 next on the log screen, Skip a done set), 242 (J8 the whole routine row opens it, Change exercise),
  243 (J1 Home sheet "Swap" label); req-244 (J5 GO pill, look A).
- **req-238** CI check-only.

## Phase 1 — the in-gym flow

**Open, needs a call or a spec**
- **Changing the loop length moves "this week"** [measured 2026-10-26: `loopWeeksState` drops slots past the new length,
  no re-anchor, `src/state-reducers.js:289`]. *Q (Emilio):* re-anchor so this week stays this week?
- **Edit rest during an exercise** (DEC-104 §3 follow-up; Emilio: "rest can be filled in during the sets"): an item added
  mid-workout with blank rest can't get a rest on the log screen. Small ui req.
- **A rest timer learned from your own set gaps** (H8, DEC-119). Sets carry `loggedAt` since req-212, so the data exists.
- **Dead first Back after finishing an exercise** (parked, DEC-084; req-153's fix dropped as too fragile). History ends
  `[…, /workout/x, /workout/x]`. Idea: on a popstate that lands on the entry just left, step back once more. iPhone test first.
- **Tips during rest** (generic form/motivation tips) — parked (DEC-108 §6): no evidence it helps, needs a cited tip set.
- **req-77 active-workout affordance** — PAUSED (Emilio, 2026-09-16). Don't raise it until he revives it.

**Small issues from reviews** — each logged with file:line when found and not re-checked since. Recheck against `main` when
one is specced.
- req-176: a snapshot item with neither `id` nor `routineItemId` would miscount skips (`workout-log.js`; no known producer).
- req-173: the active set edit (SetEditForm) saves a blank kg as 0 with no note (History keeps `''`); an unexplained
  `targetWeight: 60` on a seed set after the v8→v9 migration (probably `legacyRecommendations`; not shown to the user).
- req-171: recalc → Routine → an inner editor loses the Back chain (`navForBase`); a stale `from` id (`/history/<deleted>`)
  lands Back on "Not found.".
- req-220: *(Emilio's call)* the import sheet fills "Replace everything" and leaves "Keep my history" plain. Planner
  recommends flipping that. Separately, the anti-staleness app-path test doesn't cover History edit/recalc, Swap/Add/timed/Skip, or `applyPlan`.
- Batch 5: *(Emilio's call)* a missed rep lowers only that set, even on an Easy exercise. 11 rendered tests still remount
  StoreProvider per screen (move them to the L-051 pattern). The Days row reads long in a multi-week loop. The library chunk
  (264 kB gzip) loads on the first log-screen open.
- req-222: Add set on a swapped-away exercise isn't counted by `workoutPosition` (the cap hides "5/4" as "4/4",
  `workout-log.js:1157`). A pre-req-188 swap counts both items.
- req-224: Finish computes its time at mount but the store saves at Save (55 min shown, 50 saved). A left-open earlier-day
  workout saved > 6 h after its last set skips req-116's Back-after-Finish guard. Auto-complete shows the shorter Duration
  with no "left open" line.
- req-225: past one-date swaps are never pruned. An imported swap whose slot routine is missing has no "Back to".
- req-180 picker: the sticky Cancel/Add N bar has no background. Empty-search grouping by first muscle puts Burpee under Chest.
- req-188: a fast double tap on Add N or Swap can commit twice. Sets has no upper bound (99999 accepted).
- Abandon falls below the fold with the overview note open on a long routine (req-107). The `.ui-navlink` inset misaligns a
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

## Exercise library (DEC-060/064)

Shipped: req-130, 133, 138–143. **Next, in order:** req-134 → 132 → 137 → 131 → 135 → own images / avatars.
- **`req-134` muscle search + filter**: group chips with "More specific" → muscles; "must hit all" toggle (DEC-062 §5);
  aliases match. Rank `common` entries first ("air bike" → Fan Bike, "shoulder press" → Dumbbell Shoulder Press). Custom
  exercises get a muscle pick (stored field → persisted-data gate). Also the feedback note carries `libraryId` (was req-136).
- **`req-132` one Add screen**: your exercises first, then library hits, then "Create '<name>'". "Link to library" on an
  unlinked exercise. Offline never blocks.
- **`req-137` offline library + images** (service worker cache). Before own images.
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
accounts and the sharing model (shared routine, own values), privacy/GDPR (what leaves the device, retention, deletion),
AI cost per user, live group sessions. The in-app AI design is decided (DEC-124).
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

- **`plan closeout` exits 1 silently when the req doc has no `# ` title**: `co_title=$(grep -m1 '^# ' …)` under `set -euo
  pipefail` [still there 2026-10-26, `plan:890`]. Fall back to the req id or print why.
- **dates-tz guard passes on an empty cases file**: `/# pass [1-9]/` (`src/dates-tz.test.js:25`). Assert the count
  `dates-tz.cases.js` defines (L-045).
- **`plan qa --empty`**: serve a true first-time user. The seed is re-injected whenever storage is empty (`scripts/qa.mjs`).
- **[optional] Slim the readiness taxonomy** (`scripts/check_handoff.py`). Only if it gets in the way.

## Already built — don't re-spec

Export/Import (`src/exchange.js`, Keep my history / Replace everything, a copy kept first), the feedback note on every
screen (synced to the server `notes` table), the coach round-trip (`./server/ops plan`, DEC-140/141). Module map:
`reports/req-164.md`; stored fields: `reference/schema.md`; pages: `reference/PAGES.md`.
