# Persona run "Noa", 2026-10-07 (main `daaa957`, empty first launch, 390×844)

**Who:** Noa, 27, product designer and runner (40–50 km a week), new to the gym, told by her physio to train twice a week.
**Screenshots:** session scratchpad `noa/01–76`. **Taps:** setup ~30 (minimum ~22), workout ~40, check ~2, move a day 4,
edit the plan 13, export 4, last calf weight 4.

**Severities**
- **Quit-risk:** no progress view anywhere.
- **Near quit-risk:** Change day is every-week only, and she needed race week only.

**Slowed**
- The 2-day default preselects Wed/Sat ("legs before my Sunday long run"). Swapping needs 4 taps.
- Reps reset to target after she typed 15 (inputs `["14","10"]`).
- Export is JSON only, under History, beside a "Developer" section.
- The History detail is "— 3 sets" rows.
- Schedule reads "Rest · Today" on a trained day.

**Design**
- Three Start labels.
- Set formats "×" vs "·".
- Equipment labels mixed: "Dumbbell" / "dumbbell" / "body only" / "Bodyweight".
- Edit placement differs between screens.
- Destructive buttons look neutral.
- Sheet-title weights differ.
- About 120 px of blank space at the top of Home.
- Plank: "30 / 30s", two timers, nothing at 0.

**Bugs and latents**
- Total lifted counts per-dumbbell kg once (3,130).
- First setup stores `focus: "Machines"` for mixed equipment (latent, not shown).

**Differs from Lena:** sees inconsistency within seconds, treats developer copy as a trust-breaker, needs progress over time,
plans around an outside calendar, wants CSV.
