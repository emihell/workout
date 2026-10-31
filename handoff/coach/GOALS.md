# Goal profiles — Coach's defaults per goal (DEC-147)

The balanced base (COACH.md) applies to every goal; a profile sets the numbers on top. A client may have a main goal and a
secondary one. Every number cites `EVIDENCE.md` §N; a number without one is marked *general knowledge* — say so in a
report that uses it. Planner owns this file.

## Balance numbers

| | Min working sets / muscle / week | Sessions |
|---|---|---|
| **Floor, any goal** | ≥ 4, with a squat/leg press, an upper pull and an upper push (§2 Iversen) | ≥ 2 strength days (§1 WHO) |
| **Muscle goal** | ≥ 10 (§2 ACSM 2026) | any split — frequency doesn't matter at equal volume (§3) |
| **Maintenance** (busy weeks) | 1 set per exercise, 1 session, if the load stays (§2 Spiering) | 1 (65+: 2) |
| **Rehab / returning** | the client's clinician first; the weak side may get extra work | as tolerated |

- **Counting sets:** 1 per primary muscle, **0.5 per secondary** (§2 Pelland 2026). Warm-ups and skipped sets count 0.
- **Largest pairing ratio ~1.5 : 1** (push : pull, upper : lower, knee : hip) — *general knowledge*, Emilio 2026-10-26.
- Beginners: 2–3 full-body days, 8–12 RM (§7 ACSM 2009; [RP] says 5–10 with ≥ 2 reps in reserve).
- **Muscle:** 10–20 sets per muscle per week is the working range; more only in specialization blocks ([Pyramid]).
- **Coverage:** squat, hinge, horizontal and vertical press, horizontal and vertical pull, plus isolation for quads,
  hamstrings, biceps, triceps, side delts, calves; prefer exercises loaded at long muscle lengths; keep exercises for a
  whole block ([Pyramid], [RP]).

## Progression (all goals)

Sources: EVIDENCE §N, and the book notes in `workout-data/coach/books/` (DEC-150) — **[Pyramid]** (research-led),
**[RP]** and **[S&S]** (coach opinion). The app's own rules wait for req-149 (Emilio).
- **Training status = rate of progress** [Pyramid]: novice adds load or reps each session/week; intermediate week to week
  at higher reps, month to month at low reps; advanced ~1 rep a month. Judge everything below against that rate.
- **Up — double progression** (§7 Plotkin; [Pyramid], [RP]): a rep target per set; when every work set reaches it at
  Easy (or Medium with 2+ reps to spare), go up one `weightStep` (machines 5, Leg Press 10, dumbbells 2, kettlebells next
  bell, barbell next plate pair). A step above ~10 % of the load → raise the reps first, then step up and start at the
  bottom again (§7; [RP]). The app holds on range targets, so write one plain number per set (CAPABILITIES) and move it.
- **Effort by load** ([Pyramid]; §4): heavy free-weight compounds stop 2–4 reps short, never to failure; machines 1–3;
  isolation 0–2. **Beginners never closer than ~2** ([RP]). The app logs only Easy · Medium · Hard per exercise.
- **Hold** on Hard or missed reps. **Flat performance in weeks 3–4 of a harder block isn't a stall** — fatigue hides
  gains ([RP]).
- **A stall** = slower than the status rate across ~3+ sessions (not counting calibration). First check the basics:
  sleep ≥ 7 h (§16), a deep deficit (§10), protein (§9), consistent exercises ([Pyramid]). Then: recovering well → about
  +20 % sets; not recovering → a lighter week ([Pyramid]); still stuck → change reps, variation or the exercise ([RP]).
- **A lighter week, reactively** (§8; [Pyramid], [RP]): when reps fall short two sessions in a row, or 2+ of: dreading the
  gym, worse sleep, loads/reps down, life stress up, aches up. Cut sets 30–50 %, keep the load. Not a week off.
- **Per session:** ≤ ~11 sets for one muscle; more → spread over more days ([Pyramid]; [RP] says 3–8 typical).
- **Kettlebell S&S** uses its own rule: a heavier bell when 100 swings in 5 min or 10 get-ups in 10 min feels strong,
  brought in one set at a time ([S&S]).

## Profiles

| Goal | Load / reps | Rest | Conditioning | Outside the gym |
|---|---|---|---|---|
| **Strength** | main lifts heavy (≥ 80 % 1RM, about ≤ 8 reps; ≤ 6 reps ≈ 85–90 % [Pyramid]), 2–3 sets each, ≥ 2×/week (§2, §5) | 2–3 min on main lifts (§6) | keep cardio ≥ 3 h from heavy/explosive work (§12) | sleep ≥ 7 h (§16), protein ~1.6 g/kg (§9) |
| **Muscle** | any load 6–30 reps, taken hard (§5, §4); ≥ 10 sets/muscle/week (§2) | > 60 s, ~90 s+ (§6) | doesn't hurt size (§12) | protein ~1.6 g/kg (§9) |
| **Lean / fat loss** | keep loads heavy to keep muscle (§10 Sardeli) | as strength / muscle | adds to, never replaces, strength work; HIIT saves time, not fat (§13) | the deficit does the fat loss (§10): ~0.5–1 % bodyweight/week, deficit ≤ ~500 kcal to keep gaining; protein ≥ 1.6 g/kg, more if lean (§9); ~7,000+ steps for health (§10) |
| **General health** | 8–15 reps, ≥ 2 days, all major muscles (§1) | 1–2 min | 150–300 min moderate / week (§1) | steps, sleep |
| **Endurance / running** | 2 strength days, legs + core | 1–2 min | the main work (§13) | sleep, protein |
| **Older adults (65+)** | strength + power (lift fast, §14) + balance ≥ 3 days (§1) | as needed | walking, balance work | protein 1.2–1.6 g/kg (§9), steps |

**Time vs results:** a session shorter than the profile needs (short rests on heavy lifts) trades results for time — say
so in the plan. Supersets save time at no cost (§11) once the app has them (DEC-146).
