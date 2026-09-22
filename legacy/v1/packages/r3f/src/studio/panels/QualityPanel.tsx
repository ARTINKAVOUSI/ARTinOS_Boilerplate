import { useArtinosRuntime } from '@artinos/runtime'
import { Button, KeyValue, Section, Slider } from '@artinos/ui'
import { useQuality } from '../hooks'

export function QualityPanel() {
  const runtime = useArtinosRuntime()
  const quality = useQuality()

  return (
    <Section title="Adaptive Quality">
      <KeyValue label="Tier" value={quality.tier} />
      <Slider label="Scalar" value={quality.scalar} min={0.4} max={1} step={0.025} onChange={scalar => runtime.quality.setState({ scalar, mode: 'manual' })} />
      <Slider label="Target FPS" value={quality.targetFps} min={30} max={120} step={1} onChange={targetFps => runtime.quality.setState({ targetFps, mode: 'manual' })} />
      <div className="artinos-button-row">
        <Button active={quality.mode === 'auto'} onClick={() => runtime.quality.setState({ mode: 'auto' })}>
          AUTO
        </Button>
        <Button active={quality.mode === 'manual'} onClick={() => runtime.quality.setState({ mode: 'manual' })}>
          MANUAL
        </Button>
      </div>
      <KeyValue label="Consumers" value={runtime.quality.listConsumers().join(', ') || 'renderer DPR'} />
    </Section>
  )
}
