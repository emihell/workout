# req-161 — two follow-ups to the unreadable-state copy (req-157)

**Status: BUILT AND MERGED, 2026-09-25 — branch `req-161` (`497de37`…`fd9bffe`, 2 commits).** (2026-09-25) — **Lane: data** (reviewer + Emilio's eyes). DEC-086. Source: req-157's re-review
(SHIPPED req-157). Emilio: "merge now, fix later".

1. **A leftover legacy key isn't copied.** v9 corrupt **and** a leftover v8 (an interrupted cleanup): only the key that was
   read is copied, and v8 is deleted by the next load's cleanup once v9 is written (`storage.js:130-135,197`). **Fix:** in
   the unreadable-state Import, copy every present workout key (current + each legacy key) before release — one verified
   copy per key, named so the source key is visible (e.g. `workout-mvp-unreadable-<ts>-v8`).
2. **Copies pile up on retries.** Each retry writes a new ISO-named copy. **Fix:** skip writing a copy whose content `===`
   an existing copy key's content (same source key); still never delete one.
3. (nit) When even one copy can't fit (quota), `KEEP_FAILED_MESSAGE` is a dead end — say what to do (Export isn't possible;
   suggest freeing browser storage for other sites) — Builder's wording, flag it for Emilio.

## Acceptance criteria

- Unit: v9 corrupt + v8 present → both copied (=== each), then import, then reload → both copies present, v8 removed by
  cleanup. Same raw twice → one copy. A differing raw → a second copy. Failure cases keep the lock.
- Browser (isolated origin): the v9+v8 case with the key list pasted before/after reload.
- `./check` green (paste). Reviewer before merge.
