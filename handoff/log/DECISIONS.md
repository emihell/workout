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
