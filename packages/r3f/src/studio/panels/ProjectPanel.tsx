import { useRef, useState } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'
import { Button, Section, TextField } from '../foundation'
export function ProjectPanel() {
  const runtime = useArtinosRuntime(), fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('artinos-project.json'), [notice, setNotice] = useState('')
  const download = () => {
    const url = URL.createObjectURL(new Blob([runtime.persistence.export()], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name.trim().replace(/\.json$/i, '') + '.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice('Project JSON exported.')
  }
  return <div className="artinos-input-grid">
    {notice && <div className="artinos-panel-notice" role="status">{notice}</div>}
    <Section title="Local snapshot" description="Keep a copy of your parameters, bindings, automation and quality settings in this browser."><div className="artinos-button-row"><Button onClick={() => { const result = runtime.persistence.save(); setNotice(result ? 'Saved in this browser.' : 'Could not save. Browser storage may be full or unavailable.') }}>Save snapshot</Button><Button onClick={() => { const result = runtime.persistence.load(); setNotice(result ? 'Local snapshot restored.' : 'No valid local snapshot is available.') }}>Restore snapshot</Button></div></Section>
    <Section title="Import & export" description="Save a portable JSON file or restore a project from a file."><TextField label="File name" value={name} onChange={setName} /><div className="artinos-button-row"><Button disabled={!name.trim()} onClick={download}>Export JSON</Button><Button onClick={() => fileInput.current?.click()}>Import JSON</Button></div><p className="artinos-device-note">Import replaces the current project settings. Export a copy first if you want to keep them.</p><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { setNotice(runtime.persistence.import(await file.text()) ? `Imported ${file.name}.` : 'This file is not a valid ARTINOS project.') } catch { setNotice('Could not read this project file.') } }} /></Section>
  </div>
}
