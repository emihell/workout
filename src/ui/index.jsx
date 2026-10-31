// req-13 / DEC-017 — the minimal, colorless, Apple-inspired component library.
//
// First iteration: as little code as possible, grayscale only, every interactive
// target ≥44px. These are bare primitives. Every component lives here + in
// the #/components showcase until the per-screen styling pass migrates screens onto it.
//
// The one stylesheet (./ui.css) is imported once at the app root (main.jsx).
//
// req-276 — the bodies live in one module per job; this file is the library's public entry (DEC-017).
export { Button, NavLink, Actions, SegmentedControl, Checkbox, FileButton } from './controls.jsx'
export { Field, SearchField, NumberField, Textarea, Select } from './fields.jsx'
export { Screen, Title, SectionHeader, List, Row, Banner } from './layout.jsx'
export { ConfirmSheet } from './confirm-sheet.jsx'
export { WorkoutPill } from './pill.jsx'
export { SetLogForm, SetEditSheet } from './set-log-form.jsx'
export { ExerciseHead, RestNotes, SetList } from './sets.jsx'
