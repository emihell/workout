// req-122 — NavLink's `look` → class string. Plain JS (not JSX) so `node --test` can
// lock the exact classes: the refactor must emit what the hand-written classes did.
//   'link'                          → 'ui-navlink'                   (the text link)
//   'primary' | 'secondary' | 'quiet' → 'ui-btn ui-btn--<look>'       (DEC-040 button look)
//                                     + ' ui-btn--block' with `block`
//   anything else (undefined, 'plain') → ''                          (no library class)
const BUTTON_LOOKS = ['primary', 'secondary', 'quiet']

export function lookClass(look, block = false) {
  if (look === 'link') return 'ui-navlink'
  if (BUTTON_LOOKS.includes(look)) return `ui-btn ui-btn--${look}${block ? ' ui-btn--block' : ''}`
  return ''
}
