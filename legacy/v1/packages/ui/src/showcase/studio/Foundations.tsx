import type { CSSProperties } from 'react'
import { Pane } from '../../primitives'

/**
 * Foundations — the values every component resolves through, shown as themselves:
 * ink as text at its own colour, surfaces as real glass, motion as something that
 * actually moves.
 */

const INK: Array<[token: string, use: string]> = [
  ['--ui-text', 'body and values'],
  ['--ui-text-label', 'row names'],
  ['--ui-text-summary', 'folder summaries'],
  ['--ui-text-body', 'prose, canvas bar'],
  ['--ui-text-muted', 'navigation, status'],
  ['--ui-text-soft', 'icons, pane feet'],
  ['--ui-text-meta', 'units, counts, meta'],
  ['--ui-text-serial', 'serials'],
  ['--ui-text-ghost', 'idle pins, disabled'],
]

const ACCENT: Array<[token: string, use: string]> = [
  ['--ui-accent', 'tab rule, active text'],
  ['--ui-accent-strong', 'the seam in hand'],
  ['--ui-accent-dot', 'running, selected edge'],
  ['--ui-accent-wash', 'selected surfaces'],
  ['--ui-accent-line', 'live edges'],
  ['--ui-warn', 'degraded'],
  ['--ui-fault', 'stopped, invalid'],
  ['--ui-bind', 'externally driven'],
]

const LINES: Array<[token: string, use: string]> = [
  ['--ui-line-faint', 'rules inside a folder'],
  ['--ui-line-soft', 'folder borders'],
  ['--ui-line', 'heads, feet, tab strip'],
  ['--ui-line-strong', 'pane edge'],
]

const TYPE: Array<[label: string, style: CSSProperties, sample: string]> = [
  ['title 14 / 550', { fontSize: 14, fontWeight: 550, letterSpacing: '-0.025em' }, 'Command workbench'],
  ['pane 12 / 550', { fontSize: 12, fontWeight: 550, letterSpacing: '-0.025em' }, 'Lighting'],
  ['body 12 / 400', { fontSize: 12 }, 'Every value is a local control'],
  ['label 10 / 400', { fontSize: 10, color: 'var(--ui-text-label)' }, 'Transmission'],
  ['value 10 / 500', { fontSize: 10, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }, '72%  5.6 mm  5600 K'],
  ['summary 9 / 400', { fontSize: 9, letterSpacing: '0.04em', color: 'var(--ui-text-summary)' }, 'Material'],
  ['meta 8 / 400', { fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ui-text-meta)' }, 'Optical'],
]

const METRICS: Array<[token: string, value: string, width: string]> = [
  ['--ui-row', '26px', '26px'],
  ['--ui-control-h', '23px', '23px'],
  ['--ui-range-h', '22px', '22px'],
  ['--ui-label-w', '69px', '69px'],
  ['--ui-radius', '7px', '7px'],
  ['--ui-radius-control', '5px', '5px'],
]

const MOTION: Array<[token: string, ease: string, duration: string, use: string]> = [
  ['press', 'var(--ui-ease)', 'var(--ui-dur-press)', 'a button going down'],
  ['fast', 'var(--ui-ease)', 'var(--ui-dur-fast)', 'hover, fills, washes'],
  ['state', 'var(--ui-ease)', 'var(--ui-dur)', 'a control changing state'],
  ['spring', 'var(--ui-ease-spring)', 'var(--ui-dur-slow)', 'knobs and thumbs'],
  ['settle', 'var(--ui-ease-out)', 'var(--ui-dur-slow)', 'a rule travelling'],
  ['surface', 'var(--ui-ease-out)', 'var(--ui-dur-shadow)', 'glass and shadow'],
]

const SURFACES: Array<[variant: string, note: string]> = [
  ['default', 'panes, docks'],
  ['command', 'the inspector, floating chrome'],
  ['material', 'dense parameter cards'],
  ['light', 'lit surfaces'],
]

export function Foundations() {
  return (
    <>
      <p className="ui-studio-lead">
        <b>Everything resolves through tokens.</b> Components read <code>--ui-*</code> and nothing else, so a theme is a
        set of values rather than a second stylesheet — and anything below can be retuned live in the theme editor.
      </p>

      <Pane index={1} title="Ink" meta="READABILITY">
        {INK.map(([token, use]) => (
          <div className="ui-studio-inkrow" key={token} style={{ '--ink': `var(${token})` } as CSSProperties}>
            <b>{token.replace('--ui-', '')}</b>
            <span>Aa — {use}</span>
            <span>{token}</span>
          </div>
        ))}
      </Pane>

      <Pane index={2} title="Accent and state" meta="MEANING">
        <div className="ui-studio-ramp">
          {ACCENT.map(([token, use]) => (
            <div key={token} style={{ '--swatch': `var(${token})` } as CSSProperties}>
              <b>{token.replace('--ui-', '')}</b>
              <i />
              <span>{use}</span>
            </div>
          ))}
        </div>
      </Pane>

      <Pane index={3} title="Lines" meta="STRUCTURE">
        <div className="ui-studio-ramp">
          {LINES.map(([token, use]) => (
            <div key={token} style={{ '--swatch': `var(${token})` } as CSSProperties}>
              <b>{token.replace('--ui-', '')}</b>
              <i />
              <span>{use}</span>
            </div>
          ))}
        </div>
      </Pane>

      <Pane index={4} title="Type" meta="SCALE">
        <div className="ui-studio-type">
          {TYPE.map(([label, style, sample]) => (
            <div key={label}>
              <span style={style}>{sample}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>
      </Pane>

      <Pane index={5} title="Metrics" meta="GEOMETRY">
        <div className="ui-studio-metrics">
          {METRICS.map(([token, value, width]) => (
            <div className="ui-studio-metric" key={token}>
              <b style={{ fontWeight: 400 }}>{token.replace('--ui-', '')}</b>
              <i style={{ width }} />
              <span>{value}</span>
            </div>
          ))}
        </div>
      </Pane>

      <Pane index={6} title="Surfaces" meta="MATERIAL">
        <div className="ui-studio-surfaces">
          {SURFACES.map(([variant, note]) => (
            <div
              className="ui-studio-surface"
              key={variant}
              style={{
                background:
                  variant === 'command'
                    ? 'var(--ui-command-sheen), var(--ui-command-tint)'
                    : variant === 'material'
                      ? 'var(--ui-material-sheen)'
                      : variant === 'light'
                        ? 'var(--ui-light-tint)'
                        : 'var(--ui-pane-sheen), var(--ui-pane-tint)',
                backdropFilter: `blur(var(--ui-${variant === 'default' ? '' : variant + '-'}blur, var(--ui-blur)))`,
              }}
            >
              <b>{variant}</b>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </Pane>

      <Pane index={7} title="Motion" meta="FEEL" footer={<><span>Hover a rail</span><span>REDUCED MOTION HONOURED</span></>}>
        <div className="ui-studio-motion">
          {MOTION.map(([token, ease, duration, use]) => (
            <div
              className="ui-studio-motion-track"
              key={token}
              tabIndex={0}
              style={{ '--ease': ease, '--duration': duration, '--travel': '180px' } as CSSProperties}
            >
              <b style={{ fontWeight: 400 }}>
                {token} <span style={{ color: 'var(--ui-text-meta)', fontSize: 9 }}>{use}</span>
              </b>
              <div className="ui-studio-motion-rail">
                <i />
              </div>
            </div>
          ))}
        </div>
      </Pane>
    </>
  )
}
