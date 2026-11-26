import Empty from './Empty'
import { useApp } from '../store'
import { hitungRab } from '../lib/rab'
import { fmtRp } from '../lib/geo'
import { Icon } from '../components/ui'

const Seg = ({ v, set, opts }) => <div className="seg">{opts.map(([k, l]) => <button key={k} className={v === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}</div>

// F6 Material dan RAB: format mengikuti sheet RAB di Excel (kolom MDU / Hardware / Jasa, SLO, PPN, terbilang)
function Inner({ go }) {
  const { active: p, update } = useApp()
  const r = hitungRab(p), opt = p.rabOpt
  const setOpt = (k, v) => update(p.id, (x) => ({ ...x, rabOpt: { ...x.rabOpt, [k]: v } }))
  const setPrice = (nama, v) => update(p.id, (x) => ({ ...x, priceEdits: { ...x.priceEdits, [nama]: v } }))
  const edits = Object.keys(p.priceEdits).filter((k) => p.priceEdits[k] !== '')
  const n = (v) => (v ? fmtRp(v) : '')

  return (
    <>
      <div className="pg-h">
        <h1>Material &amp; RAB</h1>
        <div className="actions">
          {edits.length > 0 && <button className="btn ghost" onClick={() => update(p.id, (x) => ({ ...x, priceEdits: {} }))}><Icon n="undo" size={16} /> Kembalikan {edits.length} harga</button>}
          <button className="btn" onClick={() => go('ekspor')}>Ekspor Excel <Icon n="chevR" size={16} /></button>
        </div>
        <p>Format mengikuti sheet RAB pada Excel. Item tanpa harga KHS 2024 dibiarkan kosong, RAB tetap bisa diekspor.</p>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-b grid g2 g3">
          <div className="fld"><label>Pilihan harga</label><Seg v={opt.harga} set={(v) => setOpt('harga', v)} opts={[['HSS', 'HSS 2024'], ['KHS', 'KHS 2024']]} /></div>
          <div className="fld"><label>Jenis RAB</label><select value={opt.jenis} onChange={(e) => setOpt('jenis', e.target.value)}>{[['Total', 'RAB Total'], ['Non MDU', 'RAB Non MDU'], ['MDU', 'RAB MDU']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="fld"><label>Asal material (semua baris)</label><select value={opt.asal} onChange={(e) => setOpt('asal', e.target.value)}>{['Gudang UP3', 'Gudang ULP', 'Vendor'].map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
      </div>
      <div className="sumbar">
        <div className="sum"><span>Material (MDU)</span><b>Rp {fmtRp(r.sub.mdu)}</b></div>
        <div className="sum"><span>Hardware (HDW)</span><b>Rp {fmtRp(r.sub.hardware)}</b></div>
        <div className="sum"><span>Jasa</span><b>Rp {fmtRp(r.sub.jasa)}</b></div>
        <div className="sum t"><span>Jumlah Total (incl. PPN)</span><b>Rp {fmtRp(r.grand)}</b></div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Rincian RAB</h2><span className="sub">Pelanggan: {p.nama} · {p.meta?.ulp || 'UP3 Klaten'} · Investasi {new Date().getFullYear()}</span>
          <label className="slo-t"><input type="checkbox" checked={opt.slo !== false} onChange={(e) => setOpt('slo', e.target.checked)} /> SLO 2,5%</label></div>
        <div className="tbl-wrap">
          <table className="rabt">
            <thead><tr><th>NO</th><th>URAIAN</th><th>GOL</th><th>SAT</th><th className="n">VOL</th><th className="n">HARGA SATUAN</th><th className="n">MDU</th><th className="n">HARDWARE</th><th className="n">JASA</th><th className="n">JUMLAH</th><th className="n">EDIT HARGA</th></tr></thead>
            <tbody>
              {r.rows.map((k) => <Group key={k.kelompok} k={k} setPrice={setPrice} edits={p.priceEdits} n={n} />)}
              {r.slo && <>
                <tr className="grp"><td></td><td colSpan={10}>SLO</td></tr>
                <tr><td>1</td><td>Sertifikasi Laik Operasi (2,5% dari jumlah)</td><td>JASA</td><td>Lot</td><td className="n">1</td><td className="n">{n(r.slo.jumlah)}</td><td></td><td></td><td className="n">{n(r.slo.jumlah)}</td><td className="n">{n(r.slo.jumlah)}</td><td></td></tr>
              </>}
              <Sum label="Jumlah MDU - Hardware - Jasa" v={r.sub} />
              <Sum label={`PPN ${Math.round(r.pctPpn * 100)}%`} v={r.ppn} />
              <Sum label="Jumlah Total" v={r.jum} tot />
            </tbody>
          </table>
        </div>
        <div className="rab-note"><p style={{ margin: 0 }}><b>Terbilang :</b> ( {r.terbilang} )</p><p style={{ margin: 0, color: 'var(--ink3)' }}>Harga yang dipakai adalah {opt.harga} 2024</p></div>
      </div>
      <p className="foot" style={{ textAlign: 'left' }}>Rincian dihitung otomatis dari titik tagging memakai data sheet HARGA SATUAN dan KONSTRUKSI.</p>
      {p.points.length === 0 && <p className="empty" style={{ textAlign: 'center' }}>Belum ada titik. RAB terisi otomatis dari hasil survei di peta.</p>}
    </>
  )
}

const Sum = ({ label, v, tot }) => (
  <tr className={tot ? 'tot' : 'sumrow'}><td colSpan={6} className="n">{label} :</td><td className="n">{fmtRp(v.mdu)}</td><td className="n">{fmtRp(v.hardware)}</td><td className="n">{fmtRp(v.jasa)}</td><td className="n">{fmtRp(v.total)}</td><td></td></tr>
)

function Group({ k, setPrice, edits, n }) {
  let last = null, c = 0
  return (
    <>
      <tr className="grp"><td>{k.kelompok}</td><td colSpan={10}>{k.judul}</td></tr>
      {k.items.map((i, idx) => {
        const head = i.konstruksi && i.konstruksi !== last
        if (head) { last = i.konstruksi; c = 0 }
        c++
        const key = i.nama, ed = edits[key] != null && edits[key] !== ''
        return (
          <Rows key={idx} head={head && <tr className="subr"><td>+</td><td>{i.konstruksi}</td><td></td><td>Unit</td><td className="n">{i.unit}</td><td colSpan={6}></td></tr>}>
            <tr>
              <td>{i.konstruksi ? c : ''}</td><td>{i.nama}</td><td>{i.gol}</td><td>{i.sat}</td><td className="n">{i.vol}</td>
              <td className="n">{i.price == null ? '' : fmtRp(i.price)}</td>
              <td className="n">{n(i.mdu)}</td><td className="n">{n(i.hardware)}</td><td className="n">{n(i.jasa)}</td><td className="n">{n(i.total)}</td>
              <td className="n"><input className={`pr ${ed ? 'edited' : ''}`} inputMode="numeric" value={edits[key] ?? ''} placeholder={i.price == null ? '—' : fmtRp(i.price)} onChange={(e) => setPrice(key, e.target.value.replace(/[^\d.]/g, ''))} /></td>
            </tr>
          </Rows>
        )
      })}
      {!k.items.length && <tr><td></td><td colSpan={10} className="muted">Belum ada item</td></tr>}
    </>
  )
}
const Rows = ({ head, children }) => <>{head}{children}</>

export default function Rab({ go }) {
  const { active } = useApp()
  return active ? <Inner go={go} /> : <Empty go={go} judul="Material & RAB" />
}
