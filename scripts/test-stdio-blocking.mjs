// req-266 (L-067) — preloaded by ./check (`node --import`) into the test runner and, through its
// execArgv, into every test file's child process.
//
// Why: `--test-force-exit` (req-248) ends each child with process.exit() as soon as its tests are
// done. A child reports its results to the runner over a stdout PIPE, and on POSIX node writes to
// a pipe asynchronously: whatever the runner hasn't read yet sits in the child's write queue, and
// process.exit() drops it. The runner then sees a file that ended early with exit code 0: its
// remaining tests vanish with no ✖ and the gate stays green (measured 2026-10-31: 2171–2187 tests
// across 10 identical runs; a probe on 'exit' found the short runs' file with 8–24 KB unwritten).
//
// Making the pipe blocking turns every write synchronous (as node already does for files and
// TTYs), so nothing is queued when process.exit() runs. Force-exit stays: it is what ends a file
// whose timed-out test left a handle open (req-248's guarantee).
for (const stream of [process.stdout, process.stderr]) {
  const handle = stream?._handle
  if (stream?._type === 'pipe' && typeof handle?.setBlocking === 'function') {
    const err = handle.setBlocking(true)
    if (err) throw new Error(`test-stdio-blocking: setBlocking failed on fd ${handle.fd} (${err})`)
  }
}
