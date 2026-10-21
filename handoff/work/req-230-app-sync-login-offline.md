**Status: READY** **Lane: backend + ui** (rules: `rules/BACKEND.md`) · req-146 stage 1, part 2 of 3 · after **req-229**

# req-230 — the app logs in, works offline, and syncs with the server

DEC-127/128/129. The same app, served by req-229's server, keeps the phone's browser storage as its working copy (offline-first)
and syncs it with the server. **The GitHub Pages build behaves exactly as today** (DEC-129) — no login, no sync.

## Facts, rescanned 2026-10-21 on `main` `dcacdf2`

- Every state change goes through `setState` → `saveState(next)` (`src/store.jsx:45-52`); load is `loadState`
  (`src/persistence.js`, key `workout-mvp-v9`, `:8`). The sync hooks in there — one place, not per action.
- Unreadable stored data (DEC-032): `loadUnreadable` latches and `saveState` refuses to write (`src/persistence.js:34-57`).
- Other-tab change → warn-only banner (`src/persistence.js:59-108`, DEC-029).
- Import = `applyBackup` + Keep my history / Replace everything (`src/store.jsx` `applyBackup`, `src/exchange.js:866-871`, req-220).
- Pages build: `base` is `/workout/` when `GITHUB_PAGES=true` (`vite.config.js`). No service worker or manifest today
  (`grep -ril serviceWorker src index.html public` → nothing; `public/` = `favicon.svg`).
- Feedback notes: `workout-dev-notes-v1`, `saveNote` / `loadNotes` (`src/dev/dev-notes.js:21,108-120`).

## Scope

1. **Two builds, one code base:** a server build (sync on) and the Pages build (sync off, today's behaviour byte-for-byte in
   what the user sees). Builder picks the switch (build flag); the Pages build must not contain a login screen.
2. **Opens with no signal:** a service worker caches the app shell so the server build opens offline once loaded (HTTPS via
   Tailscale makes this possible). Updates: a new version takes over on the next open, never mid-workout.
3. **Login:** username + password screen when there's no session and no logged-in user on this device. Once logged in, the
   app opens straight from local data even offline; the server's 401 later → login prompt **without** touching local data.
4. **Sync:** after each save (debounced ~2 s), on open, on coming back online/visible. Sends `{baseRev, state}`; takes the
   server's merged result. A local change made while a sync was in flight is never overwritten (re-sync on top).
5. **Never sync broken data:** while `loadUnreadable` is set, no push and no pull over it (DEC-032 holds).
6. **First login on a device (DEC-132 §1):** the device takes the server's copy — no special handling of data already on the
   device (one user today; his data goes up once by hand at go-live, req-231). Server empty → the device's data goes up.
7. **Status (DEC-132 §2):** Settings → Backup & data shows one line: "Synced · 2 min ago" / "Not synced yet — saved on this
   phone, will send when online". **No conflict banner** (the losing version stays on the server).
8. **Log out (DEC-132 §3):** always allowed, online or not. Data stays on the device; anything not yet synced goes up on the
   next login. (Clearing the device on logout returns with other users, stage 2.)
9. **Feedback notes:** sent to the server when saved (queued while offline); the on-device list and its export stay.
10. **Export / Import unchanged** (BACKEND rule 10). An Import — Keep my history and Replace everything — is a normal state
    change → it syncs like any other (Emilio: "if the user upload data from the import/export, then we need to upload that to
    the server as well"). Test both.
11. **Password rule (DEC-132 §4):** at least 6 characters — change req-229's server check (≥ 8) to match, with its test.

## From req-229's build (2026-10-21) — must be handled here

- **The server serves the built app** (same origin, so the `Secure; SameSite=Strict` cookie works; req-229 doesn't serve it).
  Check the same-origin guard behind `tailscale serve` (Host / X-Forwarded-Host).
- **A running cardio stopwatch must survive a sync.** req-229 stores what `applyBackup` returns, which drops
  `activeWorkout.stopwatch` and defaults a missing schedule anchor. A sync mid-workout must never stop the user's stopwatch —
  fix on whichever side is right (server keeps it, or the app keeps its local live fields); a test logs with a running
  stopwatch, syncs, and the stopwatch is still running.
- **First sync onto an account with data:** a device at `baseRev 0` merges against empty → every differing record is a conflict.
  §6's rule (device takes the server's, its own downloaded first) avoids that path; assert it's never taken on first login.
- **One push at a time** (req-229 review, latent): the server has no device identity, so two overlapping pushes from one device
  with the same `baseRev` merge against each other (add R, then delete R → R comes back). The app sends one push at a time and
  adopts the returned `rev` before the next. Test the add-then-delete case.
- **Oversized upload** (review nit): over the server's 20 MB cap the client sees EPIPE (a network error), not 413 — the app
  must not read that as "offline, retry forever"; show a clear failure after a bounded retry.
- **Anchor on a rev-0 base** (req-229 review nit): when the base is the anchor-less rev 0, an on-purpose anchor change
  (an Import keeps the file's anchor) is lost silently if the other side changed slots; matters only with `loopWeeks > 1`.
  Covered if §6 keeps first login off the baseRev-0 merge path.
- **Revision growth** (review, latent): every accepted revision stores the whole doc (`src/db.json` = 197,771 bytes); syncing
  per set adds MBs per workout. Prune old revisions the merge can no longer need (keep any rev a device may still hold as
  base, plus the conflict copies), or sync less often — Builder's choice, stated.

## Out of scope

Server code (req-229). Deploy, moving Emilio's real data (req-231). Sign-up screen for other users (stage 2 — invites only
via the script). Analytics key (`workout-mvp-analytics`). Any change to `workout-mvp-v9`'s shape.

## Acceptance criteria

1. **Pages build unchanged:** the existing suite green, plus a test that the Pages build's state path never calls the network.
2. Against a local req-229 server on a temp DB (integration test): log a set → within the debounce the server's rev rises and
   holds the set.
3. **Failure — offline:** network off (mock fetch rejects) → log 3 sets → all in local storage, status "Not synced yet";
   network back → one sync carries all 3; nothing lost, nothing doubled.
4. **Failure — unreadable local data:** with `loadUnreadable` set, no request leaves the app (assert fetch not called).
5. **Merge round trip:** two app instances on one user (two storages): A edits a routine, B logs a workout offline, both sync →
   both instances end with both changes. Same routine edited on both → no banner; the newest wins, the other is on the server.
6. **Failure — session expired:** server returns 401 → login prompt; local data byte-identical before/after.
7. **Logout offline:** log a set offline → log out (allowed) → data still on the device → log in online → the set reaches the
   server. An Import (each choice) → the server's rev rises and holds the imported data.
8. Planner's browser run (`plan qa`-style isolated origin + local server): login, log a set, airplane-mode-style offline
   (DevTools), reload → app still opens with the set.
9. `./check` green.

## Decisions made on Emilio's behalf

- **implementation:** build flag for sync; service worker for offline open; debounce ~2 s; sync hooked at `saveState`.
- **behaviour:** decided by Emilio 2026-10-21 → DEC-132 (first login, status line, logout, password). New version takes over
  on the next open (unconfirmed).

Trigger files (`store.jsx`, `persistence.js`): **independent reviewer** + backup reminder before merge (WORKFLOW check 5).
