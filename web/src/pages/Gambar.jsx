import { useRef } from 'react'
import { useApp, isTajam } from '../store'
import { Icon } from '../components/ui'
import Empty from './Empty'
import { Sym, LEGEND, C_BARU, C_EKS } from '../lib/symbols'
import { RIGHT, buatSkema } from '../lib/skema'
import { GambarSvg } from '../lib/gambarSvg'
import { gambarPng } from '../lib/gambarPng'

// F4 + F5 — gambar skematik mengikuti sheet GAMBAR di Excel (merah = baru, ungu tua = eksisting)
function Inner({ go }) {
  const { active: p, update } = useApp()
  const pts = p.points
  const sk = buatSkema(p)
  const VW = RIGHT - 10, dekat = sk.dekat
  const svgRef = useRef(null), drag = useRef(null)

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

  const pasang = pts.filter((x) => x.kodeManual || x.kode)
  const bongkar = pts.filter((x) => x.konsBongkar)
  const unduhPng = async () => {
    const a = document.createElement('a'); a.download = `Gambar_${p.nomor}.png`; a.href = await gambarPng(p); a.click()
  }
  return (
    <>
      <div className="pg-h">
        <h1>Gambar Skematik</h1>
        <div className="actions">
          <button className="btn ghost" onClick={() => update(p.id, (x) => ({ ...x, labelPos: {} }))}>Atur ulang otomatis</button>
          <button className="btn ghost" onClick={unduhPng}><Icon n="download" size={16} /> Unduh PNG</button>
          <button className="btn" onClick={() => go('rab')}>Lanjut ke RAB <Icon n="chevR" size={16} /></button>
        </div>
        <p>Format lembar mengikuti sheet GAMBAR pada Excel. Bentuk jalur mengikuti titik di peta (utara di atas). Seret kotak konstruksi untuk menggeser manual; bagian yang sudah digeser tidak ikut berubah.</p>
      </div>
      {pts.some((x) => isTajam(p, x)) && <div className="warn"><Icon n="x" size={16} /><span>Ada sudut belokan terlalu tajam ({pts.filter((x) => isTajam(p, x)).map((x) => x.nomor).join(', ')}). Garis jalur diberi warna oranye; periksa kode konstruksi atau posisi titik.</span></div>}
      {dekat.length > 0 && <div className="warn"><Icon n="x" size={16} /><span>Titik {dekat.join(', ')} sangat berdekatan dengan titik sebelumnya di gambar. Kotak keterangannya bisa digeser manual.</span></div>}
      <div className="gsheet2">
        <div className="gdraw">
          {pts.length < 2 && <p className="empty" style={{ padding: 12 }}>Tandai minimal 2 titik di halaman Peta &amp; Tagging untuk membuat gambar.</p>}
          <div className="scroll-x">
            <GambarSvg p={p} sk={sk} svgRef={svgRef} onDown={onDown} onMove={onMove} onUp={onUp} />
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
