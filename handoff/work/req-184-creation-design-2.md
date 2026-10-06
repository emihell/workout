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

## Feedback received 2026-10-05 (13 notes, app 291fb52 → cbd9a78) — triage
Code facts from a read-only scan of main `cbd9a78`.
- **F1 pin favourites / search whole library when building a routine** (09-24) — **already shipped** after the note: DEC-097
  picker (req-180) searches own → whole library; no pinning by decision. `/exercises` "add from library" step stays optional.
- **F2 history detail Back went to History from Home** (09-24) — **already shipped** (DEC-092, req-171): `Today.jsx:80,92`
  link with `from=/`, `return-paths.js:18`. His design point kept: needing Back = a smell, inspect-info should be fast.
- **F3 two Skips, Swap on the log page, "why not just add?"** — `item.jsx:505-515` set Skip in the bar + "Skip exercise" +
  "Swap exercise" below; overview has no swap and no mid-workout add (`overview.jsx:106` "Add exercises" only on an empty
  preview). → **Q-A → DEC-103 §2.**
- **F4 "What is save to sesh?"** + **F11–F13 "why didn't biceps curl save … should be a pop/confirmation when pressing
  complete, not information in this list"** — `routine-offer.jsx:30` "Save to {routineName}", inline row under the completed
  item (`overview.jsx:171`), shown whenever logged kg ≠ routine kg (`routine-update-offer.js:23-42`). Reverses DEC-096 §3's
  Planner shape (inline, not popup). → **Q-B → DEC-103 §1.**
- **F5 Replace should search the whole library** — `replace.jsx:40-44` own exercises only. Fix (DEC-095): same picker as the
  routine (`ExercisePicker`).
- **F6 see coming sets (weights) all through the exercise** + **F9 hard to tell I'm on the next set; make "1 of 3" bigger** —
  set list shows only before the first log (`item.jsx:407-417`); progress is a small "1/4" in the sub line (`:58-63`, `:84`).
  Fix (DEC-094/095): keep the set list on screen the whole exercise, current set highlighted, done sets ticked.
- **F7 "GO" glowing chip when rest ends** + **F10 timer chip owns the 1/4** + **F8b tap the timer → go to the exercise I'm
  in** — `RestPill` (`rest.jsx:13`) hides at 0, tap = skip rest (`rest.jsx:19-22`); state persists in `activeWorkout`. → **Q-C → DEC-103 §3.**
- **F8a going back to a completed set: Complete should be a secondary Next and not restart the timer** — Previous calls
  `store.removeActiveSet` (`item.jsx:284-298`): it **un-logs** the set and clears the rest; re-Complete re-arms it. Fix
  (DEC-095): Previous views the logged set without un-logging; forward is "Next" (secondary) when unchanged, "Save" when
  edited; neither touches the rest timer.

Build: **req-186** (pill, set list, Previous), **req-187** (kg confirm), **req-188** (Swap/Skip/Add in the list) — DEC-103. Feedback list done; the open questions above remain for session 2.

