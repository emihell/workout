# req-16 — `itemCurrentPath` helper

## Technical

Added one helper in `src/views/Workout.jsx` beside `itemLogPath`/`itemDonePath`:

```js
function itemCurrentPath(routineId, item, done) {
  return done ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
}
```

Converted the five branch sites to call it, each passing its **existing** boolean
verbatim (no condition unified):

- `:189` — overview row, `completed`
- `:252` — `WorkoutItem` redirect effect, `completed`
- `:225` — `itemSetsPath`, collapsed to a one-liner delegating with `itemLoggingState(workout, item).plannedDone`
- `:564` — setup form **Save**, `itemLoggingState(active, item).plannedDone`
- `:586` — setup form **Cancel**, `itemLoggingState(active, item).plannedDone`

Left untouched: the standalone unconditional `itemLogPath` redirect at `:511`
(not one of the five branches — it has no done/log fork, so routing it through
`itemCurrentPath` would add nothing). `itemLogPath`/`itemDonePath` stay as the
primitives.

Implementation choices (spec left open): placed `itemCurrentPath` directly after
`itemDonePath`; found no other done/log branch pair to route through it.

### Receipts

`grep -n "itemDonePath\|itemLogPath\|itemCurrentPath" src/views/Workout.jsx`:

```
189:          const path = itemCurrentPath(routineId, item, completed)
208:function itemLogPath(routineId, item) {
212:function itemDonePath(routineId, item) {
219:function itemCurrentPath(routineId, item, done) {
220:  return done ? itemDonePath(routineId, item) : itemLogPath(routineId, item)
225:  return itemCurrentPath(routineId, item, itemLoggingState(workout, item).plannedDone)
252:    go(itemCurrentPath(routineId, item, completed), { replace: true })
511:          go(itemLogPath(routineId, item), { replace: true })
564:            itemCurrentPath(routineId, item, itemLoggingState(active, item).plannedDone),
586:              go(itemCurrentPath(routineId, item, itemLoggingState(active, item).plannedDone))
```

The two path primitives now appear only at their definitions and inside
`itemCurrentPath` — the five branch sites are all converted; `:511` is the
unconditional redirect, expected.

`./check`:

```
# tests 105 ... # pass 105 # fail 0
check: green — lint, 13 test file(s), and the build all passed.
```

## Workflow

No deviation from the spec. No scope added or dropped, no behaviour change, no
persisted-data touch, no test edits. The `:511` standalone redirect was already
called out implicitly by the spec listing exactly five branch sites; noting it
here so the grep's tenth line isn't read as a missed conversion.
