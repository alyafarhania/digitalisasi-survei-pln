// Pembungkus fetch ke API (satu origin: Vite/nginx mem-proxy /api ke server)
export const DEMO = !!import.meta.env.VITE_DEMO
// Mode pratinjau: tanpa server. Data master dibaca dari berkas statis, simpan/sinkron dijawab lokal.
async function demoCall(method, path, body) {
  if (path.startsWith('/api/master')) return (await fetch('./master.json')).json()
  if (path.startsWith('/api/health')) return { ok: true }
  if (method === 'PUT') return { version: ((body && body.baseVersion) || 0) + 1 }
  if (method === 'GET' && /^\/api\/proyek(\?|$)/.test(path)) return []
  if (method === 'GET' && /\/foto$/.test(path)) return []
  throw Object.assign(new Error('Pratinjau: fitur ini butuh server'), { status: 503 })
}
async function call(method, path, body, opts = {}) {
  if (DEMO) return demoCall(method, path, body)
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
