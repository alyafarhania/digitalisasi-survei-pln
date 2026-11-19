import { useEffect, useState } from 'react'
import Empty from './Empty'
import { useApp } from '../store'
import { hitungRab, rabKosong } from '../lib/rab'
import { fmtRp } from '../lib/geo'
import { Alert, Button, Card, Field, Icon, PageHeader, Segmented, Select } from '../components/ui'

const num = (v) => (v ? fmtRp(v) : '')
const digits = (s) => String(s).replace(/\D/g, '')
// tabel lebar di layar >= 760px; di bawahnya daftar kartu
function useNarrow(px = 760) {
  const [n, setN] = useState(false)
  useEffect(() => { const m = matchMedia(`(max-width:${px - 1}px)`), h = () => setN(m.matches); h(); m.addEventListener('change', h); return () => m.removeEventListener('change', h) }, [px])
  return n
}

// Harga satuan yang bisa diubah di tempat: selalu berisi angka sebenarnya (default atau hasil ubahan).
function PriceInput({ item, edited, onChange, onReset }) {
  const [fokus, setFokus] = useState(false)
  const nilai = edited != null && edited !== '' ? Number(edited) : item.price
  const kosong = nilai == null || nilai === 0
  return (
    <span className={`pin ${edited != null && edited !== '' ? 'edited' : ''} ${kosong ? 'empty' : ''}`}>
      <input type="text" inputMode="numeric" aria-label={`Harga satuan ${item.nama}`} data-testid="harga-input"
        value={fokus ? (edited ?? (nilai ? String(nilai) : '')) : kosong ? '' : fmtRp(nilai)} placeholder="Isi harga"
        onFocus={(e) => { setFokus(true); const t = e.target; setTimeout(() => t.select(), 0) }} onBlur={() => setFokus(false)}
        onChange={(e) => onChange(digits(e.target.value))} />
      {edited != null && edited !== '' && <button type="button" className="pin-x" onClick={onReset} aria-label={`Kembalikan harga ${item.nama}`} title="Kembalikan ke harga standar"><Icon n="undo" size={13} /></button>}
    </span>
  )
}
const Gol = ({ g }) => <span className={`gol gol-${(g || '').replace(/[^A-Z]/gi, '')}`}>{g}</span>

