import { Icon } from './ui'
import { STEPS, stepGuide, stepIndex } from '../lib/steps'

// Panduan "apa yang harus dilakukan" di langkah ini. Setiap butir bisa dicoret:
// butir otomatis tercoret sendiri saat datanya lengkap; butir manual dicentang dengan ketukan.
// Desktop: kolom kanan; HP: kartu lipat di atas halaman.
export function StepGuide({ page, project, onToggle }) {
  const i = stepIndex(page), g = i >= 0 && stepGuide(page, project)
  if (!g) return null
  const wajib = g.items.filter((x) => !x.opsional), selesai = wajib.filter((x) => x.done).length
  const body = (
    <>
      <p className="guide-intro">{g.intro}</p>
      <ul className="guide-list">
        {g.items.map((x) => {
          const bisa = !x.auto && !!project, cls = x.done ? 'done' : 'todo'
          const isi = (
            <>
              <span className="gmark">{x.done && <Icon n="check" size={13} />}</span>
              <span className="gtxt">{x.t}{x.opsional ? <em> · opsional</em> : <em className="req"> · wajib</em>}{x.auto && !x.done && <em className="auto"> · otomatis</em>}</span>
            </>
          )
          return (
            <li key={x.id} className={cls}>
              {bisa
                ? <button type="button" role="checkbox" aria-checked={x.done} className="gitem" onClick={() => onToggle(project.id, `${page}:${x.id}`)}>{isi}</button>
                : <div className="gitem static" role="checkbox" aria-checked={x.done} aria-readonly="true">{isi}</div>}
            </li>
          )
        })}
      </ul>
      <div className="guide-tip"><b>Tips</b> {g.tip}</div>
    </>
  )
  return (
    <aside className="guide" aria-label="Panduan langkah">
      <div className="guide-d">
        <div className="guide-h">
          <span className="guide-n">Langkah {STEPS[i].no}</span>
          <h2>{g.title}</h2>
          <div className="guide-prog"><div className="pprog-bar"><i style={{ width: `${(selesai / wajib.length) * 100}%` }} /></div><span>{selesai}/{wajib.length}</span></div>
        </div>
        {body}
      </div>
      <details className="guide-m">
        <summary><Icon n="check" size={16} /> <b>Panduan: {g.title}</b><span className="guide-cnt">{selesai}/{wajib.length}</span><Icon n="chevR" size={14} className="rot" /></summary>
        <div className="guide-m-b">{body}</div>
      </details>
    </aside>
  )
}
