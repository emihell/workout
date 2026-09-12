# req-36 — corrupt `workout-mvp-v8` key is never overwritten

Branch `req-36`. Persisted-data / trust req (DEC-032, DEC-009) → **not merged; Emilio's
hands before merge.**

## Technical

The problem: `loadState` read, parsed, and migrated inside one `try`; any throw fell
to a blanket `catch` returning `emptyState()` — indistinguishable from a blank device.
The store seeds from that and the first mutation's `saveState` then wrote empty state
over the corrupt-but-recoverable key. Fix distinguishes **absent** from
**present-but-unreadable** and refuses to overwrite the latter.

**`src/storage.js`**
- New signal trio `getLoadUnreadable` / `subscribeLoadUnreadable` / `setLoadUnreadable`
  (module flag + listener set), parallel to the existing `saveFailed` trio.
- `loadState` refactored: reading the raw value is now a separate `try` from
  parsing/migrating it.
  - Reading `localStorage` throws (access denied) → clear signal, `emptyState()`
    (nothing legible to preserve).
  - `raw` absent/empty → clear signal, `emptyState()`. **Byte-for-byte the old blank
    path.**
  - `raw` present but `JSON.parse`/`migrateState` throws → `setLoadUnreadable(true)`,
    return `emptyState()`, **no save, no legacy-key removal** — the raw value is left
    untouched.
  - Happy path (parse+migrate succeed) → `setLoadUnreadable(false)`, then the
    unchanged re-save + `removeLegacyKeysIfV8Persisted()` logic.
- `saveState` guarded: `if (getLoadUnreadable()) return false` before any `setItem` —
  the corrupt key is preserved untouched; the store's mutation is a no-op.

**`src/App.jsx`**
- New `LoadUnreadableBanner` (distinct component, distinct wording, separate signal),
  rendered next to `SaveFailedBanner`. Wording: *"Couldn't read your saved data. It's
  still on this device but unreadable — don't clear your browser data. Nothing you do
  now will be saved. Seek recovery before making changes."*

**`src/storage.test.js`** — new `req-36 corrupt v8 guard` describe (4 tests):
- (a) **core anti-regression**: seed a non-JSON `v8` value → `loadState` returns
  `emptyState`, latches `getLoadUnreadable()`, and a subsequent `saveState` returns
  `false` with the raw stored string **byte-for-byte unchanged** (asserts the
  preserved value, not just "no throw").
- (b) absent key → blank device, signal clear, saves work.
- (c) valid `v8` → signal clear, loads normally.
- unreadable legacy-only key (no v8) → counts as unreadable (only surviving copy
  preserved); final readable load clears the signal (also serves as cross-test cleanup).

### Implementation choices left open by the spec
- **Unreadable legacy-only key counts as unreadable** (spec said "lean yes"). It's the
  only surviving copy, so it gets the same preserve-don't-overwrite treatment. Falls
  out naturally: `raw` is the legacy value, its parse throws, same branch.
- **`localStorage.getItem` itself throwing** (access denied) is treated as *absent*,
  not unreadable — there is no legible value to preserve and no bytes at risk, so
  latching a permanent banner would be wrong. Signal cleared, `emptyState()`.
- **Signal reflects the current stored value**: every non-corrupt path
  (`setLoadUnreadable(false)`) clears it, so a session that recovers (reload with a
  readable value) drops the banner. Latched-true holds all saves until such a reload —
  the intended "hold saves" behaviour.
- **Banner as a separate component**, not a variant of `SaveFailedBanner` — different
  signal, different wording, and both can show independently.

### Verification
`./check` — green:
```
# tests 149 ... # pass 149 # fail 0
check: green — lint, 14 test file(s), and the build all passed.
```
Core preservation test (criterion a):
```
# Subtest: req-36 corrupt v8 guard
    ok 1 - (a) preserves a corrupt v8 value byte-for-byte across a mutation
    ok 2 - (b) an absent key is a blank device: signal clear, saves work
    ok 3 - (c) a valid v8 value clears the signal and loads normally
    ok 4 - an unreadable legacy-only key (no v8) counts as unreadable
ok 4 - req-36 corrupt v8 guard
```

Acceptance criteria: **Preservation** ✅ test (a). **Absent unchanged** ✅ test (b) +
existing storage/req-06 tests green. **Right mechanism** ✅ test (a) asserts the raw
preserved value. **Distinct banner** — separate component/signal/wording in code;
visual confirmation is Emilio's at the merge gate. **`./check` green** ✅.

## Workflow

- Built exactly to spec/DEC-032. No scope added or dropped.
- **Out of scope, as instructed**: no discard/quarantine recovery action. The "Open"
  section still stands — holding all saves is a dead-end if the data is genuinely
  unrecoverable, and the follow-up (confirmed "discard & start fresh" vs.
  auto-quarantine to a `-corrupt-<ts>` side key) is Emilio's pick at the merge gate.
- No decisions taken mid-build with Emilio; the three implementation choices above are
  CC's call per the spec ("implementation … list in report") — candidates for a `DEC-`
  only if Emilio wants the legacy-key and access-denied rulings pinned.
- Did **not** run the browser "use it" gate (needs a real device + planting a corrupt
  value via dev tools). Left for Emilio — see below.

## Ready to look at (merge gate — branch `req-36`)

1. **What it does**: If your saved data (`workout-mvp-v8`) is ever present but
   unreadable, the app no longer silently shows a blank history and then overwrites the
   corrupt value on your first change. It shows a distinct persistent banner and stops
   saving, so the raw value stays on disk and recoverable.

2. **What to test** (open the app on branch `req-36`; **follow L-001 — snapshot the
   real `workout-mvp-v8` value in dev tools first**):
   1. With your normal data, everything loads and saves as before — no new banner. (y/n)
   2. In dev tools, set `workout-mvp-v8` to a non-JSON string (e.g. `not json`), then
      reload. Does the **"Couldn't read your saved data…"** banner show, distinct from
      the save-failed one? (y/n)
   3. With that banner showing, does history read empty (app still usable)? (y/n)
   4. **Critical**: make a change (add an exercise/routine). Then check `localStorage`
      in dev tools — is `workout-mvp-v8` **still your planted corrupt string, unchanged**
      (not overwritten with empty state)? (y/n)
   5. Restore your snapshotted value, reload — banner gone, data back, saves work. (y/n)

3. **What I could not verify myself**: anything visual/on-device — that the banner
   renders and reads clearly, and the byte-preservation in a *real* browser
   `localStorage` (tests prove it against the mocked store). And your call on the
   "Open" follow-up (discard vs. quarantine) before this becomes a usable dead-end.
</content>
