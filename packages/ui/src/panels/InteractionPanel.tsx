import { useState } from 'react'
import { useArtinosRuntime, type SignalOperator } from '@artinos/runtime'
import { Button, KeyValue, NumberField, Section, Select, TextField, useSignals } from '../foundation'
const OPERATORS = { smooth: 'Smooth changes', scale: 'Multiply', offset: 'Add offset', clamp: 'Limit range', deadzone: 'Ignore small values', curve: 'Shape response', invert: 'Invert' } as const
export function InteractionPanel() {
  const runtime = useArtinosRuntime(), signals = useSignals(), numeric = signals.filter(signal => typeof signal.value === 'number')
  const [source, setSource] = useState('audio.beat'), [target, setTarget] = useState('processed.audio'), [command, setCommand] = useState('project.save')
  const [condition, setCondition] = useState('rise'), [threshold, setThreshold] = useState(.5), [operator, setOperator] = useState<keyof typeof OPERATORS>('smooth'), [amount, setAmount] = useState(.2), [, refresh] = useState(0)
  const [notice, setNotice] = useState('')
  const commands = runtime.commands.list()
  const validSource = numeric.some(signal => signal.id === source)
  const validTarget = Boolean(target.trim()) && target.trim() !== source
  const max = operator === 'smooth' || operator === 'deadzone' ? 1 : 10
  const min = operator === 'offset' || operator === 'scale' ? -10 : operator === 'curve' ? .01 : 0
  const save = () => { refresh(value => value + 1); runtime.persistence.save() }
  const addPipeline = () => {
    if (!validSource || !validTarget) return
    const a = Math.max(min, Math.min(max, amount))
    const definition: SignalOperator = operator === 'clamp' ? { type: 'clamp', min: 0, max: a } : operator === 'curve' ? { type: 'curve', power: a } : operator === 'invert' ? { type: 'invert', min: 0, max: a } : { type: operator, amount: a }
    runtime.signalProcessor.add({ id: `signal:${crypto.randomUUID()}`, source, target: target.trim(), operators: [definition] })
    save(); setNotice(`Routing ${source} through ${OPERATORS[operator].toLowerCase()} to ${target.trim()}.`)
  }
  return <>
    {notice && <div className="artinos-panel-notice" role="status">{notice}</div>}
    <div className="artinos-input-grid">
      <Section title="Shape a signal" description="Transform an incoming value before using it elsewhere.">
        <Select label="Input signal" value={source} options={[{ value: '', label: 'Choose a live signal' }, ...numeric.map(signal => ({ label: signal.id, value: signal.id }))]} onChange={setSource} />
        <Select label="Operation" value={operator} options={Object.entries(OPERATORS).map(([value, label]) => ({ label, value }))} onChange={value => setOperator(value)} />
        <NumberField label={operator === 'curve' ? 'Power' : operator === 'clamp' || operator === 'invert' ? 'Upper limit' : 'Amount'} value={amount} min={min} max={max} step={.01} onChange={setAmount} />
        <TextField label="Output signal" value={target} onChange={setTarget} />
        {!validSource && <p className="artinos-device-note">Choose an available signal. Connect a device to add more sources.</p>}
        {!validTarget && <p className="artinos-device-note">Name an output different from the input signal.</p>}
        <Button disabled={!validSource || !validTarget} onClick={addPipeline}>Add signal route</Button>
        {runtime.signalProcessor.list().map(item => <div className="artinos-binding" key={item.id}><KeyValue label={`${item.source} → ${item.target}`} value={item.operators.map(value => value.type).join(' · ')} /><Button title={`Remove route ${item.source} to ${item.target}`} onClick={() => { runtime.signalProcessor.remove(item.id); save() }}>Remove</Button></div>)}
      </Section>
      <Section title="Trigger an action" description="Run a command when a signal crosses a threshold or changes.">
        <Select label="Watch signal" value={source} options={[{ value: '', label: 'Choose a live signal' }, ...numeric.map(signal => ({ label: signal.id, value: signal.id }))]} onChange={setSource} />
        <Select label="When" value={condition} options={[{ value: 'change', label: 'Value changes' }, { value: 'rise', label: 'Crosses above threshold' }, { value: 'fall', label: 'Crosses below threshold' }, { value: 'above', label: 'Is above threshold' }, { value: 'below', label: 'Is below threshold' }]} onChange={setCondition} />
        {condition !== 'change' && <NumberField label="Threshold" value={threshold} min={-10} max={10} step={.01} onChange={setThreshold} />}
        <Select label="Run command" value={command} options={[{ value: '', label: 'Choose a command' }, ...commands.map(item => ({ label: item.label ?? item.id, value: item.id }))]} onChange={setCommand} />
        <Button disabled={!validSource || !commands.some(item => item.id === command)} onClick={() => { runtime.actions.add({ id: `action:${crypto.randomUUID()}`, source, command, condition: condition as 'rise', threshold, cooldownMs: 250 }); save(); setNotice('Action added. It will run when its condition is met.') }}>Add action</Button>
        {runtime.actions.list().map(item => <div className="artinos-binding" key={item.id}><KeyValue label={item.source} value={`${item.condition ?? 'change'} → ${item.command}`} /><Button title={`Remove action ${item.command}`} onClick={() => { runtime.actions.remove(item.id); save() }}>Remove</Button></div>)}
      </Section>
    </div>
  </>
}
