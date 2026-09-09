import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { ErrorBoundary } from './error-boundary.js'

// react-test-renderer runs the real client reconciler (the only place error
// boundaries actually work — SSR/renderToStaticMarkup does not catch them), with
// no DOM. Flag the act environment so state flushes synchronously.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Throws while React is *rendering* it — the case boundaries catch. A throw from
// an onClick handler would NOT be caught, which is why the throw lives here.
function ThrowsInRender() {
  throw new Error('boom during render')
}

function renderInBoundary(child) {
  let renderer
  act(() => {
    renderer = TestRenderer.create(React.createElement(ErrorBoundary, null, child))
  })
  return renderer
}

// Collect all text nodes from a react-test-renderer JSON tree.
function allText(node) {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(allText).join(' ')
  return allText(node.children)
}

// react-test-renderer emits this via console.error on every create(); it is not
// an app error, so filter it out before asserting on what got logged.
const isDeprecationNotice = (args) =>
  args.some((a) => String(a).includes('react-test-renderer is deprecated'))

describe('ErrorBoundary', () => {
  let errors
  let originalError
  beforeEach(() => {
    // React logs the caught error, and componentDidCatch logs too. Capture
    // instead of printing so the run stays clean, and so we can assert it fired.
    errors = []
    originalError = console.error
    console.error = (...args) => errors.push(args)
  })
  afterEach(() => {
    console.error = originalError
  })

  it('renders a fallback (not a blank tree) when a child throws during render', () => {
    const renderer = renderInBoundary(React.createElement(ThrowsInRender))
    const tree = renderer.toJSON()

    // The point: not blank. A boundary that failed to catch would leave null.
    assert.notEqual(tree, null, 'expected a fallback tree, got a blank render')
    const text = allText(tree)
    assert.match(text, /Your data is saved/, 'fallback must reassure data is saved')
    assert.match(text, /Reload/, 'fallback must offer a reload')
    assert.match(text, /Today/, 'fallback must offer a way back to Today')

    // Right mechanism: componentDidCatch logged the render error.
    assert.ok(
      errors.some((args) => args.some((a) => String(a).includes('boom during render'))),
      'componentDidCatch should log the caught render error',
    )
  })

  it('renders children unchanged when nothing throws', () => {
    const renderer = renderInBoundary(React.createElement('span', null, 'normal screen'))
    const tree = renderer.toJSON()
    assert.equal(allText(tree), 'normal screen')
    assert.doesNotMatch(allText(tree), /Your data is saved/)
    const appErrors = errors.filter((args) => !isDeprecationNotice(args))
    assert.equal(appErrors.length, 0, 'no app error should be logged on the happy path')
  })
})
