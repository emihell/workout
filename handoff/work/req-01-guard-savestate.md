# req-01 — guard saveState against a failed write

**Status: NEEDS DECISIONS** — one behaviour question (how a save failure is surfaced). Answer it and this flips to READY.

## Why

`saveState` (`src/storage.js:37`) is the only path that persists state, and it is **unguarded**:

```
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))   // can throw
}
```

It runs inside the store's updater on **every** state change (`src/store.jsx:13-19`), so a throw propagates out of a React `setState` updater. `localStorage.setItem` throws in real, reachable cases: quota exceeded (history grows unbounded), and Safari/iOS Private Mode (throws on every write). `loadState` is already wrapped in try/catch; `saveState` is not. [measured] — `loadState` has `try/catch` (storage.js:21-35), `saveState` does not (storage.js:37-39).

For an app whose entire value is a trustworthy record, a **silent** save failure is the worst outcome: the user keeps logging, sees their sets on screen (React state updated), and loses them on reload with no warning.

## Scope

- Wrap the write in `saveState` so a throw cannot escape the store updater.
- On failure, surface it to the user (see the open decision) — never fail silently.
- Keep the successful path byte-for-byte unchanged (same key, same JSON).

## Out of scope

- Quota management / pruning old history (separate item if it ever bites).
- Changing the storage key or schema.
- Any migration change.

## Open decision (this is what blocks READY)

**How should a save failure be surfaced?** A user would notice this, so it's Emilio's call.

- **(A) Persistent visible banner** — "Couldn't save your last change. Your data may not persist — export a backup from Settings." Stays until the next successful save. *Planning recommends A*: for a data-integrity app a transient toast can be missed, and silent is unacceptable; a banner is proportionate to "you may be losing data".
- (B) Transient toast — less intrusive, but missable.
- (C) Console-only — rejected: indistinguishable from silent to a real user.

Recommendation: **A**, unconfirmed until Emilio says so.

## Ordered steps

1. In `saveState`, `try { localStorage.setItem(...) } catch (e)` — on catch, record a "save failed" signal the UI can read (e.g. a module-level flag + a subscribable event, or a return boolean the store propagates). Do not throw.
2. Wire the chosen surface (A/B/C) into the app shell so it shows whenever the last save failed and clears on the next success.
3. Add a unit test that stubs `localStorage.setItem` to throw and asserts (a) `saveState` does not throw, and (b) the failure signal is set. Add a second asserting a normal save leaves the signal clear.

## Acceptance criteria (written before implementation)

- **Happy path:** a normal state change still writes `workout-mvp-v8` identically (existing storage tests stay green). `./check` green.
- **Failure case (required):** with `localStorage.setItem` stubbed to throw, completing a set does **not** crash the app and does **not** throw out of the store; the failure surface appears. Command: the new unit test, output pasted in the report.
- **Recovery:** after a throwing write is followed by a succeeding one, the failure surface clears.
- **Right mechanism:** the test asserts the *signal/surface*, not just "no throw" — a bare `catch {}` that swallows silently must fail this criterion.

## Decisions made on Emilio's behalf

- **implementation:** how the failure signal is plumbed (flag+event vs. return value) — CC's call, list it in the report.
- **behaviour:** the failure surface (A/B/C) — **Emilio's**, see the open decision. Not built until answered.

## Notes

`loadState` already fails safe (a corrupt key returns `emptyState()` without overwriting storage), so this requirement is only about the *write* side.
