# req-96 — replace finish "Next time" with a light "you beat last time" moment (notes n4/n6 + new)

**Status: NEEDS DECISION — parked to detail with Emilio before it enters the build loop.**
Do NOT ping this to Builder yet.

From Emilio's in-app notes (2026-09-16): `/workout/.../finish` — *"The next time section —
what is that? Is the result or next-time routine? Maybe remove it?"*; `/history/…` — *"We
don't need 'next time' here."* And the direction (2026-09-17): *"remove it, instead we need
a req that just shows a light and easy way if it went better this time than last time — we
don't need to be super detailed, just a little UI thing to be proud that you did better."*

**Gate: ux-feel** (surface + a comparison metric).

## Two things in one req (same screen, one swap)

1. **Remove "Next time".** It's the load recommendation from `progress.js`
   (`buildFinishProgression` → `src/views/workout/finish.jsx:42`, and
   `src/views/history/detail.jsx:80`). It only changes weight when an **RPE/effort** signal
   is present (down on missed reps or RPE ≥ 5, up on RPE ≤ 2 — `src/progress.js:57–122`);
   with no RPE and reps hit, it just echoes what you did. Emilio doesn't log RPE, so it's
   inert noise → remove from **both** finish and history detail.
2. **Add "beat last time".** A light, quiet line on the **finish** screen that celebrates
   doing better than the previous same-routine workout.

## Direction settled with Emilio (2026-09-17)

- **Metric: total volume** (Σ weight × reps across the workout) vs the previous **same-routine**
  finished workout. *("1 I think, but let's go into details before we build it.")*
- **Loudness: one quiet line + a subtle accent** (e.g. "↑ You beat last time"), not a badge or
  animation.
- **Never invented:** first-ever session for a routine (no prior to compare) → show nothing.
  Only show the line when today genuinely beat last time; say nothing when it didn't (don't
  print "you did worse").

## Open questions to resolve before READY

- **Exact metric definition:** total volume only? How are bodyweight / timed / AMRAP sets
  counted toward "volume" (they have no kg × reps)? Does an added exercise or extra set count
  as "better," or only load on the same prescription?
- **Comparison target:** strictly the *previous finished workout of the same routine*, or best-
  ever? (Direction implies previous same-routine.)
- **Reuse:** `src/views/workout/auto-complete.jsx:80` already renders a `vs last time` /
  `This workout` section (req-84) — check whether its comparison already computes what's needed,
  so this line and that screen share one source of truth rather than two volume calcs.
- **Copy + accent** for the line.
- **History detail:** removal only (no "beat last time" there — it's a forward/celebration on
  finish, not a past-record annotation). Confirm.

## Acceptance criteria (draft — finalize when READY)

- Finish screen: no "Next time" section; a quiet "beat last time" line shows **only** when
  today's total volume > the previous same-routine workout's; nothing shown on a first-ever or
  a not-better session.
- History detail: "Next time" removed.
- The comparison is a tested pure function (history is the source of truth; the value the user
  sees has its reasoning made inspectable — CLAUDE.md rule).
- `./check` green.