## Persona run 2026-10-06 — "Lena" (41, teacher, non-technical, 2 weeks in a machine gym), main `1b9165f`, empty first launch
Agent-driven, 390×844, screenshots in the session scratchpad. Taps: routine setup 20 + 3 searches (slow); workout 46 (ok);
"did it save?" 5 (fast). Verified by Planner from screenshots: **2-day plan with day B left on "Choose" saved as Monday-only**
(Schedule: Monday — Full body A, other days Rest), no message; Home after Save: "Mon, Oct 12 · Full body A" + "Tue, Oct 6 ·
Nothing scheduled today".
Findings (severity): (1) quit-risk — empty day B silently dropped, 2-a-week plan became 1; (2) quit-risk — slot names
(Squat/Deadlift/Row/Core) vs "my machines": she only got hers via search, unsure Leg Press "is allowed" under Squat;
(3) slowed — rows hidden under the sticky Cancel/Skip/Use bar (BACKLOG req-180 follow-up); (4) slowed — plan saved today
but first workout next Monday ("Can I train today?"); (5) slowed — a tapped number box keeps its value, typing appends
("1120") [partly the harness's mid-field tap]; (6) slowed — 150 kg (meant 15) accepted on a no-history exercise: DEC-102's
big-change note needs a reference, none existed; (7) slowed — "Keep blank / Update routine" not understood, tapped the dark
button; (8) slowed — Swap's Sets/Rest step: "why ask now?", wanted the busy machine's sets/rest copied; (9) minor — swapped
exercise's Reps empty → browser bubble "Please fill out this field"; (10) slowed — auto-finish "Finishing in 9s… Edit /
Cancel": feared Cancel deletes; "Volume 2630 kg" meaningless; (11) minor — "⋯" not where she'd look; "skipped" for a busy
machine; "kg" for dumbbells (one or both?); "set 1/3" on the list pill. Worked: search by her own words, the set screen,
fixing a set via Previous/Save, saved check.

## Persona run 2 — Lena again on req-190's build (2026-10-06, branch `req-190` 6333776, empty first launch)
Setup 13 taps + 4 searches, "ok" (was 20 + 3, slow, day B lost); workout 46 taps, logging "fast"; saved check 2 taps.
Fixed vs run 1: machines-first read as "exactly me"; plan started today; plain "Use 40 kg next time?"; "kg per dumbbell";
Keep going; Previous → Save fixed the 150 typo. Still open, for a next fix req:
(1) near quit-risk — searching "back" lists Kickbacks / Back Squat / Deadlift; Seated Cable Row far down (search by what a
machine does / body part); (2) quit-risk if mis-tapped — Skip exercise on the last exercise auto-finishes at once ("Finishing
in 9s…", req-84 auto-complete); (3) slowed — tapping a done set row in the set list does nothing (she tried it before Previous);
(4) slowed — "Today, Fri" read as "today is Friday" (say "Tuesdays and Fridays"); (5) slowed — Add exercise's blank Sets/Rest
("why not 3 × 10 like before?" — DEC-104 §2 vs the routine picker's shown starting plan); (6) minor — reps don't carry to the
next set on a no-target exercise (DEC-052: reps never carry; she retyped 10); (7) minor — routine named "Workout" reads oddly in
"Workout will start Leg Press at 40 kg"; (8) minor — "Lifted 2,510 kg" disbelieved; "Add 0" button label; no clear (×) on
search. Home order (future dates on top, latest first) is Emilio's req-60 choice — not a bug.

## Feedback received 2026-10-06 (15 notes, Lower body workout, app 957c2c6 — before req-189..191)
G1 "Timer for duration only exercises?" (Stairs log) · G2 "What does alternating mean?" (Stairs exercise edit) · G3 "Add level
for machines like stairs, row, cross fit" · G4 "Skip rest should be within the timer chip - skip if you in the exercise, go to
exercise if your outside of it" · G5 tips during rest (form, exercise, motivation, routine, general; science-based; more
advanced with more workouts) · G6 "I can't change the increment?" (Leg extension, exercise edit) · G7 "The increment should
also have a starting weight" · G8 review the log screen's layout ("should the sets list be under effort?") · G9 "Do we need
to see the completed sets? Or only the remaining ones?" · G10 "Can effort and complete be combined somehow?" · G11
"complete is a bit much for just a set - maybe another word? … connected to effort" · G12 "Maybe Max should be failure in
effort" · G13 "Should you be able to add notes all the time during an exercise? Or only at the end?" · G14 "For the
questions, use the user data and external searches and how other apps do it and your own logic" · G15 "I completed a
workout today but can't see it in the list?" (Home).
Triage in progress: code scan + prior-art research (Strong, Hevy, JEFIT, Fitbod…).
