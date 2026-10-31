// req-266 — a rendered test that clicks a download (Back up now, Export for your AI) runs
// import-backup.js's downloadBlob, which schedules URL.revokeObjectURL 60 s out (REVOKE_AFTER_MS,
// req-157). Left pending, that timer keeps the test file's process alive after its tests are done,
// so the runner times the whole file out (./check no longer force-exits files: L-067).
//
// catchLongTimers() records every timer of `minMs` or longer scheduled until release(), which
// clears the ones still pending. The app's code and what the test asserts are unchanged.
export function catchLongTimers(minMs = 10_000) {
  const real = globalThis.setTimeout
  const caught = []
  globalThis.setTimeout = function (fn, ms, ...args) {
    const timer = real(fn, ms, ...args)
    if (ms >= minMs) caught.push(timer)
    return timer
  }
  return {
    caught,
    release() {
      globalThis.setTimeout = real
      for (const timer of caught) clearTimeout(timer)
    },
  }
}
