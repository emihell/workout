# req-198 — bar: History replaces Settings; Settings becomes "Backup & data" under History

**Status: READY** (2026-10-07). **Lane: ui.** From DEC-110 §1, **amended by DEC-111 then DEC-112**: the bottom bar is removed; Home gets "Workouts ›" at the top; deep screens get a "Today" link in the Back row (not where Back is already "/", not in a workout). Scope 1–2 below are superseded by DEC-112; 3–6 stand. First of req-198 to req-202, built in order. req-199 and req-200
touch `BottomMenu.jsx` / `route.js` after this one.

## Code today (main `166266a`)
- **The bar** (`ui/BottomMenu.jsx:93-122`) has three controls:
  - Library: a circle, grid icon, `/routines`, `aria-label` only.
  - Workout: the oval, `/`.
  - Settings: a circle, sliders icon, `/settings`.
- **The bar hides** for any route name starting with `workout` (`:95`).
- **`activeTab`** (`route.js:120-137`) sends `settings` → 'settings', `components` → null, and routine/exercise/schedule →
  'library'. Everything else, History included, goes to 'workouts', which lights the Home oval.
- **History** (`views/history/list.jsx:92`) has `<Back to="/" />` at its top.
- **Settings** (`views/Settings.jsx`) holds: Assistant prompt checkbox, Export, Export analytics, Import, Components ›,
  Feedback notes ☐.
- **First-run Home** repeats the bar as rows: Routines / Schedule / History / Settings (`views/Today.jsx:367-372`).
- **The save-failed banner** reads "…export a backup from Settings." (`App.jsx:43`).
- **Tests that lock the grouping:** `route.test.js:193-249` and `BottomMenu.test.js` (review F16).

## Scope
1. **Bar:** Library (circle) · Workout (oval) · **History** (circle, a clock/list icon) → `/history`.
   - Each circle gets a **visible text label** under or inside it: "Library", "History" `(unconfirmed)`.
   - The labels change again in req-199/req-201.
2. **`activeTab`:** `history*` → 'history'. The `settings` route (kept, reached from History) → 'history'.
3. **History main screen:** no Back (DEC-015, it is top-level now). At the bottom, always, even with zero workouts, a
   **"Backup & data ›"** row → `/settings`.
4. **Retitle `/settings` "Backup & data".** Order:
   - Export, then Import.
   - Then a separated "Developer" group: Assistant prompt, Export analytics, Feedback notes, Components ›.
   - Back → `/history`.
5. **The save-failed banner** gets an **Export** button that downloads the backup in place (same as Settings' Export). Its
   copy no longer says "from Settings".
6. **First-run Home** (`Today.jsx:367-372`): drop the Settings and Schedule rows that duplicate the bar. Import stays.

## Out of scope
- Renaming Routines (req-201).
- Removing Library (req-199).
- Home week (req-200).
- A backup nudge.

## Acceptance
1. Browser: the bar shows Library · Workout · History with visible labels. Tapping History lights History. `/settings`
   lights History.
2. Browser: History → Backup & data → Export downloads. Import of a backup completes.
3. **Failure case:** with routines but **zero workouts**, History still shows "Backup & data ›", and Import from there
   completes. Receipt: `workout-mvp-v9` workouts count after import.
4. Unit: the banner renders an Export button. Edits to `route.test.js` and `BottomMenu.test.js` are named in the report.
5. `./check` green. The smoke test passes. Update `scripts/smoke.mjs` if it navigates via Settings.
