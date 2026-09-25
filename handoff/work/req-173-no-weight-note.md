# req-173 — a quiet "No weight entered" note on a weighted set

**Status: BUILT — branch `req-173` (`fec8649`, 2 commits), NOT merged.** (2026-09-25) **Lane: ui.** Source: persona run (req-144 prep §E.2). Emilio approved the
recommendation 2026-09-25 ("4. good", DEC-093).

## Today [read 2026-09-25]
A weighted exercise's set with a blank kg is accepted: `liveSetWeight` → `kgToSave(text, 0)` saves **0**
(`views/set-values.js:19-23`, `kg-input.js:44-48`); 0 is the app's "no weight" (`progress.js:83-89`). Persona run: Complete
with blank kg started the rest and moved on, no hint.

## Change
On a **weighted** exercise's log form (live workout, `views/workout/item.jsx` via SetLogForm), when the kg box is empty show a
quiet line under it: **"No weight entered"**. Complete still works, in one tap, and saves exactly what it does today.
Unweighted (bodyweight/cardio) never shows it. Same rule in the History set editor if it shares the form.

## Out of scope
Blocking, a confirm, or a default weight (never invent — DESIGN core rule). How a stored 0 is displayed elsewhere.

## Acceptance criteria
1. Weighted + blank → the note shows; typing a kg hides it; bodyweight/cardio + blank → no note (tests).
2. **Is the right mechanism answering / nothing changed underneath:** the stored set after Complete with blank kg deep-equals
   main's (`weight: 0`) — a test pinning it.
3. **Failure case — no invented prefill:** after finishing a workout whose only Leg Press set had blank kg, the next
   workout's kg box for Leg Press is **blank**, not "0" (browser receipt; if it shows 0 on main too, report it — don't fix here).
4. `./check --smoke` green; Planner's `plan qa` run (≤5 items).

Decisions: wording "No weight entered" — Emilio's approval of the recommendation. Trigger files: none expected
(`item.jsx` is not on the DEC-057 list). Sibling: req-175 changes labels in `item.jsx` — build 173 first.