// F6 Material dan RAB: format mengikuti sheet RAB di Excel (kolom MDU / Hardware / Jasa, SLO, PPN, terbilang)
function Inner() {
  const { active: p, update } = useApp()
  const narrow = useNarrow()
  const r = hitungRab(p), opt = p.rabOpt, edits = p.priceEdits || {}, sloOn = opt.slo !== false
  const setOpt = (k, v) => update(p.id, (x) => ({ ...x, rabOpt: { ...x.rabOpt, [k]: v } }))
  const setPrice = (nama, v) => update(p.id, (x) => ({ ...x, priceEdits: { ...x.priceEdits, [nama]: v } }))
  const resetPrice = (nama) => update(p.id, (x) => { const e = { ...x.priceEdits }; delete e[nama]; return { ...x, priceEdits: e } })
  const nEdit = Object.keys(edits).filter((k) => edits[k] !== '').length
  const kosong = rabKosong(r), terkunci = kosong.length > 0

  return (
    <>
      <PageHeader title="Material & RAB">
        {nEdit > 0 && <Button variant="secondary" icon="undo" onClick={() => update(p.id, (x) => ({ ...x, priceEdits: {} }))}>Kembalikan {nEdit} harga</Button>}
      </PageHeader>
      {terkunci && (
        <Alert tone="bad" title={`Ekspor RAB terkunci: ${kosong.length} item belum punya harga ${opt.harga} 2024.`}>
          Ketik harganya di kolom <b>Harga satuan</b> pada baris yang berwarna merah{opt.harga === 'KHS' ? ', atau ganti pilihan harga ke HSS 2024' : ''}.
          <ul>{kosong.slice(0, 8).map((k, i) => <li key={i}>{k.kelompok}. {k.nama}</li>)}{kosong.length > 8 && <li>… dan {kosong.length - 8} lainnya</li>}</ul>
        </Alert>
      )}
      <Card className="rab-opts">
        <div className="rab-optgrid">
          <Field label="Pilihan harga"><Segmented value={opt.harga} onChange={(v) => setOpt('harga', v)} options={[['HSS', 'HSS 2024'], ['KHS', 'KHS 2024']]} /></Field>
          <Field label="Jenis RAB"><Select aria-label="Jenis RAB" value={opt.jenis} onChange={(e) => setOpt('jenis', e.target.value)} options={[{ v: 'Total', l: 'RAB Total' }, { v: 'Non MDU', l: 'RAB Non MDU' }, { v: 'MDU', l: 'RAB MDU' }]} /></Field>
          <Field label="Asal material (semua baris)"><Select aria-label="Asal material (semua baris)" value={opt.asal} onChange={(e) => setOpt('asal', e.target.value)} options={['Gudang UP3', 'Gudang ULP', 'Vendor']} /></Field>
          <Field label="SLO 2,5%">
            <button type="button" role="switch" aria-checked={sloOn} className={`switch ${sloOn ? 'on' : ''}`} onClick={() => setOpt('slo', !sloOn)} data-testid="slo-switch">
              <i /><span>{sloOn ? 'Diterapkan' : 'Tidak diterapkan'}</span>
            </button>
          </Field>
        </div>
      </Card>

      <div className="sumbar">
        <div className="sum"><span>Material (MDU)</span><b>Rp {fmtRp(r.sub.mdu)}</b></div>
        <div className="sum"><span>Hardware (HDW)</span><b>Rp {fmtRp(r.sub.hardware)}</b></div>
        <div className="sum"><span>Jasa{sloOn ? ' (+ SLO)' : ''}</span><b>Rp {fmtRp(r.sub.jasa)}</b></div>
        <div className="sum t"><span>Jumlah Total (incl. PPN)</span><b data-testid="grand-total">Rp {fmtRp(r.grand)}</b></div>
      </div>

      <Card title="Rincian RAB" sub={`Pelanggan: ${p.nama} · ${p.meta?.ulp || 'UP3 Klaten'} · Investasi ${new Date().getFullYear()}`} flush>
        {narrow ? <Kartu r={r} edits={edits} sloOn={sloOn} setPrice={setPrice} resetPrice={resetPrice} /> : <Tabel r={r} edits={edits} sloOn={sloOn} setPrice={setPrice} resetPrice={resetPrice} />}
        <div className="rab-note"><p style={{ margin: 0 }}><b>Terbilang :</b> ( {r.terbilang} )</p><p style={{ margin: 0, color: 'var(--faint)' }}>Harga yang dipakai adalah {opt.harga} 2024</p></div>
      </Card>
      {p.points.length === 0 && <p className="empty" style={{ textAlign: 'center' }}>Belum ada titik. RAB terisi otomatis dari hasil survei di peta.</p>}
    </>
  )
}

// ----- tabel (layar lebar): NO | URAIAN | VOL | HARGA SATUAN | MDU | HARDWARE | JASA | JUMLAH -----
function Tabel({ r, edits, sloOn, setPrice, resetPrice }) {
  return (
    <div className="tbl-wrap">
      <table className="rabt" data-testid="rab-table">
        <colgroup><col className="c-no" /><col className="c-ur" /><col className="c-vol" /><col className="c-hrg" /><col className="c-rp" /><col className="c-rp" /><col className="c-rp" /><col className="c-jml" /></colgroup>
        <thead><tr><th>NO</th><th>URAIAN</th><th className="n">VOL</th><th className="n">HARGA SATUAN</th><th className="n">MDU</th><th className="n">HARDWARE</th><th className="n">JASA</th><th className="n">JUMLAH</th></tr></thead>
        <tbody>
          {r.rows.map((k) => {
            let last = null, c = 0
            return [
              <tr key={k.kelompok} className="grp"><td>{k.kelompok}</td><td colSpan={7}>{k.judul}</td></tr>,
              ...k.items.flatMap((i, idx) => {
                const head = i.konstruksi && i.konstruksi !== last
                if (head) { last = i.konstruksi; c = 0 }
                c++
                const ed = edits[i.nama]
                return [
                  head && <tr key={`${k.kelompok}-h${idx}`} className="subr"><td>+</td><td colSpan={7}>{i.konstruksi} <span className="unit">· {i.unit} Unit</span></td></tr>,
                  <tr key={`${k.kelompok}-${idx}`} className={i.price == null || i.price === 0 ? 'nohrg' : ''}>
                    <td>{i.konstruksi ? c : ''}</td>
                    <td><span className="nm">{i.nama}</span> <Gol g={i.gol} /></td>
                    <td className="n">{i.vol} <span className="sat">{i.sat}</span></td>
                    <td className="n hrg"><PriceInput item={i} edited={ed} onChange={(v) => setPrice(i.nama, v)} onReset={() => resetPrice(i.nama)} /></td>
                    <td className="n">{num(i.mdu)}</td><td className="n">{num(i.hardware)}</td><td className="n">{num(i.jasa)}</td><td className="n">{num(i.total)}</td>
                  </tr>,
                ]
              }).filter(Boolean),
              !k.items.length && <tr key={`${k.kelompok}-e`}><td></td><td colSpan={7} className="muted">Belum ada item</td></tr>,
            ]
          })}
          {/* SLO selalu tampil supaya tata letak tetap sama; saat dimatikan barisnya redup */}
          <tr className="grp"><td></td><td colSpan={7}>SLO</td></tr>
          <tr className={sloOn ? '' : 'off'} data-testid="slo-row">
            <td>1</td><td><span className="nm">Sertifikasi Laik Operasi (2,5% dari jumlah)</span> <Gol g="JASA" />{!sloOn && <em className="offnote">tidak diterapkan</em>}</td>
            <td className="n">1 <span className="sat">Lot</span></td><td className="n">{sloOn ? num(r.slo?.jumlah) : '—'}</td><td></td><td></td><td className="n">{sloOn ? num(r.slo?.jumlah) : '—'}</td><td className="n">{sloOn ? num(r.slo?.jumlah) : '—'}</td>
          </tr>
          <Sum label="Jumlah MDU - Hardware - Jasa" v={r.sub} />
          <Sum label={`PPN ${Math.round(r.pctPpn * 100)}%`} v={r.ppn} />
          <Sum label="Jumlah Total" v={r.jum} tot />
        </tbody>
      </table>
    </div>
  )
}
const Sum = ({ label, v, tot }) => (
  <tr className={tot ? 'tot' : 'sumrow'}><td colSpan={4} className="n">{label} :</td><td className="n">{fmtRp(v.mdu)}</td><td className="n">{fmtRp(v.hardware)}</td><td className="n">{fmtRp(v.jasa)}</td><td className="n">{fmtRp(v.total)}</td></tr>
)

