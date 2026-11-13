import { spans } from './rab'
import { isTajam } from '../store'
import { Sym, C_EKS, colorOf, statusOf, equipSym, tiangSym, lineSymOf } from './symbols'

export const RIGHT = 890, WARN = '#FF8A00', BOX_W = 104, MX = 120, MY = 120
export const tiangCode = (p) => {
  const m = /Tiang (Beton|Besi) (\d+)M-(\d+)/i.exec(p.jenisTiang || '')
  return m ? `1${/besi/i.test(m[1]) ? 'S' : 'C'}${m[2]}-${m[3]}` : ''
}
export const boxLines = (p) => {
  const l = []
  if ((p.jenisTitik || 'Tiang') === 'Tiang' && tiangCode(p)) l.push(tiangCode(p))
  const k = p.kodeManual || p.kode
  if (k) l.push(`1${k}`)
  if (p.peralatan) l.push(p.peralatan.length > 15 ? p.peralatan.slice(0, 14) + '…' : p.peralatan)
  return l
}
// Ringkasan Pasang / Bongkar per kode (urut kemunculan), seperti tabel "Bongkar Pasang Konstruksi" pada contoh Excel
export const ringkasPasang = (p) => {
  const hitung = (daftar) => { const m = new Map(); daftar.forEach(([k, sat]) => { if (!k) return; const e = m.get(k) || { kode: k, sat, vol: 0 }; e.vol++; m.set(k, e) }); return [...m.values()] }
  const pts = p.points
  const pasang = [
    ...hitung(pts.filter((x) => (x.jenisTitik || 'Tiang') === 'Tiang').map((x) => [tiangCode(x).replace(/^1/, ''), 'Btg'])),
    ...hitung(pts.map((x) => [x.kodeManual || x.kode, 'Unit'])),
  ]
  return { pasang, bongkar: hitung(pts.map((x) => [x.konsBongkar, 'Unit'])) }
}
export const shortKond = (s = '') => s.split(' ')[0]
const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l } }
const rot = (v, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c } }
const readable = (deg) => { let a = ((deg % 360) + 360) % 360; if (a > 180) a -= 360; if (a > 90) a -= 180; if (a <= -90) a += 180; return a }

// Posisi titik pada gambar mengikuti koordinat asli (utara di atas), diskalakan agar muat di lembar.
export function layoutJalur(pts) {
  if (!pts.length) return { P: [], H: 905, s: 1 }
  const lat0 = pts[0].lat, lng0 = pts[0].lng, kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574
  const m = pts.map((q) => ({ x: (q.lng - lng0) * kx, y: -(q.lat - lat0) * ky }))
  const xs = m.map((q) => q.x), ys = m.map((q) => q.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1)
  const availW = RIGHT - 10 - 2 * MX, HMAX = 1900
  const sc = Math.min(availW / spanX, (HMAX - 2 * MY) / spanY)
  const H = Math.max(905, spanY * sc + 2 * MY)
  const ox = MX + (availW - spanX * sc) / 2 - minX * sc
  const oy = MY + (H - 2 * MY - spanY * sc) / 2 - minY * sc
  return { P: m.map((q) => ({ x: ox + q.x * sc, y: oy + q.y * sc })), H, s: sc }
}

