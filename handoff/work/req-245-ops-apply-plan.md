**Status: READY** · **Lane: backend** · DEC-141. Writes the live DB through the normal path; one server-DB schema addition.

# req-245 — `ops plan`: preview, apply and revert a plan change on the live server

Emilio, 2026-10-26: "no more import or export files, just update the database accordingly, made we need functinality to do it
well, as it will continuasly change" → **DEC-141**.

## Code facts (rescanned 2026-10-26, `main`)

- Writes: `putState(db, userId, {baseRev, baseId?, state})` (`server/store.mjs:159-222`) — `baseRev` = current → stored as rev+1;
  older → three-way merge (`merge.mjs`). `validState` (`:27`). Every revision is the whole state (`revisions.state`,
  `server/db.mjs`).
- Kept history: `pruneRevisions` keeps the last 14 days, the last revision of each day, and restores (`store.mjs:235-257`).
- Ops CLI: `server/ops-cli.mjs` (`backup <reason>` `:72-81`, `restore` `:83`); backups via `ops.backup` (online API,
  integrity-checked, BACKEND rule 6).
- The app's import preview: `importPreview(current, incoming)`, `previewLines(preview, mode)`, `keptHistoryState`
  (`src/exchange.js:763-866`) — the server reuses the app's code already (DEC-128 §5).
- BACKEND rule 5: a non-request write takes a backup first and asks Emilio with the counts.

## Scope

1. **`./server/ops plan preview <file> [--user <name>]`** — `<file>` is a state or backup JSON (the coach's output). Builds the
   result as Import's **Keep my history** does (`keptHistoryState`: plan, exercises, schedule from the file; the current
   `workouts` and `activeWorkout` kept), then prints `previewLines(…, 'keep')` and counts: routines added / changed / archived,
   exercises added, slots before → after, workouts identical (must be yes). Writes nothing.
2. **`./server/ops plan apply <file> --source <name> --note "<text>" [--yes]`** — same preview; without `--yes` stops there.
   With `--yes`: `ops.backup('before-plan-<source>')`, then `putState` with `baseRev` = current rev, in one transaction; prints
   the new rev. Refuses if the result's `workouts` differ from the current ones, or an `activeWorkout` is in progress (a live
   workout is never changed under the phone).
3. **Who and why on each revision:** add nullable `source TEXT`, `note TEXT` to `revisions` (`CREATE TABLE`/`ALTER` on open, like
   `pruned_revisions`, `db.mjs:45-57`); device pushes leave them null. `ops plan apply` sets them; `GET /api/revisions` lists
   them. Revisions written by `plan apply` are kept by pruning (like restores).
4. **`./server/ops plan revert <rev> --yes`** — writes the plan/exercises/schedule of revision `<rev>` back as a new revision
   (Keep-my-history rule again, so history logged since stays), backup first, `source: 'revert'`.
5. `server/README.md` documents the three commands.

## Out of scope

- The coach agent calling it (Planner runs it, after Emilio's yes). An event store (DEC-141 §3). Anything in the app.

## Acceptance criteria

1. On a temp DB (BACKEND rule 8) seeded with a fixture: `preview` prints the lines + counts and the DB is byte-unchanged.
2. `apply --yes` → one backup file, rev+1 with `source`/`note`, `workouts` identical to before (assert deep-equal), routines
   and schedule as the file's.
3. **Failure cases:** a file whose `workouts` differ → refused, nothing written, no backup left claiming a write; an
   `activeWorkout` present → refused; an invalid file (`validState` throws) → refused.
4. A device push based on the rev before the apply merges (three-way) without losing either the device's new sets or the
   applied plan (test through `putState`).
5. `revert <rev>` restores that revision's routines/schedule; workouts logged after it remain.
6. Pruning never drops a `plan apply` revision (test with a clock 30 days on).
7. Restore drill after the schema addition (BACKEND rule 7); receipt in the report. `./check` + server suite green.

## Decisions made on Emilio's behalf

- Keep-my-history semantics for apply and revert; refusing during a live workout; keeping apply revisions forever `(unconfirmed)`
  — behaviour.
- Command names, column names — implementation.

## READY checks

1 DECs: DEC-123 §2, DEC-128 §4–5, DEC-132, DEC-133, DEC-141; BACKEND rules 5–8. 2 Siblings: req-237 edits `ops-cli.mjs` /
`server/start` (backups) — build req-237 first, then req-245. 3 None. 4 Prune numbers from `store.mjs:241`. 5 Trigger: the live
DB schema (`db.mjs`) → **independent reviewer**; the first live `apply` is a rule-5 write → backup + Emilio's yes with counts.
6 Marked.