// ----- kartu (HP) -----
function Kartu({ r, edits, sloOn, setPrice, resetPrice }) {
  return (
    <div className="rcards" data-testid="rab-cards">
      {r.rows.map((k) => {
        let last = null
        return (
          <section key={k.kelompok}>
            <h3 className="rc-grp"><b>{k.kelompok}</b> {k.judul}</h3>
            {k.items.map((i, idx) => {
              const head = i.konstruksi && i.konstruksi !== last; if (head) last = i.konstruksi
              return (
                <div key={idx}>
                  {head && <div className="rc-sub">+ {i.konstruksi} · {i.unit} Unit</div>}
                  <div className={`rc ${i.price == null || i.price === 0 ? 'nohrg' : ''}`}>
                    <div className="rc-h"><b>{i.nama}</b><Gol g={i.gol} /></div>
                    <div className="rc-m"><span className="rc-q">{i.vol} {i.sat} ×</span><PriceInput item={i} edited={edits[i.nama]} onChange={(v) => setPrice(i.nama, v)} onReset={() => resetPrice(i.nama)} /></div>
                    <div className="rc-t"><span>Jumlah</span><b>{i.total != null ? `Rp ${fmtRp(i.total)}` : '—'}</b></div>
                  </div>
                </div>
              )
            })}
            {!k.items.length && <p className="rc-empty">Belum ada item</p>}
          </section>
        )
      })}
      <section>
        <h3 className="rc-grp"><b>SLO</b> Sertifikasi Laik Operasi</h3>
        <div className={`rc ${sloOn ? '' : 'off'}`}><div className="rc-h"><b>SLO 2,5% dari jumlah</b><Gol g="JASA" /></div><div className="rc-t"><span>{sloOn ? 'Jumlah' : 'Tidak diterapkan'}</span><b>{sloOn ? `Rp ${fmtRp(r.slo?.jumlah)}` : '—'}</b></div></div>
      </section>
      <div className="rc-sum">
        {[['MDU', r.sub.mdu], ['Hardware', r.sub.hardware], ['Jasa', r.sub.jasa], [`PPN ${Math.round(r.pctPpn * 100)}%`, r.ppn.total]].map(([l, v]) => <div key={l}><span>{l}</span><b>Rp {fmtRp(v)}</b></div>)}
        <div className="tot"><span>Jumlah Total</span><b>Rp {fmtRp(r.grand)}</b></div>
      </div>
    </div>
  )
}

export default function Rab({ go }) {
  const { active } = useApp()
  return active ? <Inner /> : <Empty go={go} judul="Material & RAB" />
}
