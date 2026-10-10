# Inspiration repos — licence verdicts and ideas (2026-10-10)

Emilio, 2026-10-10: "the other ones are apps, where we can take inspiration, but we do not want to be a copy, we want to do it
better, and find our own way". Research: two read-only agents, clones in a session scratchpad (not in the repo). DEC-120.

## Verdicts

| Repo | Licence | Use |
|---|---|---|
| [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) | MIT for code/text; `LICENSE` "MEDIA EXCEPTION": images/GIFs "© Gym visual … Cloning this repository does not grant you any license to the media" | **Media: never** (bundle, hotlink, trace). Text: don't build on it — data is ExerciseDB v1 repackaged [inferred, strong: 1,324 4-digit ids, `0001` = "3/4 sit-up", ExerciseDB enums]. 168/366 of our entries name-match. |
| [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym) | AGPL-3.0 code; Gym visual media (no third-party rights); MIT body-map paths (`frontend/src/lib/body-paths.js`, from melihcolpan/MuscleMap) | **Ideas only.** The MIT body-map paths are the one reusable asset (attribution). |
| [InlitX/GymMane](https://github.com/InlitX/GymMane) | GPL-3.0 + "Based on GymMane" term; art CC BY-SA 4.0 (from everkinetic/data, bryllim/workout-guide); exercise text uncredited | **Ideas only.** Line art: go to Everkinetic directly if ever wanted (attribution + share-alike). |

Clean image routes stay: free-exercise-db photos (Unlicense, already linked) and our own figures (DEC-060).

## Ideas shortlist (not decided — Emilio's calls)

1. **"Why this number"** on the live set and review — openGym `lib/progression.js` returns `{kind, why}` per prescription. Makes
   `progress.js` reasoning visible where you lift (CLAUDE.md rule). No schema change.
2. **Note for next time** — openGym `pinnedNoteFor` (`lib/history.js:397-420`): a note marked "for next time" shows next time
   that exercise comes up, dated, newest only. User's own data. One optional field (data lane). Pairs with req-217 rest notes.
3. **Supersets as one link flag** between adjacent routine items — GymMane `linkedNext` / `_advanceChain`
   (`workout_state.dart:517-556`): A1 → B1 with no rest, rest after the round. Schema field.
4. **One-arm / dumbbell honesty** — a switch-sides pause (length user-set or learned from `loggedAt`, never a default) and
   per-bell vs total kg meaning kept per logged set (openGym `lib/dumbbells.js`). Data lane.
5. **Bodyweight level-up offer** — GymMane `_offerLevelUp`: after 2 sessions meeting a rep bar, offer the next progression;
   user confirms (our Update-routine pattern). Curated chains = content we own.
6. Smaller: Swap remembers `swappedFrom` (GymMane); finish-screen "next time" built by the same function Start uses (openGym
   `lib/finish-compare.js`) as a test-backed invariant; plate math only from a user-entered kit.

## Seen and rejected (conflicts with DESIGN §1 or scope)

Invented starting load (GymMane "3 × 10 @ 20 kg"), invented warm-up ramps, default plate inventory, silent starter-plan prefills,
1.5 s auto-finish, body-map auto-picked sessions, AI coach / recovery model, medals / streaks, auto progress bump ignoring effort.
