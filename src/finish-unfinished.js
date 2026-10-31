// req-176 — what Finish will record as skipped, per exercise, so the Finish screen can
// say so before Save. Derived from exactly what Save writes: withSkippedUnloggedSets
// (finishedState's call) is run on the workout with its first 0, 1, 2 … items, and each
// item's skipped sets are the ones its step appended. That function only appends, item
// by item in snapshot order, so step i's new sets are precisely what the full call adds
// for item i — no second counting rule. Pure; the screen only renders `lines`.
import { isSkippedSet } from './set-rules.js'
import { setsForItem, withSkippedUnloggedSets, workCountFor } from './workout-items.js'
import { dateKey } from './schedule.js'
import { weekdayDate } from './views/history/helpers.js'

// Per snapshot item (workout order): the sets Finish adds for it, split into warm-up and
// work. Items Finish adds nothing to are left out.
export function finishSkippedByItem(workout) {
  const items = workout?.snapshot?.items || []
  const before = workout?.sets || []
  const out = []
  let prev = before.length
  for (let i = 0; i < items.length; i += 1) {
    const partial = withSkippedUnloggedSets({ ...workout, snapshot: { ...workout.snapshot, items: items.slice(0, i + 1) } })
    const added = partial.sets.slice(prev)
    prev = partial.sets.length
    if (added.length === 0) continue
    const item = items[i]
    const workLogged = setsForItem(before, item, items).filter((set) => set.setType !== 'wu' && !isSkippedSet(set)).length
    out.push({
      index: i,
      item,
      added,
      warmupSkipped: added.filter((set) => set.setType === 'wu').length,
      workSkipped: added.filter((set) => set.setType !== 'wu').length,
      workLogged,
      workCount: workCountFor(item),
      started: setsForItem(before, item, items).length > 0,
    })
  }
  return out
}

function plural(n, word) {
  return `${n} ${n === 1 ? word : `${word}s`}`
}

// req-177 — one quiet sentence per PARTLY logged exercise (it has any set before Finish).
// Work sets are counted as the overview counts them. An unlogged planned warm-up is still
// saved as skipped (it is in `added`) but no longer named, so an exercise whose only
// unlogged set is its warm-up gets no line.
export function finishSkippedLine({ item, workSkipped, workLogged, workCount }) {
  if (workSkipped === 0) return null
  const name = item?.exerciseName || 'Exercise'
  const head = `${name}: ${workLogged} of ${plural(workCount, 'set')}.`
  let what
  if (workLogged > 0) what = workSkipped === 1 ? 'The other set' : `The other ${workSkipped}`
  else what = plural(workSkipped, 'set')
  return `${head} ${what} will be saved as skipped.`
}

// req-177 — the partly-logged lines (workout order), then ONE line naming every exercise
// not started, in workout order. Nothing to skip → [].
export function finishSkippedLines(workout) {
  const entries = finishSkippedByItem(workout)
  const lines = entries.filter((entry) => entry.started).map(finishSkippedLine).filter(Boolean)
  const untouched = entries.filter((entry) => !entry.started).map((entry) => entry.item?.exerciseName || 'Exercise')
  if (untouched.length) lines.push(`Not started, saved as skipped: ${untouched.join(', ')}.`)
  return lines
}

// req-224 (DEC-125 §4) — the Finish screen's line when the workout was left open
// (finishTimeFor's `leftOpen`): the saved finish time as local HH:MM, plus the day
// (weekdayDate, "Mon, Oct 13") when it isn't `now`'s local day. Wording (unconfirmed):
// "You left this workout open — saved as finished at 10:50, your last set." Pure.
export function leftOpenText(finishedAt, now = new Date()) {
  const at = new Date(finishedAt)
  if (!Number.isFinite(at.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  const key = dateKey(at)
  const when = key === dateKey(now) ? time : `${time} on ${weekdayDate(key, now)}`
  return `You left this workout open — saved as finished at ${when}, your last set.`
}
