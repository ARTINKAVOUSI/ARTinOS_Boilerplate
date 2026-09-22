import { Component, Suspense, type ReactNode } from 'react'

type Listener = (id: string, error: Error) => void
const listeners = new Set<Listener>()

/** Subscribe to feature crashes (the studio turns them into toasts). */
export function onFeatureError(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

interface Props {
  id: string
  children: ReactNode
}

/**
 * Isolates one feature: a crash or a pending load in it never takes the rest
 * of the scene down. The feature renders nothing until its props change.
 */
export class FeatureBoundary extends Component<Props & { resetKey?: string }, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  static getDerivedStateFromProps(props: Props & { resetKey?: string }, state: { error: Error | null; key?: string }) {
    // New props are a new attempt.
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey }
    return null
  }

  componentDidCatch(error: Error) {
    console.error(`[features] ${this.props.id} crashed`, error)
    listeners.forEach(listener => listener(this.props.id, error))
  }

  render() {
    if (this.state.error) return null
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}
