import { useState, useRef, useEffect } from 'react'

const paths = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  map: 'M9 3 3 5v16l6-2 6 2 6-2V3l-6 2zM9 3v16m6-14v16',
  users: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  sheet: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.6-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 19h16',
  upload: 'M12 15V3m0 0L8 7m4-4 4 4M4 19h16',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  play: 'M7 4l13 8-13 8z',
  check: 'M5 12l5 5 9-10',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  nav: 'M3 11l18-8-8 18-2-8z',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  drag: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  menu: 'M4 6h16M4 12h16M4 18h16',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5',
  poles: 'M5 3v18M12 3v18M19 3v18M2 7h6M9 7h6M16 7h6M2 11h6M9 11h6M16 11h6',
  wifioff: 'M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-8-3.7M5 12.5a10 10 0 0 1 3-2M19 12.5a10 10 0 0 0-3.5-2.3M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18',
}
export const Icon = ({ n, size = 18, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={paths[n] || ''} />
  </svg>
)

export const Logo = ({ chip = true }) => (
  <div className={`logo ${chip ? 'box' : ''}`}>
    <img src="/logo-pln.png" alt="PLN" />
  </div>
)

// Dropdown dengan pencarian (F3: "Dropdown dengan pencarian")
export function Combo({ value, onChange, options, placeholder = 'Pilih...', disabled }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [])
  const opts = options.map((o) => (typeof o === 'string' ? { v: o, l: o } : o))
  const shown = opts.filter((o) => o.l.toLowerCase().includes(q.toLowerCase())).slice(0, 80)
  const cur = opts.find((o) => o.v === value)
  return (
    <div className="combo" ref={ref}>
      <button type="button" className="input combo-btn" disabled={disabled} onClick={() => { setOpen(!open); setQ('') }}>
        <span className={cur ? '' : 'muted'}>{cur ? cur.l : placeholder}</span>
        <Icon n="chevR" size={14} className="rot" />
      </button>
      {open && (
        <div className="combo-pop">
          <input autoFocus className="input" placeholder="Cari..." value={q} onChange={(e) => setQ(e.target.value)} />
          <ul>
            {value && <li className="muted" onClick={() => { onChange(''); setOpen(false) }}>— Kosongkan —</li>}
            {shown.map((o) => (
              <li key={o.v} className={o.v === value ? 'sel' : ''} onClick={() => { onChange(o.v); setOpen(false) }}>{o.l}</li>
            ))}
            {!shown.length && <li className="muted">Tidak ditemukan</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export const Field = ({ label, children, hint }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
)

export const Badge = ({ status }) => {
  const c = { Selesai: 'ok', 'Dalam Proses': 'warn', Draft: 'draft' }[status] || 'draft'
  return <span className={`badge ${c}`}>{status}</span>
}
