# req-50 — Everything clickable uses a library component (no bare text links)

Branch `req-50` (off `main` after req-49 merged). Gate: **ux-feel** — built + gate-green;
**Emilio's on-device look is the merge gate.** Not merged.

## Technical

Presentation + component-routing only — **no behaviour or route changes**. Every
clickable that was bare, unstyled text now wears a library component class; the one
raw `<a>` now goes through the `NavLink` primitive.

### Classification (per DEC-016, which the spec names as governing)

I classified each clickable by **what it does**, not by its label:
- **Every bare `<NavLink>` in the screens is *navigation*** — each carries a `to=`
  route and changes no state. So per DEC-016 none became `<Button>` (that would be the
  wrong semantics and would require adding an imperative `go()` handler = a behaviour
  change, which is out of scope). They gained a component **class** instead.
- The genuine state-changers (Remove, Delete, Add-that-writes, Save, Start) were
  **already** `<Button>` — the sweep confirmed, didn't touch them.

So the sweep is: **style the bare navigation links; route the raw anchor through the
primitive.** Two treatments:

| treatment | when | class |
|---|---|---|
| **inline nav link** | standalone browse/enter link (Add routine, By exercise, Edit, Done, Add set, Correct, Create exercise, Add exercises, Loop, row/label links) | `ui-navlink` |
| **button look** | a nav control sitting in an `.ui-actions` row or a Row `action` slot (Cancel, Skip, "Add to routine"/"Already added") | `ui-btn ui-btn--quiet` (retreat) / `ui-btn ui-btn--secondary` (action-slot) |

**Why Cancel/Skip stay `NavLink`, not `Button` (the one interpretive call to review).**
The spec's rule bullet lists "Cancel-as-dismiss" under *Action → Button*, but DEC-016
(named as the governor, and the spec says "classification per DEC-016 is CC's call")
says navigation without a state change is a **link**. Cancel/Skip navigate and commit
nothing. I satisfied **both**: they wear the **button look** (`ui-btn ui-btn--quiet`,
so visually they read as the button they pair with) while staying anchors. This matches
the existing precedent `Routine.jsx:57` (a nav "Edit" rendered `a.ui-btn--secondary`,
whose req-56 comment cites exactly this DEC-016 reasoning) and the `a.ui-btn` CSS support
already in `ui.css:74-87`. It also keeps the change presentation-only — no `go()` handler
added. **If you'd rather Cancel be a true `<Button>`, say so and I'll switch those 6
sites** (it's a visual near-no-op since the look is identical; the difference is
semantics + a11y).

### Sites changed (all navigation → styled)

- **Schedule.jsx** — Loop link, slot-label link, "Add routine", "Done" → `ui-navlink`;
  "Cancel" (in Save row) → `ui-btn ui-btn--quiet`.
- **Routine.jsx** — "Add routine", "Edit", "Add exercise", item link, "Done",
  "Create exercise" → `ui-navlink`; "Cancel" (Save row) → `ui-btn ui-btn--quiet`.
  (`:57` "Edit" was already `a.ui-btn--secondary` — untouched.)
- **Exercises.jsx** — "Add exercise", "Edit" → `ui-navlink`; two "Cancel" (Save rows)
  → `ui-btn ui-btn--quiet`; "Add to routine"/"Already added" (Row action slot, beside a
  sibling `<Button>Add</Button>`) → `ui-btn ui-btn--secondary` for consistency.
- **history/detail.jsx** — "Correct", "Add set" → `ui-navlink`.
- **history/list.jsx** — "By exercise" → `ui-navlink`.
- **history/recalc.jsx** — "Routine" → `ui-navlink`; "Skip" (dismiss, left of Apply) →
  `ui-btn ui-btn--quiet`.
- **history/edit.jsx** — "Cancel" (Save row) → `ui-btn ui-btn--quiet`.
- **set-edit.jsx** — "Cancel" (Save row) → `ui-btn ui-btn--quiet`.
- **workout/overview.jsx** — "Add exercises" → `ui-navlink`.
- **workout/item.jsx** — the raw `<a href="#…">{name}</a>` (exercise title → editor) now
  routes through the `NavLink` primitive. **Left classless on purpose:** it's embedded
  in the `<h1>` Title, and `ui-navlink` forces body font-size — which would shrink the
  title. It inherits the title's styling; the fix here is "not a raw anchor / uses the
  primitive," per the rule for that site.

### Order/focus (DESIGN §4)

No `.ui-actions` child order changed — every Save/Cancel and Apply/Skip row already had
retreat-left / forward-right in markup; I only restyled the left child. DOM order =
focus order preserved (no `row-reverse`).

## Verification (receipts)

- `./check` → **green**: `check: green — lint, 19 test file(s), and the build all passed.`
  (218 tests pass / 0 fail — no test changes; this is presentation.)
- **[measured] No raw anchors:** `grep -rn "<a " src/views/` (excluding comments) →
  one hit, the `NavLink` primitive definition (`shared.jsx:15`). Nothing else.
- **[measured] No bare clickable text:** `grep -rn "<NavLink " src/views/ | grep -v className`
  → only `workout/item.jsx:59` (the title-embedded link, intentionally classless — see
  above) and a comment line. Every other `<NavLink>` carries a component class.
- **Semantics (failure case):** asserted per site above — each converted control is
  *navigation* and became a styled `NavLink`, not a `Button`; the pre-existing
  state-change `<Button>`s (Remove/Delete/Add-that-writes/Save/Start) were left alone.
  The sweep did **not** blanket-restyle links as buttons.

## What could not be verified here (needs Emilio in the browser)

The **look/feel** — this is a ux-feel req. The gate proves the wiring and the
class-coverage; it can't judge whether a "Done" or "Add routine" reads right as an
inline `ui-navlink` vs. a quiet button, or whether the button-look Cancels sit well next
to Save. That's the merge gate. See the ready-to-look-at list in the terminal.

## Workflow

- **Scope held:** presentation + component-routing only; no route/behaviour change (the
  reason Cancel/Skip stayed anchors rather than gaining a `go()` handler). No new
  component types added to the library (used `ui-navlink` / `ui-btn` variants that exist).
- **One decision to record as `DEC-` if you agree:** Cancel/Skip (and other
  navigate-only controls) are classified **navigation → styled `NavLink`** per DEC-016,
  given the button *look* where they sit in an action row — resolving the spec bullet
  that had lumped "Cancel-as-dismiss/Add/Done" under Action→Button. This is the crux call
  and the thing to eyeball. Reversible in 6 one-line edits if you want true `<Button>`s.
- **Coupling with req-49 honoured:** `Back`/`ExercisesLink` were left as req-49 set them
  (req-50's out-of-scope note said don't restyle `Back` here beyond what req-49 did;
  `Back` is still the quiet button, `ExercisesLink` already `ui-navlink`).
