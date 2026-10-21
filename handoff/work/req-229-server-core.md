**Status: BUILT AND MERGED, 2026-10-21 — branch `req-229` (`7fc3291`…`124c5e3`, 4 commits).** **Lane: backend** (rules: `rules/BACKEND.md`) · req-146 stage 1, part 1 of 3 (229 → 230 → 231)

# req-229 — the server: accounts, each user's data, feedback notes, sync with merge

DEC-127/128. A Node server in `server/` that stores each user's data and notes and merges what devices send. **No app
change** (that's req-230) and **nothing live** (that's req-231): this req ends with a server that runs on a temp DB in tests.

## Facts, rescanned 2026-10-21 on `main` `dcacdf2`

- App state lives in one localStorage key, `workout-mvp-v9` (`src/persistence.js:8`); `SCHEMA_VERSION = 9` (`src/model.js:6`).
- Export file = `{ kind: 'workout-mvp-backup', version: 1, exportedAt, state }` (`src/exchange.js:446-455`).
  `applyBackup(payload)` validates + migrates and throws a friendly error on a bad file (`src/exchange.js:578-589`); it already
  runs under `node --test` (`src/exchange.test.js`), so the server reuses it as its validator — no second copy of the rules.
- Top-level state: `exercises`, `routines`, `workouts`, `draftWorkouts`, `plannedWorkouts` (arrays of `{id,…}`), `schedule`,
  `activeWorkout`, `legacyRecommendations`, `schemaVersion` (`src/exchange.js` `FIELDS.state`). No per-record `updatedAt`
  exists (`grep updatedAt src/model.js` → nothing).
- Feedback notes: own key `workout-dev-notes-v1`, records `{route, timestamp, text, context}` (`src/dev/dev-notes.js:21,29-36`).
- `node:sqlite` works on this Mac's Node (v26.8.2) with no flag [measured: `new DatabaseSync(':memory:')` → insert/select ok].
  `.nvmrc` and CI say `22` — on 22 it needs ≥22.13 [inferred]; Builder states the floor the server needs.
- Tailscale `serve` on this Mac today: `:443`→4173 (workout previews), `:8443`→8000 (White Sleeve), `:8444`→8898,
  `:8445`→8010 [measured: `tailscale serve status`]. Free for us: **`:8446` → `127.0.0.1:8100`** (used in req-231).

## Scope

1. **`server/`**: Node, built-in `node:http` + `node:sqlite` + `node:crypto`. A new runtime dependency only if a built-in
   can't do it — name it and why in the report.
2. **Accounts (invite-only, like White Sleeve):** `server/accounts.mjs bootstrap --username <u>` (prompts for a password),
   `invite` (mints a one-use code), `disable <u>`. Passwords: `crypto.scrypt` + per-user salt. Register needs a valid code.
   Login → session cookie `HttpOnly; Secure; SameSite=Strict`, sessions stored hashed, logout deletes it. CSRF: every write
   needs a header the browser only sends from our own page (e.g. a custom header + same-origin check).
3. **Each user's data:** one current document per user (the Export `state`), plus every accepted revision (`rev` 1, 2, 3…)
   so a merge has its base and nothing is ever lost. Data is per-user from day one: no query reads another user's rows
   (test it).
4. **Sync API:** `GET /api/state` → `{rev, state}`. `PUT /api/state {baseRev, state}` → validate with `applyBackup`
   (reject → 400 with its message, nothing stored). If `baseRev` = current → store as `rev+1`. If older → **three-way merge**
   (base = `baseRev`'s doc, mine = incoming, theirs = current), store the result as `rev+1`, return `{rev, state, merged:true,
   conflicts:[…]}`.
5. **The merge (DEC-128 §2, Planner's call):** arrays of `{id}` merge per id; `schedule`, `activeWorkout`,
   `legacyRecommendations` are each one record. A record changed on one side only → that side. Deleted on one side and
   untouched on the other → deleted. **Changed on both sides → the incoming (newest) one wins, and the losing version is
   listed in `conflicts`** (stored with the revision — nothing silently dropped). Pure function in its own file, unit-tested.
6. **Feedback notes:** `POST /api/notes` (append; dedupe on `timestamp`+`text`), `GET /api/notes`. Per user.
7. **Export/Import stay** in the app (BACKEND rule 10); the server adds `GET /api/export` → the same Export file.
8. **Health:** `GET /api/health` → `{ok, rev counts}` without auth details; binds `127.0.0.1` only; port from env, default 8100.
9. **Tests** (`node --test`, picked up by `./check`): every case below on temp DBs; the suite guard of BACKEND rule 8.

## Out of scope

The app talking to the server, login screen, service worker (req-230). Deploy, Tailscale, backups, the live DB, importing
Emilio's data (req-231). Sharing between users, training together, AI (stage 3). Public hosting (ask-gate 3).

## Acceptance criteria (tests; paste the output)

1. Bootstrap → login → `GET /api/state` on a new user → `{rev:0, state: emptyState}`; wrong password → 401, nothing else
   revealed (same message for unknown user).
2. `PUT` an Export of `src/db.json` → rev 1; `GET` returns it deep-equal after `applyBackup`.
3. **Failure — bad file:** `PUT` `{state:{workouts:"x"}}` → 400 with `applyBackup`'s message; rev unchanged; nothing stored.
4. **Merge:** from rev 1, device A edits routine R, device B (base 1) finishes workout W → final has both. Both edit routine R →
   B's (newest) wins, A's version is in `conflicts` and still readable from storage.
5. **Delete vs edit:** A deletes exercise X (untouched by B) → gone after B's sync. A deletes X, B edits X → B's edit wins
   (newest), A's deletion listed as a conflict.
6. **Isolation:** user 2 can't read or write user 1's state, revisions or notes (every endpoint, 401/404).
7. **Failure — no session / bad CSRF header:** every write → 401/403, nothing stored.
8. **Notes:** post 3, re-post one → 3 stored; `GET` returns them in order.
9. **Secrets:** the server refuses to start when its data/secret path is inside the repo tree (BACKEND rule 1).
10. `./check` green (with req-228 merged first, under `LANG=en_GB.UTF-8`).

## Decisions made on Emilio's behalf

- **implementation:** Node built-ins, no framework; `server/` in this repo; port 8100; scrypt; whole-document storage per
  revision; three-way merge on the server (no per-record timestamps, so **no app schema change**).
- **behaviour (unconfirmed):** both-sides edit → newest wins, loser kept (already DEC-128 §2); invite-only even for stage 1.

Order: after **req-228** (gate green locally). Reviewer: independent review (new trust boundary — auth).
