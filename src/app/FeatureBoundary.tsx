import { Component, Suspense, type ReactNode } from 'react'

interface Props {
  id: string
  /** A new value clears a caught error, so the feature gets another attempt. */
  resetKey?: unknown
  children: ReactNode
}

interface State {
  error: Error | null
  key?: unknown
}

/**
 * Isolates one feature: a crash or a pending load in it never takes the rest
 * of the scene down. The feature renders nothing until its props change.
 */
export class FeatureBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    // New props are a new attempt.
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey }
    return null
  }

  componentDidCatch(error: Error) {
    // The console capture turns this into a studio toast.
    console.error(`[features] ${this.props.id} crashed`, error)
  }

  render() {
    if (this.state.error) return null
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}
