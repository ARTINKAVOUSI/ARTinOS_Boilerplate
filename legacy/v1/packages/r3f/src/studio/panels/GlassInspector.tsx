import { useState } from 'react'
import { useArtinosRuntime, useResolvedParameter } from '@artinos/runtime'
import { glassOptics, glassParameterDefs, refractedAngle } from '@artinos/modules/materials'
import { useTelemetry } from '../hooks'
import { ThreeInspectorPanel } from './ThreeInspectorPanel'
import { Button } from '@artinos/ui'

/** Reference glass diagnostics, embedded in the existing Inspector and sharing its parameters. */
export function GlassInspector() {
  const runtime = useArtinosRuntime()
  const ior = Number(useResolvedParameter(glassParameterDefs.ior))
  const dispersion = Number(useResolvedParameter(glassParameterDefs.dispersion))
  const thickness = Number(useResolvedParameter(glassParameterDefs.thickness))
  const backsideThickness = Number(useResolvedParameter(glassParameterDefs.backsideThickness))
  const backside = Boolean(useResolvedParameter(glassParameterDefs.backside))
  const spectral = Boolean(useResolvedParameter(glassParameterDefs.spectralDispersion))
  const [exiting, setExiting] = useState(false)
  const [rendererOpen, setRendererOpen] = useState(false)
  const metrics = useTelemetry()
  const optics = glassOptics(ior, dispersion)
  const metric = (id: string) => {
    const item = metrics.find(m => m.id === id)
    if (!item) return '—'
    return `${typeof item.value === 'number' ? item.value.toFixed(item.unit === 'ms' ? 2 : 0) : item.value}${item.unit ? ` ${item.unit}` : ''}`
  }
  const path = (n: number) => Array.from({ length: 61 }, (_, i) => {
    const incident = i / 60 * (exiting ? Math.asin(1 / n) * 180 / Math.PI : 90)
    return `${i ? 'L' : 'M'}${28 + incident * 2.45},${108 - refractedAngle(incident, n, exiting)}`
  }).join(' ')
  return <details className="artinos-glass-inspector" open>
    <summary>Glass optics & monitoring</summary>
    <div className="artinos-glass-diagnostics">
      <figure>
        <Button onClick={() => setExiting(value => !value)} aria-label="Switch refraction direction">{exiting ? 'Glass → air' : 'Air → glass'}</Button>
        <svg viewBox="0 0 270 140" role="img" aria-label="Refraction angle versus incident angle for red, green, and blue light">
          <path d="M28 18V108H249 M28 108L249 18" fill="none" stroke="currentColor" opacity=".25" />
          {[30, 60].map(angle => <path key={angle} d={`M28 ${108-angle}H249 M${28+angle*2.45} 18V108`} fill="none" stroke="currentColor" opacity=".1" />)}
          {[['#fb7185', optics.red], ['#36dcc4', optics.green], ['#60a5fa', optics.blue]].map(([color, n]) =>
            <path key={color} d={path(Number(n))} fill="none" stroke={String(color)} strokeWidth="1.8" />)}
          <path d={`M258 108V${108-Math.min(1,thickness/5)*90}`} stroke="#a78bfa" strokeWidth="3"><title>Front thickness: {thickness.toFixed(2)} / 5</title></path>
          <g fill="currentColor" fontSize="9"><text x="17" y="112">0°</text><text x="6" y="22">90°</text><text x="235" y="123">90°</text><text x="90" y="136">Incident angle →</text><text x="35" y="14">Refracted angle</text></g>
        </svg>
        <figcaption>{spectral ? 'Spectral IOR range' : 'RGB IOR curves'} · violet bar: thickness<br />{exiting ? 'Curves end at total internal reflection.' : 'Surface angles follow Snell’s law; thickness changes ray travel.'}</figcaption>
      </figure>
      <dl>
        <dt>IOR · R / G / B</dt><dd>{optics.red.toFixed(3)} / {optics.green.toFixed(3)} / {optics.blue.toFixed(3)}</dd>
        <dt>Critical angle · glass → air</dt><dd>{optics.criticalAngle.toFixed(1)}°</dd>
        <dt>Dielectric F0 · IOR only</dt><dd>{(optics.reflectance * 100).toFixed(2)}%</dd>
        <dt>Front / backside thickness</dt><dd>{thickness.toFixed(2)} / {backside ? backsideThickness.toFixed(2) : 'off'}</dd>
        <dt>Active glass meshes</dt><dd>{metric('glass.meshes')}</dd>
      </dl>
      <dl aria-label="Glass pass monitoring">
        <dt>Frame rate</dt><dd>{metric('performance.fps')}</dd>
        <dt>Compiled refraction mode</dt><dd>{metric('glass.mode')}</dd>
        <dt>Backdrop capture</dt><dd>{metric('glass.backdropResolution')}</dd>
        <dt>Clean capture</dt><dd>{metric('glass.cleanResolution')}</dd>
        <dt>Capture CPU submission</dt><dd>{metric('glass.captureCpuMs')}</dd>
        <dt>Refraction taps / sample set</dt><dd>{metric('glass.taps')}</dd>
      </dl>
    </div>
    <Button onClick={() => setRendererOpen(value => !value)} aria-expanded={rendererOpen}>{rendererOpen ? 'Hide' : 'Show'} renderer monitor</Button>
    {rendererOpen && <div className="artinos-glass-renderer"><ThreeInspectorPanel /></div>}
    {!runtime.resources.get('render.pipeline') && <p>Enable the renderer pipeline for clean and backside capture monitoring.</p>}
  </details>
}
