# req-184 — creation design, session 2: advanced users, programs, and Emilio's feedback from using session 1's build

**Status: NEEDS DECISIONS** (2026-09-26). **Lane: design** — no code; planning + Emilio live; output = `DEC-`s + build reqs.
Continues req-144 (session 1 → DEC-096..102, built as req-178..183). Emilio 2026-09-26: "lets save the rest of the creation
design into a req … i think we are at a point where its good for me to use the app anyways - so when the do the advanced users,
we can also fix any feedback that i have on how the setup is now".

## Inputs
- **Emilio's feedback from real workouts** on the new setup (routine sets the weight + Save-to-routine offer, picker, plan
  slots, form, kg hints). Collect it first; each item → fix now (DEC-095) or a question here.
- req-144 prep: §A model audit, §B prior art (Strong, Hevy, JEFIT, Fitbod, Boostcamp), §C parameter table (rows 7, 9–10,
  15–30 still open), §G Sam run leftovers.
- Planner's `(unconfirmed)` calls listed in `NOW.md` (batch 2026-09-26) — confirm or reverse.

## Open questions (each → a DEC-)
1. **Advanced persona:** what does someone running a program with % and progression need that the simple routine doesn't
   give — without costing a beginner a tap (DEC-071)? Where does "advanced" live: hidden options per item, or a separate mode?
2. **Parameters still open** (prep §C): rep range as a real range (7), per-set variation beyond slashes (9), multiple warm-up
   sets with weight (10), supersets (15), tempo (16), RPE/RIR targets (17), % of 1RM (18), AMRAP/drop sets (19–20),
   unilateral / assisted / weighted-bodyweight flags (23–25), deload (29).
3. **Program model:** program vs routine vs schedule (the old `programs` remnants, prep §A3); per-week variation (28); multi-
   week phases (30). What a program owns; how it maps onto the weekly loop.
4. **Progression:** how "Save to routine" (req-178) relates to the load recommendation (`progress.js`) and req-149's rules — does
   the offer ever suggest the next step, or only what you lifted? The History "Update?" screen still shows no numbers.
5. **Plan templates beyond 1–4 days** (DEC-098 §2 deferred 5–6), and whether templates learn equipment.
6. **Sam leftovers** (prep §G): Home labelling of today and the dock's "Workout" doing nothing with no workout; remaining
   jargon ("Loop", "Import", "Volume", "Duration (s)", slash weights); "Warm-up exercise" and "Not timed…" unexplained;
   BACKLOG req-180 picker follow-ups (sticky-bar background, Burpee under Chest).
7. **Real people** (req-144 Q7): one real beginner and one experienced lifter trying the app while Emilio watches.

## Acceptance
Each question answered by Emilio and recorded as a `DEC-`; feedback items each fixed or turned into a numbered req; the gap
list → READY build reqs (model gaps first). Nothing built from this req itself.
