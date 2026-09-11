import { useArtinosRuntime } from '@artinos/runtime'
import { Button, KeyValue, Section, Stack } from '../primitives'
import { useHistory } from '../hooks'
import { formatValue } from './format'

export function HistoryPanel() {
  const runtime = useArtinosRuntime()
  const history = useHistory()

  return (
    <Section title="History">
      <div className="artinos-button-row">
        <Button disabled={!history.undo.length} onClick={() => runtime.undo()}>
          Undo
        </Button>
        <Button disabled={!history.redo.length} onClick={() => runtime.redo()}>
          Redo
        </Button>
        <Button onClick={() => runtime.history.clear()}>Clear</Button>
      </div>
      <Stack>
        {history.undo
          .slice(-20)
          .reverse()
          .map(entry => (
            <KeyValue key={entry.id} label={entry.label ?? entry.parameterId} value={`${formatValue(entry.before)} → ${formatValue(entry.after)}`} />
          ))}
      </Stack>
    </Section>
  )
}
