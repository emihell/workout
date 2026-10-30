// req-244 (DEC-139) — two lines, words not fractions: line 1 the rest clock or "GO" (pulse
// kept); line 2 "Set 2 of 4 · Ex 3 of 7", or only "Ex 1 of 7" before a set of the current
// exercise (no stray separator); with `skip`, line 2 reads "Tap to skip rest". `set` and
// `exercise` are { current, total } (or null) — the words are formatted here, not parsed.
export function workoutPillLines({ clock = null, set = null, exercise = null, go = false, skip = false } = {}) {
  const top = go ? 'GO' : clock
  const bottom = skip
    ? 'Tap to skip rest'
    : [set && `Set ${set.current} of ${set.total}`, exercise && `Ex ${exercise.current} of ${exercise.total}`]
        .filter(Boolean)
        .join(' · ')
  const label = skip
    ? `Rest ${clock} — tap to skip the rest`
    : `${go ? 'Go' : `Rest ${clock}`}${set ? `, set ${set.current} of ${set.total}` : ''}${
        exercise ? `, exercise ${exercise.current} of ${exercise.total}` : ''
      } — open the exercise`
  return { top, bottom, label }
}
