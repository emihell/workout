// req-276 — split from ui/index.jsx: the class-name join every component uses.

export const cx = (...parts) => parts.filter(Boolean).join(' ')
