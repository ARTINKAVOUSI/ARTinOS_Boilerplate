import type { ArtinosRuntime } from '@artinos/runtime'

export interface ExternalSignalMessage { address?: string; id?: string; value: unknown; timestamp?: number; metadata?: Record<string, unknown> }
export interface ExternalConnection { id: string; protocol: 'osc-websocket' | 'websocket' | 'eventsource'; url: string; state: 'connecting' | 'open' | 'closed' | 'error'; disconnect(): void }

/** Owns network input lifecycles and publishes normalized semantic signals. */
export class ExternalSignalManager {
  private connections = new Map<string, ExternalConnection>()
  constructor(private runtime: ArtinosRuntime) {}
  connect(url: string, protocol: ExternalConnection['protocol'] = 'websocket', id = `external-${Date.now().toString(36)}`): ExternalConnection {
    this.disconnect(id)
    let source: WebSocket | EventSource
    const record: ExternalConnection = { id, protocol, url, state: 'connecting', disconnect: () => this.disconnect(id) }
    const receive = (raw: string) => {
      try {
        const payload = JSON.parse(raw) as ExternalSignalMessage | ExternalSignalMessage[]
        for (const message of Array.isArray(payload) ? payload : [payload]) {
          const name = String(message.address ?? message.id ?? 'value').replace(/^\/+/, '').replace(/\//g, '.')
          const prefix = protocol === 'osc-websocket' ? 'osc' : 'network'
          this.runtime.signals.set(`${prefix}.${name}`, message.value, { ...message.metadata, connection: id, protocol, timestamp: message.timestamp })
        }
      } catch (error) { this.runtime.logger.warn(`Ignored malformed external signal from ${id}`, { source: 'input', data: error }) }
    }
    if (protocol === 'eventsource') { source = new EventSource(url); source.onopen = () => { record.state = 'open' }; source.onmessage = event => receive(event.data); source.onerror = () => { record.state = 'error' } }
    else { source = new WebSocket(url); source.onopen = () => { record.state = 'open' }; source.onmessage = event => receive(String(event.data)); source.onerror = () => { record.state = 'error' }; source.onclose = () => { record.state = 'closed' } }
    ;(record as ExternalConnection & { source: WebSocket | EventSource }).source = source
    this.connections.set(id, record)
    return record
  }
  list(): ExternalConnection[] { return [...this.connections.values()] }
  disconnect(id: string): boolean { const record = this.connections.get(id) as (ExternalConnection & { source?: WebSocket | EventSource }) | undefined; if (!record) return false; record.source?.close(); record.state = 'closed'; this.connections.delete(id); return true }
  dispose(): void { for (const id of [...this.connections.keys()]) this.disconnect(id) }
}
