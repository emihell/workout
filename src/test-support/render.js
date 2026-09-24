// req-156 (audit F-TEST-1) — render the app's real components under plain `node --test`.
// Before this, 29 of 57 test files could only read .jsx as source text, and no component
// was ever rendered (that is how F-TRUST-2's hidden effort got through).
//
//   import { importJsx, render, act } from './test-support/render.js'
//   const { SetLogForm } = await importJsx('../ui/index.jsx', import.meta.url)
//   const view = await render(React.createElement(SetLogForm, props))   // .test.js has no JSX
//   await view.click(view.button('Complete'))
//
// A DOM comes from happy-dom (a devDependency; replaces the deprecated
// react-test-renderer for view tests), rendered by the real react-dom/client, with real
// events — a test clicks and submits the way a user does. Each test file runs in its own
// process under `node --test`, so the globals set here don't leak across files.
import { register } from 'node:module'
import { Window } from 'happy-dom'

register('./jsx-loader.js', import.meta.url)

const window = new Window({ url: 'http://localhost/' })
// The browser globals the app's modules touch at import or render time. `navigator` is
// replaced even though Node 22 has one (the app reads DOM-only parts, e.g. wakeLock).
const GLOBALS = [
  'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage',
  'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'SubmitEvent', 'CustomEvent',
  'getComputedStyle', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame',
]
Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true })
for (const key of GLOBALS) {
  if (!(key in globalThis) || key === 'navigator') {
    const value = typeof window[key] === 'function' && /^[a-z]/.test(key) ? window[key].bind(window) : window[key]
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
export const act = React.act

// Import a .jsx (or a .js that imports .jsx) relative to the calling test file.
export function importJsx(specifier, fromUrl) {
  return import(new URL(specifier, fromUrl).href)
}

// Mount an element into a fresh container. Returns small query/interaction helpers.
export async function render(element) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(element))
  const all = (selector) => [...container.querySelectorAll(selector)]
  const byText = (selector, text) => all(selector).find((node) => node.textContent.trim() === text) ?? null
  return {
    container,
    text: () => container.textContent,
    all,
    button: (label) => byText('button', label),
    // The input inside the <label> whose text starts with `label` (ui Field markup).
    input: (label) => all('label').find((node) => node.textContent.trim().startsWith(label))?.querySelector('input') ?? null,
    async click(node) {
      if (!node) throw new Error('render: click target not found')
      await act(async () => node.click())
    },
    // Set an input's value the way React's onChange sees a keystroke.
    async type(input, value) {
      if (!input) throw new Error('render: input not found')
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
      await act(async () => {
        setter.call(input, value)
        input.dispatchEvent(new window.Event('input', { bubbles: true }))
      })
    },
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}
