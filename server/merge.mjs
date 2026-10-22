// req-229 §5 — the three-way merge. req-230: the code lives in src/sync/merge.js so the app and the
// server run one merge (the app rebases a change made during an in-flight sync with it).
export { mergeStates, mergeWithoutBase } from '../src/sync/merge.js'
