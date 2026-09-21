import { useState, useSyncExternalStore } from 'react'
import type { FeatureInspector, FeatureInspectorProps } from '../../../app/feature'
import { useRuntime } from '../../../app/runtime'
import { Button } from '../../../ui/Button/Button'
import { glassOptics, refractedAngle } from './glass-optics'
import { glassMonitor } from './glass-capture'
import './GlassInspector.css'

const THREE_INSPECTOR = 'overlay.three-inspector'

/**
 * Glass optics & monitoring — v1's reference glass diagnostics, embedded in the
 * Inspector and reading the same controls the glass card edits.
 *
 * The chart plots the shader's real RGB IOR spread against incident angle, in
 * either direction; the readouts are the optics those values imply; the monitor
 * rows are what the glass capture passes are doing right now.
 */
export function GlassInspector({ values, peer, setEnabled }: FeatureInspectorProps) {
  const monitor = useSyncExternalStore(glassMonitor.subscribe, glassMonitor.get, glassMonitor.get)
  const { fps } = useRuntime()
  const threeInspector = peer(THREE_INSPECTOR)
  const [exiting, setExiting] = useState(false)

  const read = (name: string, fallback: number) => {
    const value = values[name]
    return typeof value === 'number' ? value : fallback
  }
  const ior = read('ior', 1.26)
  const dispersion = read('dispersion', 6)
  const thickness = read('thickness', 0.98)
  const backsideThickness = read('backsideThickness', 3)
  const backside = values.backside !== false
  const spectral = values.spectralDispersion === true
  const optics = glassOptics(ior, dispersion)

  const path = (n: number) =>
    Array.from({ length: 61 }, (_, i) => {
      const incident = (i / 60) * (exiting ? (Math.asin(1 / n) * 180) / Math.PI : 90)
      return `${i ? 'L' : 'M'}${28 + incident * 2.45},${108 - refractedAngle(incident, n, exiting)}`
    }).join(' ')

  return (
    <details className="artinos-glass-inspector" open>
      <summary>Glass optics & monitoring</summary>
      <div className="artinos-glass-diagnostics">
        <figure>
          <Button size="sm" onClick={() => setExiting(value => !value)} aria-label="Switch refraction direction">
            {exiting ? 'Glass → air' : 'Air → glass'}
          </Button>
          <svg className="artinos-glass-chart" viewBox="0 0 270 140" role="img" aria-label="Refraction angle versus incident angle for red, green, and blue light">
            <path d="M28 18V108H249 M28 108L249 18" fill="none" stroke="currentColor" opacity=".25" />
            {[30, 60].map(angle => (
              <path key={angle} d={`M28 ${108 - angle}H249 M${28 + angle * 2.45} 18V108`} fill="none" stroke="currentColor" opacity=".1" />
            ))}
            {(
              [
                ['#fb7185', optics.red],
                ['#36dcc4', optics.green],
                ['#60a5fa', optics.blue],
              ] as const
            ).map(([color, n]) => (
              <path key={color} d={path(n)} fill="none" stroke={color} strokeWidth="1.8" />
            ))}
            <path d={`M258 108V${108 - Math.min(1, thickness / 5) * 90}`} stroke="#a78bfa" strokeWidth="3">
              <title>Front thickness: {thickness.toFixed(2)} / 5</title>
            </path>
            <g fill="currentColor" fontSize="9">
              <text x="17" y="112">
                0°
              </text>
              <text x="6" y="22">
                90°
              </text>
              <text x="235" y="123">
                90°
              </text>
              <text x="90" y="136">
                Incident angle →
              </text>
              <text x="35" y="14">
                Refracted angle
              </text>
            </g>
          </svg>
          <figcaption>
            {spectral ? 'Spectral IOR range' : 'RGB IOR curves'} · violet bar: thickness
            <br />
            {exiting ? 'Curves end at total internal reflection.' : 'Surface angles follow Snell’s law; thickness changes ray travel.'}
          </figcaption>
        </figure>
        <dl>
          <dt>IOR · R / G / B</dt>
          <dd>
            {optics.red.toFixed(3)} / {optics.green.toFixed(3)} / {optics.blue.toFixed(3)}
          </dd>
          <dt>Critical angle · glass → air</dt>
          <dd>{optics.criticalAngle.toFixed(1)}°</dd>
          <dt>Dielectric F0 · IOR only</dt>
          <dd>{(optics.reflectance * 100).toFixed(2)}%</dd>
          <dt>Front / backside thickness</dt>
          <dd>
            {thickness.toFixed(2)} / {backside ? backsideThickness.toFixed(2) : 'off'}
          </dd>
          <dt>Active glass meshes</dt>
          <dd>{monitor.meshes}</dd>
        </dl>
        <dl aria-label="Glass pass monitoring">
          <dt>Frame rate</dt>
          <dd>{Math.round(fps)} fps</dd>
          <dt>Compiled refraction mode</dt>
          <dd>{monitor.mode}</dd>
          <dt>Backdrop capture</dt>
          <dd>{monitor.backdropResolution}</dd>
          <dt>Clean capture</dt>
          <dd>{monitor.cleanResolution}</dd>
          <dt>Capture CPU submission</dt>
          <dd>{monitor.captureCpuMs.toFixed(2)} ms</dd>
          <dt>Refraction taps / sample set</dt>
          <dd>{monitor.taps}</dd>
        </dl>
      </div>
      {threeInspector && (
        <Button size="sm" aria-expanded={threeInspector.enabled} onClick={() => setEnabled(THREE_INSPECTOR, !threeInspector.enabled)}>
          {threeInspector.enabled ? 'Hide' : 'Show'} renderer monitor
        </Button>
      )}
      {!peer('postfx') && <p>Enable the renderer pipeline for clean and backside capture monitoring.</p>}
    </details>
  )
}

export default GlassInspector

/**
 * Studio-only: the Inspector panel shows this section for the first of these
 * features that is switched on, the reference rings first. It lives in the
 * glass folder so deleting the folder removes it too.
 */
export const inspector: FeatureInspector = {
  id: 'glass',
  features: ['object.glass-rings', 'object.glass-mesh'],
  component: GlassInspector,
}
