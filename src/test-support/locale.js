// Test-only (req-228): pin the DEFAULT locale for date formatting to en-US, so a test
// that asserts date text ("Wednesday, Oct 7") gives the same result on any machine.
//
// Why here and not in ./check: V8 reads the default locale from LANG/LC_* once at process
// start and has no runtime setter, and `node --test` run by hand inherits the shell's
// LANG — so pinning env in ./check would leave plain `node --test` red on an en-GB Mac.
// A side-effect import in the test file covers both.
//
// What it changes: only calls that pass NO locale (`undefined`) — which is how the app
// formats dates (src/views/history/helpers.js, src/views/schedule-day.js), leaving the
// phone's locale in charge for the user. An explicit locale passes through untouched.
// App code is not modified; this module is imported only by tests.
const PINNED = 'en-US'

const pin = (locales) => (locales === undefined ? PINNED : locales)

for (const name of ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']) {
  const original = Date.prototype[name]
  if (original.__req228Pinned) continue
  const pinned = function (locales, options) {
    return original.call(this, pin(locales), options)
  }
  pinned.__req228Pinned = true
  Date.prototype[name] = pinned
}

if (!Intl.DateTimeFormat.__req228Pinned) {
  const Original = Intl.DateTimeFormat
  const Pinned = function DateTimeFormat(locales, options) {
    return new Original(pin(locales), options)
  }
  Pinned.prototype = Original.prototype
  Pinned.supportedLocalesOf = Original.supportedLocalesOf.bind(Original)
  Pinned.__req228Pinned = true
  Intl.DateTimeFormat = Pinned
}

export const TEST_LOCALE = PINNED
