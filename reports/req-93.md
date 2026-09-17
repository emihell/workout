# req-93 — in-workout list: main implied + bold, only warm-up/finisher labelled

Branch: `req-93` (off `main`). Labelling/emphasis only, no data/logic change.

## Technical

- **New helper `roleTag(role)`** in `src/ids.js` (next to `roleLabel`, which is
  unchanged): returns `''` for `main` / absent role, and the role's label for
  non-main roles (warm-up → "WU routine", finisher → "Finisher", cardio → "Cardio").
  Absent role counts as main (`ids.js:70` already defaults that way).
- **`src/views/workout/overview.jsx`** — added a local `ExerciseLabel` component used
  by both the live in-workout list and the pre-start preview:
  - main / no role → name only, wrapped in `<strong>` (bold).
  - non-main → name + a small muted `<span class="ui-role-tag">` label.
  - The `· WU set` (preview) and `· done` (live) suffixes are unchanged, appended by
    the caller.
- **`src/views/workout/item.jsx`** — both `ExerciseTitle` call sites now pass
  `roleTag(item.role)` instead of `roleLabel(...)`. `bits` are filtered by Boolean, so
  a main exercise drops the role from the sub-line (no "Main"); warm-up/finisher still
  show their label. This keeps the active-logging header and the completed-item header
  consistent with the list.
- **`src/ui/ui.css`** — `.ui-role-tag`: caption size, normal weight, secondary ink —
  the lighter/secondary treatment that makes a non-main row read distinct from a bold
  main row.

## Verified

- `./check` green — lint, 261 tests (incl. new `req-93 roleTag` suite: `# pass 8 # fail 0`
  in `src/ids.test.js`), build all passed.
- `roleTag` unit test asserts: main/undefined/null/'' → `''`; warmup/finisher/cardio →
  their `roleLabel` wording.
- No existing test asserted "— Main" in the list (searched), so none needed updating.

## Could not verify from here (browser — for Emilio)

- The visual feel: main rows bold + label-free, warm-up/finisher with the muted tag,
  in a live workout — and the watch-out that bold main rows don't fight the
  `ui-row--done` mute (0.45 opacity dims the whole row uniformly, bold included, so it
  should hold, but wants eyes).
- Consistency on the item screen and pre-start preview (main unlabelled everywhere).

## Workflow

- **Scope note:** the spec named `overview.jsx:132` and `item.jsx:428` explicitly. I
  applied `roleTag` to **both** `item.jsx` `ExerciseTitle` call sites (the active-logging
  header at ~323 as well as the completed-item header at 428) — leaving one labelled and
  one not would violate the spec's own "so main isn't labelled in one place and labelled
  in another." History/finish screens and `Routine.jsx` (the editor) still use
  `roleLabel` and are untouched, per out-of-scope.
- Exact tag treatment was mine to choose (spec: "reads clearly different from a main
  exercise"): bold black name for main vs. regular name + small gray tag for non-main.
  Easy to adjust if Emilio wants a stronger distinction (e.g. uppercase eyebrow).
