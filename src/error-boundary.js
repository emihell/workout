import React from 'react'

// A render-time throw anywhere below <Screen/> would otherwise unmount the whole
// tree to a blank white page. This boundary catches it and shows a self-contained
// fallback instead — it deliberately reads NO store/app state (the state is what
// may have caused the crash), only its own error flag. Authored with
// React.createElement rather than JSX so `node --test` can import it directly.
//
// Boundaries only catch errors thrown during render/lifecycle of descendants, not
// in event handlers — that is what the test proves.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
    this.handleRouteChange = this.handleRouteChange.bind(this)
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Render error caught by ErrorBoundary:', error, info)
  }

  componentDidMount() {
    // Clear the error when the user navigates, so the Today link and the still-
    // visible Nav actually recover the app (re-mounting the screen) instead of
    // requiring a full reload. Guarded because the test renderer has no window.
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', this.handleRouteChange)
    }
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('hashchange', this.handleRouteChange)
    }
  }

  handleRouteChange() {
    if (this.state.hasError) this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return React.createElement(
        'div',
        { role: 'alert' },
        React.createElement('p', null, 'Something went wrong on this screen.'),
        React.createElement(
          'p',
          null,
          'Your data is saved. Your logged sets and workouts are stored on this device and were not lost.',
        ),
        React.createElement(
          'button',
          { type: 'button', onClick: () => location.reload() },
          'Reload',
        ),
        ' ',
        React.createElement('a', { href: '#/' }, 'Back to Today'),
      )
    }
    return this.props.children
  }
}
