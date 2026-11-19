// Pembungkus pemanggilan API. NEXT_PUBLIC_DATA_MODE=mock (bawaan) memakai server tiruan di browser;
// ubah ke "live" setelah route handler Next.js + PostgreSQL tersedia.
import { mockCall } from './mockServer'

export const MOCK = (process.env.NEXT_PUBLIC_DATA_MODE || 'mock') === 'mock'

async function call(method, path, body, opts = {}) {
  if (MOCK) return mockCall(method, path, body, opts)
  const headers = { ...(opts.headers || {}) }
  let payload = body
  if (body && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const r = await fetch(path, { method, headers, body: payload, signal: AbortSignal.timeout(opts.timeout || 12000) })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status, data: j })
  }
  return r.status === 204 ? null : r.json()
}
export const api = {
  get: (p, o) => call('GET', p, null, o),
  put: (p, b, o) => call('PUT', p, b, o),
  post: (p, b, o) => call('POST', p, b, o),
  del: (p, o) => call('DELETE', p, null, o),
}