// Letakkan kotak keterangan di sisi yang tidak menabrak garis, titik, atau kotak lain.
export function letakKotak(P, boxH) {
  const placed = [], out = []
  const segs = []
  for (let i = 0; i < P.length - 1; i++) segs.push([P[i], P[i + 1]])
  const obst = P.map((q) => ({ ...q, r: 20 }))
  for (const [a, b] of segs) obst.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: 34 })
  const hit = (r, q, rad) => q.x > r.x - rad && q.x < r.x + r.w + rad && q.y > r.y - rad && q.y < r.y + r.h + rad
  for (let i = 0; i < P.length; i++) {
    const a = P[i - 1] || P[i], b = P[i + 1] || P[i]
    let d1 = unit(P[i].x - a.x, P[i].y - a.y), d2 = unit(b.x - P[i].x, b.y - P[i].y)
    if (P.length === 1) d1 = d2 = { x: 1, y: 0 }
    if (i === 0) d1 = d2
    if (i === P.length - 1) d2 = d1
    let dir = unit(d1.x + d2.x, d1.y + d2.y); if (Math.hypot(d1.x + d2.x, d1.y + d2.y) < 0.2) dir = d1
    const n = { x: -dir.y, y: dir.x }
    const n0 = n.y >= 0 ? n : { x: -n.x, y: -n.y }  // utamakan sisi bawah
    const cand = []
    for (const d0 of [16, 34, 58]) for (const u of [n0, { x: -n0.x, y: -n0.y }, rot(n0, 45), rot(n0, -45), rot({ x: -n0.x, y: -n0.y }, 45), rot({ x: -n0.x, y: -n0.y }, -45), rot(n0, 90), rot(n0, -90)]) cand.push({ u, d: d0 + Math.abs(u.x) * BOX_W / 2 + Math.abs(u.y) * boxH(i) / 2 })
    let best = null
    for (const c of cand) {
      const cx = P[i].x + c.u.x * c.d, cy = P[i].y + c.u.y * c.d
      const r = { x: cx - BOX_W / 2, y: cy - boxH(i) / 2, w: BOX_W, h: boxH(i) }
      let cost = 0
      if (r.x < 8 || r.x + r.w > RIGHT - 18 || r.y < 80) cost += 50
      for (const o of placed) if (r.x < o.x + o.w + 6 && r.x + r.w + 6 > o.x && r.y < o.y + o.h + 6 && r.y + r.h + 6 > o.y) cost += 100
      for (let j = 0; j < obst.length; j++) if (!(j === i) && hit(r, obst[j], obst[j].r)) cost += 60
      for (const [a2, b2] of segs) { const len = Math.hypot(b2.x - a2.x, b2.y - a2.y), nS = Math.max(2, Math.ceil(len / 6)); for (let k = 0; k <= nS; k++) { const t = k / nS; if (hit(r, { x: a2.x + (b2.x - a2.x) * t, y: a2.y + (b2.y - a2.y) * t }, 3)) { cost += 40; break } } }
      cost += c.d * 0.05
      if (!best || cost < best.cost) best = { cost, cx, cy, r, u: c.u }
      if (cost < 3) break
    }
    placed.push(best.r); out.push({ x: best.r.x, y: best.r.y, cx: best.cx, cy: best.cy, u: best.u })
  }
  return out
}


// Hitung seluruh tata letak gambar dari titik tagging (dipakai halaman Gambar dan pratinjau di halaman Peta)
export function buatSkema(p) {
  const pts = p.points
  const lay = layoutJalur(pts), P = lay.P
  const boxH = (i) => 24 + Math.max(1, boxLines(pts[i]).length) * 14
  const box = letakKotak(P, boxH)
  const dekat = pts.map((_, i) => (i > 0 && Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y) < 46 ? pts[i].nomor || `T${i + 1}` : null)).filter(Boolean)
  const place = (c) => {
    let best = null
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]
      const den = (b.lng - a.lng) ** 2 + (b.lat - a.lat) ** 2 || 1
      const t = Math.max(0, Math.min(1, ((c.lng - a.lng) * (b.lng - a.lng) + (c.lat - a.lat) * (b.lat - a.lat)) / den))
      const d = Math.hypot(a.lng + t * (b.lng - a.lng) - c.lng, a.lat + t * (b.lat - a.lat) - c.lat)
      if (!best || d < best.d) best = { d, i: i - 1, t }
    }
    if (!best) return null
    const A = P[best.i], B = P[best.i + 1]
    return { x: A.x + best.t * (B.x - A.x), y: A.y + best.t * (B.y - A.y), ang: (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI }
  }
  return { pts, P, H: lay.H, box, boxH, dekat, sp: spans(pts), place }
}

