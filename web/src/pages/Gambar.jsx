import { useRef } from 'react'
import { useApp, isTajam } from '../store'
import { spans } from '../lib/rab'
import { Icon } from '../components/ui'
import { exportExcel } from '../lib/exportExcel'
import { Sym, LEGEND, C_BARU, C_EKS, colorOf, statusOf, symOfPoint, tiangSym, equipSym, lineSymOf } from '../lib/symbols'

const PER_ROW = 6, STEP = 125, X0 = 80, RIGHT = 890, WARN = '#FF8A00'
const tiangCode = (p) => {
  const m = /Tiang (Beton|Besi) (\d+)M-(\d+)/i.exec(p.jenisTiang || '')
  return m ? `1${/besi/i.test(m[1]) ? 'S' : 'C'}${m[2]}-${m[3]}` : ''
}
const boxLines = (p) => {
  const l = []
  if ((p.jenisTitik || 'Tiang') === 'Tiang' && tiangCode(p)) l.push(tiangCode(p))
  const k = p.kodeManual || p.kode
  if (k) l.push(`1${k}`)
  if (p.peralatan) l.push(p.peralatan.length > 15 ? p.peralatan.slice(0, 14) + '…' : p.peralatan)
  return l
}
const shortKond = (s = '') => s.split(' ')[0]

