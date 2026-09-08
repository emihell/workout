# req-01 — guard saveState against a failed write

**Status: BUILT AND MERGED, 2026-09-08 — branch `req-01` (`85d3887`…`85d3887`, 1 commit).** — decision made (DEC-001: persistent banner). Safe to build.

## Why

`saveState` (`src/storage.js:37`) is the only path that persists state, and it is **unguarded**:

```
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))   // can throw
}
```

It runs inside the store's updater on **every** state change (`src/store.jsx:13-19`), so a throw propagates out of a React `setState` updater. `localStorage.setItem` throws in real, reachable cases: quota exceeded (history grows unbounded), and Safari/iOS Private Mode (throws on every write). `loadState` is already wrapped in try/catch; `saveState` is not. [measured] — `loadState` has `try/catch` (storage.js:21-35), `saveState` does not (storage.js:37-39).

For an app whose entire value is a trustworthy record, a **silent** save failure is the worst outcome: the user keeps logging, sees their sets on screen (React state updated), and loses them on reload with no warning.

## The behaviour (decided — DEC-001)

On a failed save, show a **persistent banner** — visible app-wide, not a transient toast — with wording to the effect of: *"Couldn't save your last change. Your data may not persist — export a backup from Settings."* It stays until the next **successful** save, then clears. Silent/console-only is explicitly rejected (indistinguishable from data loss to a real user).

## Scope

- Wrap the write in `saveState` so a throw cannot escape the store updater.
- Track a "last save failed" signal the UI can read, and render the persistent banner from it.
- Clear the signal (and the banner) on the next successful save.
- Keep the successful path byte-for-byte unchanged (same key, same JSON).

## Out of scope

- Quota management / pruning old history (separate backlog item if it ever bites).
- Changing the storage key or schema; any migration change.
- Retry/queueing of failed writes — just surface, don't auto-retry.

## Ordered steps

1. In `saveState`, `try { localStorage.setItem(...) } catch (e) { ... }` — on catch, set a "save failed" signal and do **not** throw; on success, clear it. Shape of the signal (module flag + subscribable event, a returned boolean the store threads into state, or a small store field) is CC's call — pick the one that fits the existing store cleanly and name it in the report.
2. Render a persistent banner in the app shell whenever the signal says the last save failed; remove it on the next success. Plain, legible, not dismissable by the user (dismissing would re-hide a live data-loss condition) — it goes away on its own when a save succeeds.
3. Tests (`node --test`): (a) stub `localStorage.setItem` to throw → `saveState` does not throw **and** the failure signal is set; (b) a normal save leaves the signal clear; (c) a throwing save followed by a succeeding one ends with the signal clear.

## Acceptance criteria (written before implementation)

- **Happy path:** a normal state change still writes `workout-mvp-v8` identically; existing storage tests stay green; `./check` green. Paste the green `./check` line.
- **Failure case (required):** with `localStorage.setItem` stubbed to throw, completing a set does **not** crash and does **not** throw out of the store; the banner appears. Command: the new unit test(s), output pasted.
- **Recovery:** a throwing write followed by a succeeding one clears the banner. Covered by test (c).
- **Right mechanism:** the tests assert the *signal*, not just "no throw" — a bare `catch {}` that swallows silently must fail criterion (a).

## Decisions

- **behaviour (Emilio, DEC-001):** persistent banner on save failure. Confirmed 2026-09-07.
- **implementation (CC's call, list in report):** how the failure signal is plumbed; exact banner placement/markup.

## Notes

`loadState` already fails safe (a corrupt key returns `emptyState()` without overwriting storage), so this requirement is only about the *write* side. Human "use it" gate before merge: trigger a real failure (e.g. fill quota, or a private-window write) and confirm the banner shows and clears.
