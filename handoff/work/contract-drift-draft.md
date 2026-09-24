# Draft — README + DESIGN catch up with DEC-052/056/073/075/076/082 (for Emilio's review)

**Status: DRAFT, awaiting Emilio** (DEC-085 §4). Source: `audits/2026-09-24.md` F-DRIFT-5, F-DIV-2. On his OK: planning
applies the DESIGN edits; Builder applies the README edits (README is code-side) as a tiny tooling-lane req.

## README.md (product contract)

**§Recommendation rules, paragraph 1** — now:
> Completed history supplies the next load. Easy completed work moves one valid equipment step up; missed reps or failure
> move one step down; moderate work holds. Alternating 4/5 kg stacks use their real sequence rather than a rounded 5 kg
> increment.

**Proposed:**
> Completed history supplies the next load. Easy completed work moves one valid equipment step up; missed reps or failure
> move one step down; moderate work holds. Alternating 4/5 kg stacks use their real sequence rather than a rounded 5 kg
> increment. **A target the app can't read as a single number (a range like 8–12, AMRAP, a duration, text) and any assisted
> exercise hold — the same kg and target — until the progression rules are defined.**

**§Recommendation rules, paragraph 3** — now: "Correcting meaningful history shows a recalculation preview. Recalculation
writes next kg and reps onto the routine from that workout." **Proposed:** "Finishing a workout never changes the routine.
Correcting history offers an update: Apply writes that workout's kg and reps onto the routine; Skip leaves it as it is."

**§Deferred scope** — now: "No accounts, sharing, collaboration, … are part of this MVP." **Proposed:** keep the sentence,
add: "This is the browser-only MVP. The product is headed for other users and training together on a server (DEC-073);
that scope opens with the backend design (req-146), not before."

## handoff/rules/DESIGN.md

**§1, the second bullet's exceptions** — now names (1) Reps from target + effort Moderate, (2) the no-history kg+reps carry.
**Proposed** replacement for "Two sanctioned exceptions … (DEC-002) — …":
> Sanctioned exceptions, all the user's own input rather than invented data: (1) the live set-log screen prefills Reps from
> that set's target, and Effort Moderate **only where Effort is shown** (warm-up/cardio carry no effort, req-156); (2) the
> **kg** the user just entered this session carries to the next working set when history has **no set at that index** —
> a no-history exercise (DEC-002), an Add set, or a routine that grew (req-152); reps never carry (DEC-052); (3) an in-session
> kg change carries to the remaining sets (req-83/DEC-052); (4) an unsaved draft restores what was typed (req-125).

**§2, first paragraph** — append: "A target that isn't a single number, and any assisted exercise, hold (DEC-075/076)."

**§3, third bullet** — now: "Completed (non-skipped) history writes next kg/reps onto the routine — that is the one
direction data flows from history into setup, and it's explicit." **Proposed:**
> **History reaches the routine only by a deliberate step.** Finishing never changes the routine (DEC-056); correcting
> history offers an update, and only Apply writes that workout's kg/reps onto it. That is the one direction data flows
> from history into setup.

## Also (code-side, rides the README req)

`.cursor/rules/history-prefill.mdc` names only the Reps/Moderate exception — align it with DESIGN §1 above.
