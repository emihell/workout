// req-164 (F-STRUCT-6) — storage.js was four modules in one; it is now split by job:
//   persistence.js      load / save / the stored keys / the lock and signals / the unreadable copies
//   history-queries.js  "last time", previous workouts, summary stats, grouping
//   state-reducers.js   (state, …) → state reducers and the delete blast radius
// The app imports those directly. This file re-exports them for one release so the
// tests (and anything not yet moved) keep working; it holds no code of its own.
export { exerciseById, routineById } from './model.js'
export * from './persistence.js'
export * from './history-queries.js'
export * from './state-reducers.js'
