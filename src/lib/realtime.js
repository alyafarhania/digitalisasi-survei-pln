// Real time antar tab/perangkat. Mode mock: BroadcastChannel (antar tab di browser yang sama).
// Saat backend siap, ganti isi file ini dengan EventSource('/api/events') — antarmukanya tetap sama.
const CH = 'pln-realtime'
export function createRealtime({ onChange, onStatus }) {
  let bc = null
  try { bc = new BroadcastChannel(CH); bc.onmessage = (e) => onChange?.(e.data) } catch { /* tidak didukung */ }
  onStatus?.(true)
  return {
    join() {}, leave() {},
    publish(msg) { try { bc?.postMessage(msg) } catch { /* abaikan */ } },
    close() { try { bc?.close() } catch { /* abaikan */ } },
  }
}
