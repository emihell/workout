// req-52 / DEC-036 — the global bottom menu, extracted from ui/index.jsx's old
// TabBar (req-14/DEC-024). A floating dock (inset from the edges, NOT a flush
// full-width bar), solid — no translucency, no shadow — with two controls,
// left→right: Library · Workout. req-198: the Settings circle left the bar; its
// contents are "Backup & data" at the bottom of History (DEC-110 §1). History stays
// reached from Home (Emilio, mid-build: no History circle).
//
// - Workout is a wide text-only oval/capsule (flex:1, takes the remaining width) —
//   the deliberate focus.
// - Library is a circle (grid icon, inline stroke SVG on a 24px grid, grayscale via
//   currentColor) with a small visible text label under its icon (req-198, review
//   F10: icon-only failed the beginner test). The label is the accessible name, so
//   there is no aria-label.
// - Selection model A: the control for the CURRENT screen is ink-filled
//   (.is-current → --ui-ink bg / --ui-bg icon); the other carries a faint
//   hairline border (--ui-line, --ui-bg fill, --ui-ink icon). The fill MOVES with
//   the active tab. Which one is current comes from activeTab(route.name)
//   (route.js) — the same shared, unit-tested helper the old TabBar used; no new
//   grouping. aria-current="page" marks the selected one.
// - Still NavLink/<a> nav, not <button> (DEC-016): these navigate, they don't act,
//   and they reuse the one shared nav-link primitive (views/shared.jsx).
// - Targets: Workout → /, Library → /routines.
// - Hidden during the in-workout flow (route name starts with `workout`): the
//   in-gym screens are focused single-task surfaces; a persistent nav that could
//   jump you to Library mid-set fights them (unchanged from the old TabBar).
//
// Content clears the floating dock via .ui-main's bottom padding (--ui-dock-clear
// in ui.css), which is env(safe-area-inset-bottom)-driven so a no-notch device
// gets no dead gap.
//
// Selection (model A) reads from activeTab (route.js), whose grouping is
// unit-tested in route.test.js. The JSX render itself — the null-on-workout guard,
// the visible labels, the targets — is locked by a static-source check in
// BottomMenu.test.js (node --test can't parse JSX) and confirmed in the browser.
// The labels change again in req-199/req-201.
import { NavLink as BaseNavLink } from '../views/shared'
import { activeTab, useHashRoute } from '../route'

const cx = (...parts) => parts.filter(Boolean).join(' ')

// 4-square grid (Library). Stroke-only rounded squares — grayscale via
// currentColor, so it flips to --ui-bg on the ink-filled selected circle.
function GridIcon() {
  return (
    <svg
      className="ui-dock__icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function BottomMenu() {
  const route = useHashRoute()
  if (String(route.name).startsWith('workout')) return null
  const current = activeTab(route.name)
  return (
    <nav className="ui-dock" aria-label="Primary">
      <BaseNavLink
        to="/routines"
        className={cx('ui-dock__btn', 'ui-dock__circle', current === 'library' && 'is-current')}
        aria-current={current === 'library' ? 'page' : undefined}
      >
        <GridIcon />
        <span className="ui-dock__label">Library</span>
      </BaseNavLink>
      <BaseNavLink
        to="/"
        className={cx('ui-dock__btn', 'ui-dock__oval', current === 'workouts' && 'is-current')}
        aria-current={current === 'workouts' ? 'page' : undefined}
      >
        Workout
      </BaseNavLink>
    </nav>
  )
}
