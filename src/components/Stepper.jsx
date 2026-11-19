import { Icon, Button } from './ui'
import { STEPS, stepIndex } from '../lib/steps'

// Penunjuk langkah di atas halaman: nomor + garis penghubung, centang bila selesai, terkunci bila syarat belum ada.
export function Stepper({ page, status, project, go, onHome }) {
  const cur = stepIndex(page)
  return (
    <div className="stepbar">
      <div className="stepbar-in">
        <div className="stepmeta">
          <button type="button" className="backlink" onClick={onHome} title="Kembali ke daftar project" aria-label="Kembali ke daftar project"><Icon n="chevL" size={16} /><span>Kembali</span></button>
          <div className="stepmeta-t">
            <b>{project ? `${project.jenis === 'Tambah Daya' ? 'TD' : 'PB'} · ${project.nama}` : 'Project baru'}</b>
            <span>{project?.nomor ? `${project.nomor} · ` : ''}{cur >= 0 ? `Langkah ${cur + 1} dari ${STEPS.length}: ${STEPS[cur].label}` : ''}</span>
          </div>
        </div>
        <ol className="steps" aria-label="Langkah kerja">
          {STEPS.map((s, i) => {
            const st = status[s.key], isCur = i === cur, state = isCur ? 'cur' : st.done ? 'done' : st.ready ? 'open' : 'lock'
            return (
              <li key={s.key} className={`step ${state}`}>
                <button type="button" disabled={!st.ready} aria-current={isCur ? 'step' : undefined} onClick={() => go(s.key)}
                  title={!st.ready ? st.todo[0] : st.done ? 'Selesai' : st.todo[0] || s.label}>
                  <span className="dot">{st.done && !isCur ? <Icon n="check" size={15} /> : !st.ready ? <Icon n="x" size={11} /> : s.no}</span>
                  <span className="lbl"><span className="l-s">{s.short}</span><span className="l-l">{s.label}</span></span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

// Bilah aksi bawah yang sama dipakai semua langkah dan formulir project baru: aksi kiri / pesan / aksi utama kanan.
export const ActionBar = ({ left, msg, right }) => (
  <div className="stepfoot"><div className="stepfoot-in">{left || <span />}<div className="stepfoot-msg">{msg}</div>{right || <span />}</div></div>
)

// Bilah aksi bawah: kembali / lanjut + apa yang masih kurang di langkah ini.
export function StepFooter({ page, status, go, onSave, saving, readOnly }) {
  const i = stepIndex(page); if (i < 0) return null
  const st = status[STEPS[i].key], prev = STEPS[i - 1], next = STEPS[i + 1]
  const nextOk = next && (readOnly || st.done) && status[next.key].ready
  return (
    <div className="stepfoot">
      <div className="stepfoot-in">
        {prev ? <Button variant="secondary" icon="chevL" onClick={() => go(prev.key)}><span className="hide-sm">{prev.label}</span><span className="show-sm">Sebelumnya</span></Button> : <span />}
        <div className="stepfoot-msg">
          {readOnly ? 'Mode lihat saja' : !st.done && st.todo[0]}
          {st.warn && <span className="warnline">{!st.done && ' · '}{st.warn}</span>}
        </div>
        {next ? <Button iconRight="chevR" disabled={!nextOk} onClick={() => go(next.key)} title={!nextOk ? st.todo[0] || 'Lengkapi langkah ini dulu' : undefined}><span className="hide-sm">Lanjut: {next.label}</span><span className="show-sm">Lanjut</span></Button> : (readOnly ? <span /> : <Button icon={saving ? undefined : 'check'} disabled={saving} onClick={onSave}>{saving ? 'Menyimpan…' : 'Simpan project'}</Button>)}
      </div>
    </div>
  )
}
