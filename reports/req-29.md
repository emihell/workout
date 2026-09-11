# req-29 — button-placement audit (DESIGN §4: forward=right, back/previous=left)

Branch: `req-29`. Presentation-only reorder of action controls so every two-action
surface puts the forward/primary action right-most and any back/previous/cancel
left-most. No behaviour, label, handler, or styling change.

## Technical

### The finding: it was app-wide, not just SetLogForm

All action rows use a normal LTR flex row (`.ui-actions`, `.ui-setlog__actions`,
`.ui-restbar__actions` — `src/ui/ui.css`; no `row-reverse` anywhere), so **DOM order =
visual left→right order**. [measured] Every `.ui-actions` form row rendered the primary
(Save/Next) *first* → on the **left**, with Cancel second → on the **right**. That is the
inverse of §4. So the audit was a systematic reorder across 11 surfaces, not a one-screen
fix.

### Implementation choice: markup order, not CSS reverse

Spec left this to CC. I reordered the **markup** rather than applying `flex-direction:
row-reverse`. Reason: markup order keeps **tab/focus order = visual order = §4 order**
(retreat first/left, forward last/right). A CSS reverse would flip the visual order while
leaving DOM/focus order primary-first — a focus-vs-visual mismatch and an accessibility
anti-pattern. Enter-key submit is unaffected: `Button` defaults to `type="button"`
(`src/ui/index.jsx:18`), so Cancel/Previous never submit; the sole `type="submit"` still
fires on Enter regardless of its position in the row.

### Every surface touched

| # | Surface | File:line | Before (L→R) | After (L→R) |
|---|---------|-----------|--------------|-------------|
| 1 | SetLogForm | `src/ui/index.jsx:362` | Complete · Skip · Previous | **Previous · Skip · Complete** |
| 2 | RoutineNewForm | `src/views/Routine.jsx:69` | Next · Cancel | Cancel · Next |
| 3 | Routine edit | `src/views/Routine.jsx:188` | Save · Cancel | Cancel · Save |
| 4 | ExerciseFields (routine) | `src/views/Routine.jsx:298` | Save · Cancel | Cancel · Save |
| 5 | Schedule form | `src/views/Schedule.jsx:94` | Save · Cancel | Cancel · Save |
| 6 | Exercise new | `src/views/Exercises.jsx:164` | Save · Cancel | Cancel · Save |
| 7 | Exercise edit | `src/views/Exercises.jsx:284` | Save · Cancel | Cancel · Save |
| 8 | Set edit | `src/views/set-edit.jsx:73` | Save · Cancel | Cancel · Save |
| 9 | History edit | `src/views/history/edit.jsx:40` | Save · Cancel | Cancel · Save |
| 10 | Recalc | `src/views/history/recalc.jsx:28` | Apply · Skip | Skip · Apply |
| 11 | Workout setup | `src/views/workout/setup.jsx:65` | Save · Cancel | Cancel · Save |

### Ambiguous-control decisions (my judgment, per spec)

- **Skip in SetLogForm** → placed **middle** (`Previous · Skip · Complete`). Complete is
  the primary forward action so it takes the rightmost thumb slot; Previous is the clear
  retreat so left-most; Skip is neither (it advances past the set without logging), so it
  sits between. When `canGoBack` is false the Previous slot is `null` and the row collapses
  to `Skip · Complete` — Complete still right-most.
- **Skip in Recalc** → treated as a **retreat** (it dismisses the recalculation and returns
  to history detail without writing), so left; Apply (commits the recalc) → right.

### Surfaces checked and deliberately left unchanged

- **RestBar** (`src/ui/index.jsx:271`) — `Pause/Resume · +30s · Next`, Next already
  right-most primary (DEC-013). Confirmed, no change.
- **Finish** (`src/views/workout/finish.jsx`) — `<Back />` is a top-of-screen page-level
  link; Save is a single full-width block button. Not a two-action row; nothing to reorder.
- **Workout overview** (`src/views/workout/overview.jsx`) — `<Back />` top, Abandon a lone
  block button, Finish a list Row. No forward/back pair in a row.
- **Rest-state Previous** (`src/views/workout/item.jsx:342`) — lone quiet button; the
  forward action in that state is the RestBar's Next. No pair in a row.
- **Settings** (`src/views/Settings.jsx:23`) — a `.ui-actions` row of three
  export/import actions, not a forward/back pair. Left as-is.
- **History detail Delete** (`src/views/history/detail.jsx:99`) — lone destructive button
  (object detail owns Delete); §4 governs forward-vs-retreat, not destructive actions.
- **Back** (`src/views/shared.jsx:24`) — page-level retreat rendered at the top of the
  screen, already the top/left exit.

### Guardrail for future screens

Added a comment at `.ui-actions` in `src/ui/ui.css` documenting the §4 order and that it
is set in markup (not CSS-reversed), so tab order stays aligned with visual order. Also
updated the SetLogForm doc-comment to name the new `Previous/Skip/Complete` order.
Did not add a new Showcase block — the showcase already renders the real SetLogForm and
RestBar, which now demonstrate the rule directly.

### Domino check

Shared component touched: `SetLogForm` (`src/ui/index.jsx`). Only child order within the
action `<div>` changed; props, state, `onComplete/onSkip/onPrevious` wiring, and the
`type="submit"` submit path are unchanged. Its one caller (`src/views/workout/item.jsx:348`)
is unaffected. No test asserts button order, so no test was weakened.

### Verification

```
./check → green — lint, 13 test file(s), and the build all passed.
# tests 123  # pass 123  # fail 0
```

No unit test covers visual button order (it's presentation); the acceptance is in-browser
(below).

## Workflow

- **Scope was larger than the spec's headline example.** The spec named SetLogForm as *the*
  known violation and listed others "to check". In fact the whole `.ui-actions` convention
  was primary-left/cancel-right — the inverse of §4 — so all 11 form/action rows were
  reordered. No scope was added beyond §4; this is exactly the retroactive audit the rule
  calls for. Flagging it because it's more surfaces than the spec's framing implied.
- **Decisions taken under my own judgment** (spec delegated these): markup-reorder over
  CSS-reverse (a11y: focus order = visual order); Skip → middle in SetLogForm; Skip → left
  (retreat) in Recalc. Candidates for a `DEC-`: (a) "order action rows in markup, never
  `row-reverse`, so tab order tracks §4"; (b) "Skip is a lateral action — it sits between
  retreat and forward, never right of the primary."
- **No behaviour/label/handler/style change**, per scope. Purely child-order within
  existing action containers, plus two clarifying comments and the CSS doc-comment.
- Did **not** touch `handoff/` (read-only). If §4 or a DEC should record the markup-order
  and Skip-placement conventions, that's Emilio's to add.
