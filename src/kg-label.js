// req-189 — the set form's kg label: "kg per dumbbell" when the exercise's equipment is
// dumbbell(s), else "kg". Stored values checked 2026-10-06: library records are saved with
// titleCase(free-db equipment) → "Dumbbell" (130 library entries, exerciseCatalog.js
// catalogItemToExercise); the seed records (src/db.json) say "Dumbbells"; the exercise editor
// takes free text. So: the word "dumbbell" or "dumbbells", any case, anywhere in the string.
export function isDumbbellEquipment(equipment) {
  return /\bdumbbells?\b/i.test(String(equipment || ''))
}

export function kgLabelFor(exercise) {
  return isDumbbellEquipment(exercise?.equipment) ? 'kg per dumbbell' : 'kg'
}
