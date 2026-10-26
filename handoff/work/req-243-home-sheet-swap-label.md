**Status: READY** · **Lane: ui** · batch 7 (J1). Copy only.

# req-243 — Home's workout sheet: "Swap for today" → "Swap"

Emilio, 2026-10-16 (Home): "Om det är idag, så kan ja ju inte byta passet till idag" — "if it's today, I can't swap it *to*
today". Planner's reading: the button reads as "move it to today" on a workout that already is today's. DEC-125 §5's one-date
swap is unchanged; only its label → Planner's fix (DEC-137).

## Code facts (rescanned 2026-10-26, `main` 103678a)

- Button `views/Today.jsx:252` "Swap for today"; the picking view already says "Only today — the Schedule stays as it is."
  (`:205`) under "Swap {name} for which workout?" (`:203`). Test strings: `req-225.test.js:366,380,397,401`.

## Scope

1. The button reads **"Swap"**. Nothing else changes.

## Acceptance criteria

1. The sheet shows Edit · Swap · Close; tapping Swap shows the existing picker with "Only today — …".
2. **Could pass for the wrong reason:** assert no text "Swap for today" remains in the rendered sheet (not only that "Swap"
   exists, which "Swap for today" also contains).
3. req-225 tests updated for the label only (called out). `./check` green.

## Decisions made on Emilio's behalf

- "Swap" `(unconfirmed)` — behaviour (copy); also a reading of his note.

## READY checks

1 DEC-125 §5, DEC-126. 2 No sibling on `Today.jsx`. 3–4 None. 5 No trigger files. 6 Marked.
