import './Kbd.css'

export interface KbdProps {
  /** Keys, e.g. `['mod', 'K']`. `mod` is ⌘ on Apple platforms and Ctrl elsewhere. */
  keys: readonly string[]
  className?: string
}

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const glyph = (key: string) => {
  const k = key.toLowerCase()
  if (k === 'mod') return isApple ? '⌘' : 'Ctrl'
  if (k === 'shift') return isApple ? '⇧' : 'Shift'
  if (k === 'alt') return isApple ? '⌥' : 'Alt'
  if (k === 'enter') return '↵'
  if (k === 'escape' || k === 'esc') return 'Esc'
  return key.length === 1 ? key.toUpperCase() : key
}

/** Kbd — a keyboard shortcut hint. */
export function Kbd({ keys, className }: KbdProps) {
  return (
    <span className={className ? `aui-kbd ${className}` : 'aui-kbd'}>
      {keys.map((key, i) => (
        <kbd key={i}>{glyph(key)}</kbd>
      ))}
    </span>
  )
}

export default Kbd