// Isi gambar (penyeberangan + jalur + titik). onDown: seret kotak (halaman Gambar); onSelect/selId: sinkron dengan peta.
export function SkemaIsi({ p, sk, onDown, onSelect, selId }) {
  const { pts, P, box, boxH, sp, place } = sk
  return (
    <>
              {/* penyeberangan */}
              {p.crossings.filter((c) => c.type === 'Sungai').map((c) => {
                const pos = place(c); if (!pos) return null
                const R = (lx, ly) => { const r = (pos.ang * Math.PI) / 180; return { x: pos.x + lx * Math.cos(r) - ly * Math.sin(r), y: pos.y + lx * Math.sin(r) + ly * Math.cos(r) } }
                if (c.type === 'SUTT') {
                  const t = R(-50, -78), h = R(100, -4)
                  return (
                    <g key={c.id}>
                      <g transform={`translate(${pos.x},${pos.y}) rotate(${pos.ang})`}>
                        {[-18, 0, 18].map((o) => <line key={o} x1={-55 + o} y1={-70} x2={55 + o} y2={70} stroke="#1D6FD6" strokeWidth="2.5" />)}
                        {c.tinggi && <path d="M78 -60 q8 0 8 8 v36 q0 6 8 6 q-8 0 -8 6 v36 q0 8 -8 8" fill="none" stroke="#1D6FD6" />}
                      </g>
                      <text x={t.x} y={t.y} fontSize="16" fill="#1D6FD6" textAnchor="middle">{c.label || 'SUTT'}</text>
                      {c.tinggi && <text x={h.x} y={h.y} fontSize="14" fill="#1D6FD6">{c.tinggi} m</text>}
                    </g>
                  )
                }
                const lab = R(0, -128)
                return (
                  <g key={c.id}>
                    <rect x={-14} y={-115} width="28" height="230" fill={c.type === 'Sungai' ? '#9fd4ee' : '#a6a6a6'} transform={`translate(${pos.x},${pos.y}) rotate(${pos.ang})`} />
                    <text x={lab.x} y={lab.y} textAnchor="middle" fontSize="12" fill="#444">{c.label || c.type}</text>
                  </g>
                )
              })}

              {/* jalur: mengikuti posisi asli titik di peta */}
              {pts.map((pt, i) => {
                const next = pts[i + 1]
                if (next) {
                  const A = P[i], B = P[i + 1], mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2
                  const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI, ra = readable(ang)
                  const len = Math.hypot(B.x - A.x, B.y - A.y)
                  const warn = isTajam(p, next) || isTajam(p, pt)
                  const c = warn ? WARN : colorOf(next.kondisi), ls = lineSymOf(next.konduktor)
                  return (
                    <g key={'s' + i}>
                      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={c} strokeWidth={warn ? 4 : ls === 'jtr3' ? 3.4 : ls === 'jtr1' ? 1.8 : 2.4} strokeDasharray={next.kondisi === 'Bongkar' ? '2 6' : ls === 'jtm1' ? '8 5' : ''} />
                      <g transform={`translate(${mx},${my}) rotate(${ra})`}>
                        {(ls === 'jtr1' || ls === 'jtr3') && len > 60 && [-14, 0, 14].map((o) => <line key={o} x1={o - 3} y1={5} x2={o + 3} y2={-5} stroke={c} strokeWidth="1.5" />)}
                        {len > 70 && <><text x="0" y="-14" textAnchor="middle" fontSize="14" fill={c}>{shortKond(next.konduktor)}</text>
                        <text x="0" y="24" textAnchor="middle" fontSize="15" fill={c}>{sp[i]} m</text></>}
                        {len <= 70 && <text x="0" y="-10" textAnchor="middle" fontSize="12" fill={c}>{sp[i]} m</text>}
                      </g>
                    </g>
                  )
                }
                // ujung jalur: panah searah segmen terakhir
                const prev = P[i - 1] || { x: P[i].x - 1, y: P[i].y }
                const ang = (Math.atan2(P[i].y - prev.y, P[i].x - prev.x) * 180) / Math.PI
                return <polygon key={'a' + i} points="14,-5 34,0 14,5" fill={colorOf(pt.kondisi)} transform={`translate(${P[i].x},${P[i].y}) rotate(${ang})`} />
              })}

              {/* titik + kotak keterangan */}
              {pts.map((pt, i) => {
                const x = P[i].x, y = P[i].y, c = colorOf(pt.kondisi), st = statusOf(pt.kondisi), eq = equipSym(pt)
                const lines = boxLines(pt), lb = p.labelPos[pt.id] || { dx: 0, dy: 0 }
                const bh = boxH(i), bx = box[i].x + lb.dx, by = box[i].y + lb.dy
                const ex = x - box[i].u.x * 26, ey = y - box[i].u.y * 26
                return (
                  <g key={pt.id}>
                    {selId === pt.id && <circle cx={x} cy={y} r="20" fill="none" stroke="#FFC400" strokeWidth="4" />}
                    <Sym t={tiangSym(pt)} s={st} x={x} y={y} k={1.3} />
                    {onSelect && <circle cx={x} cy={y} r="22" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onSelect(pt.id)} />}
                    {eq && <Sym t={eq} s={st} x={ex} y={ey} k={1.2} />}
                    <line x1={x} y1={y} x2={bx + BOX_W / 2} y2={by + bh / 2} stroke={c} strokeWidth="0.8" />
                    <g transform={`translate(${bx},${by})`} className={onDown ? 'drag' : ''} onPointerDown={onDown ? (e) => onDown(e, pt.id) : undefined} onClick={onSelect ? () => onSelect(pt.id) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
                      <rect width={BOX_W} height={bh} fill="#fff" stroke={c} strokeWidth="1.2" />
                      <text x={BOX_W / 2} y="15" textAnchor="middle" fontSize="12.5" fontWeight="700" fill={c}>{pt.nomor || `T${i + 1}`}</text>
                      <line x1="0" y1="21" x2={BOX_W} y2="21" stroke={c} strokeWidth="0.8" />
                      {lines.map((t, k) => <text key={k} x={BOX_W / 2} y={34 + k * 14} textAnchor="middle" fontSize="12" fill={c}>{t}</text>)}
                    </g>
                  </g>
                )
              })}

    </>
  )
}