import type { ReactNode } from 'react'

/** AppBar — the workbench's top bar: brand and page title, session context, navigation (reference `header.shell`). */
export function AppBar({
  brand,
  title,
  href,
  context,
  nav,
}: {
  brand: ReactNode
  /** Rendered after the brand, quieter: "/ Command workbench". */
  title?: ReactNode
  href?: string
  context?: ReactNode
  /** Links, rendered in a `<nav>`. */
  nav?: ReactNode
}) {
  const identity = (
    <>
      {brand}
      {title && <span>{title}</span>}
    </>
  )
  return (
    <header className="artinos-appbar">
      {href ? (
        <a className="artinos-appbar-brand" href={href}>
          {identity}
        </a>
      ) : (
        <span className="artinos-appbar-brand">{identity}</span>
      )}
      {context && <span className="artinos-appbar-context">{context}</span>}
      {nav && <nav className="artinos-appbar-nav">{nav}</nav>}
    </header>
  )
}