// F4 + F5 — gambar skematik mengikuti sheet GAMBAR di Excel (merah = baru, ungu tua = eksisting)
function Inner({ go }) {
  const { active: p, update } = useApp()
  const pts = p.points
  const sp = spans(pts)
  const rows = Math.max(1, Math.ceil(pts.length / PER_ROW))
  const W = 1280, VW = RIGHT - 10, H = Math.max(905, 150 + rows * 300 + 60)
  const svgRef = useRef(null), drag = useRef(null)
  const rowTop = (r) => 90 + r * 300
  const px = (i) => X0 + (i % PER_ROW) * STEP
  const py = (i) => rowTop(Math.floor(i / PER_ROW)) + 120

  const onDown = (e, id) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const sc = svgRef.current.getBoundingClientRect().width / VW
    const cur = p.labelPos[id] || { dx: 0, dy: 0 }
    drag.current = { id, sc, sx: e.clientX, sy: e.clientY, dx: cur.dx, dy: cur.dy }
  }
  const onMove = (e) => {
    const d = drag.current; if (!d) return
    update(p.id, (x) => ({ ...x, labelPos: { ...x.labelPos, [d.id]: { dx: d.dx + (e.clientX - d.sx) / d.sc, dy: d.dy + (e.clientY - d.sy) / d.sc } } }))
  }
  const onUp = () => { drag.current = null }
  const setMeta = (k) => (e) => update(p.id, (x) => ({ ...x, meta: { ...x.meta, [k]: e.target.value } }))

  // posisi penyeberangan (jalan/SUTT/sungai) di sepanjang jalur
  const place = (c) => {
    let best = null
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]
      const den = (b.lng - a.lng) ** 2 + (b.lat - a.lat) ** 2 || 1
      const t = Math.max(0, Math.min(1, ((c.lng - a.lng) * (b.lng - a.lng) + (c.lat - a.lat) * (b.lat - a.lat)) / den))
      const d = Math.hypot(a.lng + t * (b.lng - a.lng) - c.lng, a.lat + t * (b.lat - a.lat) - c.lat)
      if (!best || d < best.d) best = { d, i: i - 1, t }
    }
    if (!best || Math.floor(best.i / PER_ROW) !== Math.floor((best.i + 1) / PER_ROW)) return null
    return { x: px(best.i) + best.t * STEP, y: py(best.i), row: Math.floor(best.i / PER_ROW) }
  }

  const pasang = pts.filter((x) => x.kodeManual || x.kode)
  const bongkar = pts.filter((x) => x.konsBongkar)
  const bRows = Math.max(12, pts.length)
  const bY = 345, bBottom = Math.min(bY + 24 + bRows * 16, H - 215)
  const nRows = Math.floor((bBottom - bY - 24) / 16)

  const unduhPng = async () => {
    const toData = async (u) => { const r = await fetch(u); const b = await r.blob(); return new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b) }) }
    let s = new XMLSerializer().serializeToString(svgRef.current).replace(`viewBox="0 0 ${VW} ${H}"`, `viewBox="0 0 ${W} ${H}"`)
    for (const u of ['/logo-pln.png', '/kompas.jpg']) s = s.split(u).join(await toData(u))
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height)
      const a = document.createElement('a'); a.download = `Gambar_${p.nomor}.png`; a.href = c.toDataURL('image/png'); a.click()
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)
  }

  const first = pts[0]
  return (
    <>
      <div className="pg-h">
        <h1>Gambar Skematik</h1>
        <div className="actions">
          <button className="btn ghost" onClick={() => update(p.id, (x) => ({ ...x, labelPos: {} }))}>Atur ulang otomatis</button>
          <button className="btn ghost" onClick={unduhPng}><Icon n="download" size={16} /> Unduh PNG</button>
          <button className="btn" onClick={() => go('rab')}>Lanjut ke RAB <Icon n="chevR" size={16} /></button>
        </div>
        <p>Format lembar mengikuti sheet GAMBAR pada Excel. Seret kotak konstruksi untuk menggeser manual; bagian yang sudah digeser tidak ikut berubah.</p>
      </div>
      {pts.some((x) => isTajam(p, x)) && <div className="warn"><Icon n="x" size={16} /><span>Ada sudut belokan terlalu tajam ({pts.filter((x) => isTajam(p, x)).map((x) => x.nomor).join(', ')}). Garis jalur diberi warna oranye; periksa kode konstruksi atau posisi titik.</span></div>}
      <div className="gsheet2">
        <div className="gdraw">
          {pts.length < 2 && <p className="empty" style={{ padding: 12 }}>Tandai minimal 2 titik di halaman Peta &amp; Tagging untuk membuat gambar.</p>}
          <div className="scroll-x">
            <svg ref={svgRef} viewBox={`0 0 ${VW} ${H}`} style={{ width: '100%', minWidth: 640, display: 'block' }} fontFamily="Calibri, Arial, sans-serif" onPointerMove={onMove} onPointerUp={onUp}>
              <rect width={W} height={H} fill="#fff" />
              <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke="#222" strokeWidth="1.5" />
              <image href="/kompas.jpg" x="10" y="10" width="62" height="64" />
              {first && <text x="440" y="36" textAnchor="middle" fontSize="19">KOORDINAT {first.lat.toFixed(6)}, {first.lng.toFixed(6)}</text>}

              {/* penyeberangan */}
              {p.crossings.map((c) => {
                const pos = place(c); if (!pos) return null
                const top = rowTop(pos.row) + 20
                if (c.type === 'SUTT') return (
                  <g key={c.id}>
                    {[-18, 0, 18].map((o) => <line key={o} x1={pos.x - 55 + o} y1={pos.y - 70} x2={pos.x + 55 + o} y2={pos.y + 70} stroke="#1D6FD6" strokeWidth="2.5" />)}
                    <text x={pos.x - 50} y={pos.y - 78} fontSize="16" fill="#1D6FD6" transform={`rotate(-40 ${pos.x - 50} ${pos.y - 78})`}>{c.label || 'SUTT'}</text>
                    {c.tinggi && <g><path d={`M${pos.x + 78} ${pos.y - 60} q8 0 8 8 v36 q0 6 8 6 q-8 0 -8 6 v36 q0 8 -8 8`} fill="none" stroke="#1D6FD6" /><text x={pos.x + 100} y={pos.y - 4} fontSize="14" fill="#1D6FD6">{c.tinggi} m</text></g>}
                  </g>
                )
                return (
                  <g key={c.id}>
                    <rect x={pos.x - 14} y={top} width="28" height="230" fill={c.type === 'Sungai' ? '#9fd4ee' : '#a6a6a6'} />
                    <text x={pos.x} y={top - 6} textAnchor="middle" fontSize="12" fill="#444">{c.label || c.type}</text>
                  </g>
                )
              })}

              {/* jalur */}
              {pts.map((pt, i) => {
                const x = px(i), y = py(i), next = pts[i + 1]
                const lastInRow = i % PER_ROW === PER_ROW - 1
                const out = []
                if (next && !lastInRow) {
                  const warn = isTajam(p, next) || isTajam(p, pt)
                  const c = warn ? WARN : colorOf(next.kondisi), ls = lineSymOf(next.konduktor)
                  out.push(
                    <g key={'s' + i}>
                      <line x1={x} y1={y} x2={px(i + 1)} y2={y} stroke={c} strokeWidth={warn ? 4 : ls === 'jtr3' ? 3.4 : ls === 'jtr1' ? 1.8 : 2.4} strokeDasharray={next.kondisi === 'Bongkar' ? '2 6' : ls === 'jtm1' ? '8 5' : ''} />
                      {(ls === 'jtr1' || ls === 'jtr3') && [-14, 0, 14].map((o) => <line key={o} x1={(x + px(i + 1)) / 2 + o - 3} y1={y + 5} x2={(x + px(i + 1)) / 2 + o + 3} y2={y - 5} stroke={c} strokeWidth="1.5" />)}
                      <text x={(x + px(i + 1)) / 2} y={y - 14} textAnchor="middle" fontSize="14" fill={c}>{shortKond(next.konduktor)}</text>
                      <text x={(x + px(i + 1)) / 2} y={y + 24} textAnchor="middle" fontSize="15" fill={c}>{sp[i]} m</text>
                    </g>
                  )
                } else if (next && lastInRow) {
                  out.push(<text key={'n' + i} x={x + 24} y={y + 5} fontSize="13" fill={C_EKS}>bersambung ke {next.nomor || `T${i + 2}`} ↓</text>)
                } else {
                  out.push(<polygon key={'a' + i} points={`${x + 14},${y - 5} ${x + 34},${y} ${x + 14},${y + 5}`} fill={colorOf(pt.kondisi)} />)
                }
                return out
              })}

              {/* titik + kotak keterangan */}
              {pts.map((pt, i) => {
                const x = px(i), y = py(i), c = colorOf(pt.kondisi), st = statusOf(pt.kondisi), eq = equipSym(pt)
                const lines = boxLines(pt), lb = p.labelPos[pt.id] || { dx: 0, dy: 0 }
                const bh = 24 + lines.length * 14, bx = x - 52 + lb.dx, by = y + 40 + lb.dy
                                return (
                  <g key={pt.id}>
                    <Sym t={tiangSym(pt)} s={st} x={x} y={y} k={1.3} />
                    {eq && <Sym t={eq} s={st} x={x} y={y - 26} k={1.2} />}
                    <line x1={x} y1={y + 10} x2={bx + 52} y2={by} stroke={c} strokeWidth="0.8" />
                    <g transform={`translate(${bx},${by})`} className="drag" onPointerDown={(e) => onDown(e, pt.id)}>
                      <rect width="104" height={bh} fill="#fff" stroke={c} strokeWidth="1.2" />
                      <text x="52" y="15" textAnchor="middle" fontSize="12.5" fontWeight="700" fill={c}>{pt.nomor || `T${i + 1}`}</text>
                      <line x1="0" y1="21" x2="104" y2="21" stroke={c} strokeWidth="0.8" />
                      {lines.map((t, k) => <text key={k} x="52" y={34 + k * 14} textAnchor="middle" fontSize="12" fill={c}>{t}</text>)}
                    </g>
                  </g>
                )
              })}

              {/* panel kanan: di luar viewBox layar, hanya ikut saat Unduh PNG */}
              <g fontSize="12" fill="#111">
                <rect x={RIGHT} y="12" width="380" height="30" fill="#fff" stroke="#222" />
                <image href="/logo-pln.png" x={RIGHT + 6} y="15" width="20" height="24" />
                <text x={RIGHT + 190} y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0B6AA6">PT. PLN (PERSERO) UP3 KLATEN</text>
                <text x={RIGHT + 4} y="58" fontWeight="700">Keterangan Gambar :</text>
                <rect x={RIGHT} y="62" width="380" height="20" fill="#E8F3FA" stroke="#222" />
                {[['No', 18], ['Nama Material', 120], ['Baru', 252], ['Eksisting', 326]].map(([t, x]) => <text key={t} x={RIGHT + x} y="76" textAnchor="middle">{t}</text>)}
                {LEGEND.map(([nama, t], i) => (
                  <g key={t} transform={`translate(${RIGHT},${82 + i * 19})`}>
                    <rect width="380" height="19" fill="#fff" stroke="#222" strokeWidth="0.7" />
                    <text x="18" y="13" textAnchor="middle">{i + 1}</text><text x="120" y="13" textAnchor="middle">{nama}</text>
                    <Sym t={t} s="baru" x={252} y={9.5} k={0.8} /><Sym t={t} s="eksisting" x={326} y={9.5} k={0.8} />
                  </g>
                ))}
                <text x={RIGHT + 4} y={bY - 6} fontWeight="700">Bongkar Pasang Konstruksi :</text>
                <rect x={RIGHT} y={bY} width="380" height="20" fill="#fff" stroke="#222" />
                <text x={RIGHT + 95} y={bY + 14} textAnchor="middle" fontWeight="700" fill={C_BARU}>Pasang</text>
                <text x={RIGHT + 285} y={bY + 14} textAnchor="middle" fontWeight="700" fill={C_EKS}>Bongkar</text>
                {Array.from({ length: nRows }).map((_, i) => {
                  const a = pasang[i], b = bongkar[i]
                  return (
                    <g key={i} transform={`translate(${RIGHT},${bY + 20 + i * 16})`}>
                      <rect width="380" height="16" fill="#fff" stroke="#222" strokeWidth="0.6" />
                      <line x1="190" x2="190" y2="16" stroke="#222" strokeWidth="0.8" />
                      {a && <><text x="8" y="12" fontSize="11" fill={C_BARU}>{a.nomor}</text><text x="100" y="12" fontSize="11" fill={C_BARU}>{a.kodeManual || a.kode}</text></>}
                      {b && <><text x="198" y="12" fontSize="11" fill={C_EKS}>{b.nomor}</text><text x="290" y="12" fontSize="11" fill={C_EKS}>{b.konsBongkar}</text></>}
                    </g>
                  )
                })}
                <text x={RIGHT + 4} y={H - 193} fontWeight="700">Keterangan Tambahan:</text>
                <rect x={RIGHT} y={H - 188} width="380" height="34" fill="#fff" stroke="#222" />
                <text x={RIGHT + 6} y={H - 170} fontSize="11">{p.meta.keterangan || ''}</text>
                <g transform={`translate(${RIGHT},${H - 150})`}>
                  <rect width="380" height="20" fill="#fff" stroke="#222" />
                  <text x="30" y="14">No. Gambar</text><text x="120" y="14">{p.meta.noGambar}</text><text x="240" y="14">Skala</text><text x="290" y="14">{p.meta.skala}</text>
                  <rect y="20" width="380" height="20" fill="#fff" stroke="#222" /><text x="190" y="34" textAnchor="middle">Perihal: {p.meta.perihal}</text>
                  <rect y="40" width="380" height="42" fill="#fff" stroke="#222" />
                  <text x="190" y="66" textAnchor="middle" fontWeight="700" fill="#0B6AA6">{(p.jenis === 'Tambah Daya' ? 'TD ' : 'PB ') + (p.daya ? Math.round(p.daya / 1000 * 10) / 10 + ' KVA ' : '') + p.nama.toUpperCase()}</text>
                  {[['Digambar', 'digambar'], ['Diperiksa', 'diperiksa'], ['Diketahui', 'diketahui'], ['Disetujui', 'disetujui']].map(([l, k], i) => (
                    <g key={k} transform={`translate(0,${82 + i * 16})`}>
                      <rect width="380" height="16" fill="#fff" stroke="#222" strokeWidth="0.6" />
                      <text x="100" y="12" fontSize="11" textAnchor="end">{l}</text><text x="115" y="12" fontSize="11">{p.meta[k]}</text>
                    </g>
                  ))}
                </g>
              </g>
            </svg>
          </div>
        </div>
        <aside className="gpanel">
          <div className="gp-t">PT. PLN ( PERSERO ) {p.meta.ulp ? p.meta.ulp.toUpperCase() : 'UP3 KLATEN'}</div>
          <div className="gp-h">Keterangan Gambar :</div>
          <table className="lg"><thead><tr><th style={{ width: 34 }}>No</th><th>Nama Material</th><th style={{ width: 62 }}>Baru</th><th style={{ width: 62 }}>Eksisting</th></tr></thead>
            <tbody>{LEGEND.map(([nama, t], i) => (
              <tr key={t}><td>{i + 1}</td><td>{nama}</td>
                <td><svg width="46" height="18" viewBox="-23 -9 46 18"><Sym t={t} s="baru" x={0} y={0} k={0.8} /></svg></td>
                <td><svg width="46" height="18" viewBox="-23 -9 46 18"><Sym t={t} s="eksisting" x={0} y={0} k={0.8} /></svg></td></tr>
            ))}</tbody></table>
          <div className="gp-h">Bongkar Pasang Konstruksi :</div>
          <table className="lg"><thead><tr><th colSpan={2} style={{ color: C_BARU }}>Pasang</th><th colSpan={2} style={{ color: C_EKS }}>Bongkar</th></tr></thead>
            <tbody>{Array.from({ length: Math.max(8, pasang.length, bongkar.length) }).map((_, i) => {
              const a = pasang[i], b = bongkar[i]
              return <tr key={i}><td style={{ color: C_BARU }}>{a?.nomor}</td><td style={{ color: C_BARU }}>{a && (a.kodeManual || a.kode)}</td><td style={{ color: C_EKS }}>{b?.nomor}</td><td style={{ color: C_EKS }}>{b?.konsBongkar}</td></tr>
            })}</tbody></table>
          <div className="gp-h">Keterangan Tambahan:</div>
          <textarea id="gKet" rows={3} value={p.meta.keterangan || ''} onChange={setMeta('keterangan')} />
          <div className="gtb">
            <div><small>No. Gambar</small><input type="text" value={p.meta.noGambar} onChange={setMeta('noGambar')} /></div>
            <div><small>Skala</small><input type="text" value={p.meta.skala} onChange={setMeta('skala')} /></div>
            <div className="w"><small>Perihal</small><input type="text" value={p.meta.perihal} onChange={setMeta('perihal')} /></div>
            {[['Digambar', 'digambar'], ['Diperiksa', 'diperiksa'], ['Diketahui', 'diketahui'], ['Disetujui', 'disetujui']].map(([l, k]) => (
              <div key={k}><small>{l}</small><input type="text" value={p.meta[k]} placeholder="Nama" onChange={setMeta(k)} /></div>
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}

export default function Gambar({ go }) {
  const { active } = useApp()
  return active ? <Inner go={go} /> : <Empty go={go} judul="Gambar Skematik" />
}
