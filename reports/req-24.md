# req-24 — native confirm/alert → in-app confirm sheet (DEC-079)

Branch `req-24`. Not a persisted-data change.

## Technical

**Primitive.** `src/ui/confirm.js` is a small module-level store: `askConfirm(message, { confirmLabel })` returns
`Promise<boolean>`. `answerConfirm`, `getPendingConfirm` and `subscribeConfirm` are also exported. It is plain JS, so
non-React modules can ask (`workout-actions.js`, `import-backup.js`) and `node --test` can drive it.
`<ConfirmSheet/>` (`src/ui/index.jsx`) is mounted once in `App.jsx` and renders the open question. It is a bottom sheet
(`role="alertdialog"`) over a dimmed backdrop, with [Cancel] on the left and the destructive button on the right
(DESIGN §4 order). The destructive button is ink-filled (primary) and Cancel is light (secondary), which keeps it
grayscale per DEC-017. Cancel gets focus, so a stray Enter never destroys. The backdrop, Escape and any hash
navigation all cancel. Only one sheet is open at a time: a new ask resolves the old one to `false`. It sits at
z-index 30, above the dock (10) and the rest pill (20).

**Sites.** All 12 confirms now `await askConfirm(<same message>)`. The enclosing handlers became `async`, and
`startOrContinue`, `continueInProgress`, `abandonInProgress` and `abandonWorkout(store)` are now async. No caller
uses their return value (all are `onClick`), checked with
`git grep -n -E "importWithBackup|startOrContinue|continueInProgress|abandonInProgress|abandonWorkout\(store" -- src ':!*.test.js'`.

**Import validates first.** `importWithBackup` runs exchange's pure `applyBackup` (as `validateBackup`) before asking.
A bad file rejects with the same error. Nothing is asked, nothing downloaded, nothing replaced. The injected
parameter was renamed `confirm` → `ask`, so the acceptance grep stays clean. Both import sites `await` it.
`Today.jsx` (first-run import) now shows the error in a `Banner role="alert"`, as Settings already did.

**`Pick effort.` — unreachable, deleted** (`item.jsx`). The submitted effort is the non-clearable
SegmentedControl's value (2–5), which starts from `formFieldsWithDraft().effort`. That value is never falsy:
`initialSetFields` defaults to 3, a restore maps to `rpeOptionValue(rpe) || rpe`, and a draft with `''` falls back
to the seed. `src/req-24.test.js` checks 12 seed×draft combinations, including rpe `0`/`null`/skipped.

**Guard.** `src/req-24.test.js` walks `src/` (`.js`/`.jsx`, excluding `*.test.js`) and fails on
`window|globalThis|self .confirm/alert/prompt` or a bare `confirm(`/`alert(`/`prompt(`. It skips comment lines,
because the first run flagged prose in `storage.js:439` ("the delete confirm (…)"). A second test pins the pattern
against native forms and look-alikes (`askConfirm(`, `store.confirm(`, `role="alert"`).

**Choice the spec left open — the destructive button's label** is per action instead of the native "OK": Delete
(exercise, routine, workout), Remove (routine exercise, loop weeks, slot, set), Abandon (×4), Replace (import). This
follows the spec's "Delete {x}? [Cancel] [Delete]" shape. Messages are unchanged.

### Receipts

Acceptance grep, `git grep -n -E "window\.(confirm|alert|prompt)|[^.a-zA-Z](confirm|alert|prompt)\(" -- src ':!*.test.js'`:
```
(no output)   git grep exit: 1
```
Guard passing, `node --test src/req-24.test.js`:
```
# tests 17
# pass 17
# fail 0
```
Guard failing when a `window.confirm` is appended to `src/views/history/edit.jsx` (then reverted):
```
    not ok 1 - no window.confirm / alert / prompt, or bare confirm( / alert( / prompt(, outside tests
        0: "views/history/edit.jsx:212: export const probe = () => window.confirm('probe')"
# pass 0
# fail 1
```
Import (`src/import-backup.test.js`, 6/6): a bad file → no ask, no download, state untouched. A valid backup goes
through the real sheet: message "Replace all data on this device?" with label Replace; Cancel → `null`, no download,
old data; Replace → one download, then new data. An analytics-export payload never opens the sheet.
`Pick effort` grep in src (tests excluded): exit 1 (gone). Lint warnings: 21 before, 21 after.
```
check: green — lint, 55 test file(s), and the build all passed.
```

**Browser (dev server, Chrome; checked in a 390px iframe because the window wouldn't resize):**
- Sheet measured bottom-pinned at y 708–844 of 844. The buttons are 175px each. Cancel is `rgb(242,242,242)`,
  Delete `rgb(28,28,28)`. Cancel has focus when the sheet opens.
- Cancel checked against a byte-compare of localStorage, which stayed identical:
  - history Delete (`Delete Test Routine?`)
  - exercise Delete (req-119 head + "removes it from 1 routine")
  - routine Delete
  - Remove set
  - Remove slot
- Backdrop, Escape and navigation each closed the sheet.
- Confirm actually acts: Remove slot took the slots from 1 to 0. Start → Abandon → Cancel kept the active workout;
  Abandon → Abandon discarded it and went to `#/`.
- Settings import with an analytics-shaped file showed the Banner "Not a workout database backup." and no sheet.
  A valid backup opened `Replace all data on this device? [Cancel|Replace]`, and Cancel left the data unchanged.
- The dev localStorage was snapshotted first and restored byte-identical afterwards.

**Not browser-checked:**
- The loop-weeks confirm (the data has only week-0 slots and 1 loop week).
- Start-while-another-is-active and Continue-draft (only one routine exists).
- The Today first-run import banner (it needs empty data).

All three use the same `askConfirm`, and the first two are unit-tested in `workout-actions.test.js`.

## Workflow

- **Test edits (justified):**
  - `import-backup.test.js`: the malformed-payload test used to assert "one safety download was made". It now
    asserts no ask and no download, because validate-first is this req's required behaviour change. Calls are
    awaited and use `ask:`. Three tests were added.
  - `workout-actions.test.js`: the `window.confirm` stub became an auto-answering subscriber to the confirm store,
    and the calls are now awaited. It has the same 25 tests with the same assertions.
- **Avoided editing a test:** `req-121.test.js` pins App's exact `import { Banner, Button } from './ui/index.jsx'`
  line, so `ConfirmSheet` is imported on a separate line. That source-shape test is brittle. Worth an `L-` if it
  keeps biting.
- **Own slip, caught and fixed:** after the deliberate-fail probe I reverted with `git checkout -- edit.jsx`, which
  also discarded my uncommitted `askConfirm` edit in that file. I restored it from the copy I'd taken before the
  probe, and the diff was re-checked. Candidate `L-`: revert a probe by removing the line you added, never with
  `git checkout` on a file that has uncommitted work.
- **Handoff note:** the spec's table says `workout-actions.js:51/81/91` and `Today.jsx:328`. Those lines matched
  `main` at 8a502d5, so the spec is not stale.
