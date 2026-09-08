# Decisions

Append-only, newest at the bottom. One entry per decision that a user could notice or
that constrains future work. Supersede rather than edit — a later entry can overturn an
earlier one, but the earlier one stays.

Format:

```
## DEC-001 — short title  (YYYY-MM-DD)
What was decided, in one or two lines. Who decided it (Emilio, or the planning session
on his behalf — mark "unconfirmed" if it was a default he hasn't ratified). Why, and
what was rejected. Cross-ref the req if there is one.
```

---

## DEC-001 — a failed save shows a persistent banner  (2026-09-07)

When `saveState` can't write to `localStorage` (quota exceeded, Safari private mode), the
app shows a **persistent, app-wide banner** ("couldn't save — your data may not persist,
export a backup") that stays until the next successful save. Emilio decided (chose A over a
transient toast (B) and console-only (C)). Why: this app's whole value is a trustworthy
record, so silent data loss is the one unacceptable outcome, and a toast can be missed.
Drives `req-01`.

## DEC-002 — no-history exercise carries entered kg + reps to later sets  (2026-09-07)

For an exercise with no finished-workout history, logging a working set seeds the next
working set from the most recently logged (non-skipped) working set of that item in the
current workout — **both kg and reps** carry, and it follows the **most recent** set (so
adjusting mid-exercise flows forward). Emilio decided both forks (kg+reps over kg-only;
most-recent over always-set-1). Not invented data — it's the user's own input this
session, filling what would otherwise be blank; stays an editable prefill. Effort does
not carry. Exercises with history keep their per-set history prefill. Drives `req-02`.

## DEC-003 — rest timer becomes a persistent workout-level bar  (2026-09-07)

The rest counter disappeared when leaving the set-logging screen because the countdown UI
+ controls lived only inside that screen while the state was workout-level. Fix: a single
persistent rest bar on every in-workout screen (overview, item log, review, finish),
keeping Pause/Resume/Skip/+30s. Emilio confirmed the reproduction (disappears after leaving
the set screen) and chose the persistent bar over a minimal fix; declined auto-starting rest
between exercises. Audible/haptic end-cue + wake-lock stay a separate Phase-1 item. Drives
`req-03`.

## DEC-004 — a destructive import auto-downloads current state first  (2026-09-08)

Both import sites (`Settings.jsx`, `Today.jsx`) replace all state after one native confirm
with no recovery of the overwritten data. Fix: on the confirm's OK, automatically download a
`buildBackup` of current state (the Export file) before applying the incoming payload — the
download is fired, not blocked on. Emilio chose auto-download over offer-and-wait: offer-first
wants real inline UI and would pull the separate "replace native alert/confirm with inline UI"
backlog item into scope, and its respect-intent benefit is largely moot at Today's empty-state
importer (nothing to lose). This req is a data-safety net, not a UX pass. Both sites route
through one shared import helper (consolidates the duplicated confirm→apply path). Drives
`req-07`.
