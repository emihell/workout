// req-209 §6 — the ONE display map for an equipment value, wherever it shows (the picker,
// add-exercise search, the Exercises list and an exercise's page). Stored values come in
// mixed forms: the library's free-db text ("dumbbell", "body only"), a library pick saved
// title-cased ("Dumbbell", "Bodyweight"), or whatever the user typed. Display only: nothing
// stored is rewritten, and the library file is not edited (DEC-061).
//
// Title case per word (the rest of a word is kept, so a typed "Chest Press (Star Trac)" is
// unchanged); "body only" / "bodyweight" read "Bodyweight". An empty value reads
// `fallback` ('' by default: the caller drops the separator). Pure.
const SPECIAL = {
  'body only': 'Bodyweight',
  bodyweight: 'Bodyweight',
  'body weight': 'Bodyweight',
  'e-z curl bar': 'EZ Curl Bar',
  'e z curl bar': 'EZ Curl Bar',
}

export function equipmentLabel(value, fallback = '') {
  const text = String(value ?? '').trim()
  if (!text) return fallback
  const special = SPECIAL[text.toLowerCase().replace(/\s+/g, ' ')]
  if (special) return special
  return text
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
