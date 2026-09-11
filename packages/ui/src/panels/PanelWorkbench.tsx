import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

/** Shared panel structure, also used inside detached and docked windows. */
export function PanelWorkbench({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const [layout, setLayout] = useState('portrait')
  useEffect(() => {
    const host = ref.current?.parentElement
    if (!host) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setLayout(width > 600 && width > height * 1.8 ? 'landscape' : 'portrait')
      ref.current?.style.setProperty('--panel-height', `${height}px`)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  return <section ref={ref} className="artinos-workbench" data-layout={layout} aria-label={`${title} workspace`}>
    <PanelErrorBoundary title={title}><div className="artinos-workbench-content">{children}</div></PanelErrorBoundary>
  </section>
}

class PanelErrorBoundary extends Component<{ title: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return <div className="artinos-workbench-empty" role="alert"><TriangleAlert size={24} /><h3>{this.props.title} could not open</h3><p>{this.state.error.message}</p><button type="button" className="artinos-button" onClick={() => this.setState({ error: null })}><RotateCcw size={14} /> Retry panel</button></div>
  }
}

export function PanelEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="artinos-workbench-empty"><h3>{title}</h3><p>{description}</p>{action}</div>
}
