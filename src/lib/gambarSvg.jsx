import { LEGEND, Sym, C_BARU, C_EKS } from './symbols'
import { RIGHT, buatSkema, SkemaIsi, ringkasPasang } from './skema'

export const W = 1280, VW = RIGHT - 10

// Seluruh lembar gambar (area gambar + panel kanan). untukFile = true: lebar penuh 1280 agar panel kanan ikut (PNG / Excel).
export function GambarSvg({ p, sk: skIn, svgRef, onDown, onMove, onUp, untukFile }) {
  const sk = skIn || buatSkema(p), pts = p.points, H = sk.H
  const { pasang, bongkar } = ringkasPasang(p)
  const bRows = Math.max(12, pasang.length, bongkar.length)
  const bY = 345, bBottom = Math.min(bY + 24 + bRows * 16, H - 215)
  const nRows = Math.floor((bBottom - bY - 24) / 16)
  const first = pts[0]
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${untukFile ? W : VW} ${H}`} {...(untukFile ? { width: W, height: H } : { style: { width: '100%', minWidth: 640, display: 'block' } })} fontFamily="Calibri, Arial, sans-serif" onPointerMove={onMove} onPointerUp={onUp}>
              <rect width={W} height={H} fill="#fff" />
              <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke="#222" strokeWidth="1.5" />
              <image href="/kompas.jpg" x="10" y="10" width="62" height="64" />
              {first && <text x="440" y="36" textAnchor="middle" fontSize="19">KOORDINAT {first.lat.toFixed(6)}, {first.lng.toFixed(6)}</text>}

              <SkemaIsi p={p} sk={sk} onDown={onDown} />

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
                      {a && <><text x="8" y="12" fontSize="11" fill={C_BARU}>{a.kode}</text><text x="110" y="12" fontSize="11" fill={C_BARU}>{a.sat}</text><text x="178" y="12" fontSize="11" fill={C_BARU} textAnchor="end">{a.vol}</text></>}
                      {b && <><text x="198" y="12" fontSize="11" fill={C_EKS}>{b.kode}</text><text x="300" y="12" fontSize="11" fill={C_EKS}>{b.sat}</text><text x="368" y="12" fontSize="11" fill={C_EKS} textAnchor="end">{b.vol}</text></>}
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
  )
}