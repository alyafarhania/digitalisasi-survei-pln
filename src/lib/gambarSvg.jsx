import { LEGEND, Sym, C_BARU, C_EKS, C_BONGKAR } from './symbols'
import { RIGHT, PW, TABEL_BARIS, RH, buatSkema, SkemaIsi, ringkasPasang } from './skema'

export const W = 1280, VW = RIGHT - 10
// Dua jalur pada legenda: pemasangan konstruksi baru (merah) dan pembongkaran konstruksi lama (ungu)
export const JALUR_LEGEND = [['Jalur Pasang (Merah)', C_BARU], ['Jalur Bongkar (Ungu)', C_BONGKAR]]
const LH = 14 // tinggi baris legenda
const potong = (t = '', n) => (t.length > n ? t.slice(0, n - 1) + '…' : t)

// Seluruh lembar gambar (area gambar + panel kanan). untukFile = true: lebar penuh 1280 agar panel kanan ikut (PNG / Excel).
// bgUrl = alamat/data URL gambar peta offline unggahan (latar gambar konstruksi), bila project memakainya.
export function GambarSvg({ p, sk: skIn, svgRef, onDown, onMove, onUp, untukFile, bgUrl }) {
  const sk = skIn || buatSkema(p), pts = p.points, H = sk.H
  const { pasang, bongkar } = ringkasPasang(p)
  const nRow = Math.max(TABEL_BARIS, pasang.length, bongkar.length)
  // posisi vertikal panel kanan (urut dari atas); blok bawah (keterangan, judul, tanda tangan) menempel ke dasar lembar
  const yLeg = 52, nLeg = LEGEND.length + JALUR_LEGEND.length
  const yBP = yLeg + 16 + nLeg * LH + 20, yRow = yBP + 18, yBawah = H - 176
  const half = PW / 2
  const first = pts[0] || (p.pointsBongkar || [])[0]
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${untukFile ? W : VW} ${H}`} {...(untukFile ? { width: W, height: H } : { style: { width: '100%', minWidth: 640, display: 'block' } })} fontFamily="Calibri, Arial, sans-serif" onPointerMove={onMove} onPointerUp={onUp}>
              <rect width={W} height={H} fill="#fff" />
              {sk.bg && bgUrl && <g data-xl="Peta offline (latar)"><image href={bgUrl} x={sk.bg.x} y={sk.bg.y} width={sk.bg.w} height={sk.bg.h} preserveAspectRatio="none" /><rect x={sk.bg.x} y={sk.bg.y} width={sk.bg.w} height={sk.bg.h} fill="none" stroke="#9AA5B1" strokeWidth="0.8" /></g>}
              <rect x="3" y="3" width={W - 6} height={H - 6} fill="none" stroke="#222" strokeWidth="1.5" />
              <image href="/kompas.jpg" x="10" y="10" width="62" height="64" />
              {first && <text x={VW / 2} y="36" textAnchor="middle" fontSize="19">KOORDINAT {first.lat.toFixed(6)}, {first.lng.toFixed(6)}</text>}

              <SkemaIsi p={p} sk={sk} onDown={onDown} />

              {/* panel kanan: di luar viewBox layar, hanya ikut saat Unduh PNG / Excel */}
              <g fontSize="11" fill="#111">
                <rect x={RIGHT} y="12" width={PW} height="26" fill="#fff" stroke="#222" />
                <image href="/logo-pln.png" x={RIGHT + 5} y="14" width="18" height="22" />
                <text x={RIGHT + PW / 2 + 8} y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0B6AA6">PT. PLN (PERSERO) {(p.meta?.ulp || 'UP3 KLATEN').toUpperCase()}</text>
                <text x={RIGHT + 4} y={yLeg - 4} fontWeight="700" fontSize="11">Keterangan Gambar :</text>
                <rect x={RIGHT} y={yLeg} width={PW} height="16" fill="#E8F3FA" stroke="#222" />
                {[['No', 14], ['Nama Material', 103], ['Baru', 211], ['Eksisting', 277]].map(([t, x]) => <text key={t} x={RIGHT + x} y={yLeg + 12} textAnchor="middle" fontSize="10.5">{t}</text>)}
                {LEGEND.map(([nama, t], i) => (
                  <g key={t} data-xl={`Legenda ${nama}`} transform={`translate(${RIGHT},${yLeg + 16 + i * LH})`}>
                    <rect width={PW} height={LH} fill="#fff" stroke="#222" strokeWidth="0.7" />
                    <text x="14" y="10.5" textAnchor="middle" fontSize="10">{i + 1}</text><text x="103" y="10.5" textAnchor="middle" fontSize="10">{nama}</text>
                    <Sym t={t} s="baru" x={211} y={LH / 2} k={0.62} n={`Simbol ${nama} (baru)`} /><Sym t={t} s="eksisting" x={277} y={LH / 2} k={0.62} n={`Simbol ${nama} (eksisting)`} />
                  </g>
                ))}
                {JALUR_LEGEND.map(([nama, warna], j) => {
                  const i = LEGEND.length + j
                  return (
                    <g key={nama} data-xl={`Legenda ${nama}`} transform={`translate(${RIGHT},${yLeg + 16 + i * LH})`}>
                      <rect width={PW} height={LH} fill="#fff" stroke="#222" strokeWidth="0.7" />
                      <text x="14" y="10.5" textAnchor="middle" fontSize="10">{i + 1}</text><text x="103" y="10.5" textAnchor="middle" fontSize="10">{nama}</text>
                      <line data-xl={`Garis ${nama}`} x1="214" y1={LH / 2} x2="274" y2={LH / 2} stroke={warna} strokeWidth="2.4" />
                    </g>
                  )
                })}
                <text x={RIGHT + 4} y={yBP - 4} fontWeight="700" fontSize="11">Bongkar Pasang Konstruksi :</text>
                <rect x={RIGHT} y={yBP} width={PW} height="18" fill="#fff" stroke="#222" />
                <text x={RIGHT + half / 2} y={yBP + 13} textAnchor="middle" fontWeight="700" fill={C_BARU}>Pasang</text>
                <text x={RIGHT + half * 1.5} y={yBP + 13} textAnchor="middle" fontWeight="700" fill={C_BONGKAR}>Bongkar</text>
                {Array.from({ length: nRow }).map((_, i) => {
                  const a = pasang[i], b = bongkar[i]
                  return (
                    <g key={i} transform={`translate(${RIGHT},${yRow + i * RH})`}>
                      <rect width={PW} height={RH} fill="#fff" stroke="#222" strokeWidth="0.6" />
                      <line x1={half} x2={half} y2={RH} stroke="#222" strokeWidth="0.8" />
                      {a && <><text x="5" y="9.8" fontSize="9.5" fill={C_BARU}>{a.kode}</text><text x="92" y="9.8" fontSize="9.5" fill={C_BARU}>{a.sat}</text><text x={half - 5} y="9.8" fontSize="9.5" fill={C_BARU} textAnchor="end">{a.vol}</text></>}
                      {b && <><text x={half + 5} y="9.8" fontSize="9.5" fill={C_BONGKAR}>{b.kode}</text><text x={half + 92} y="9.8" fontSize="9.5" fill={C_BONGKAR}>{b.sat}</text><text x={PW - 5} y="9.8" fontSize="9.5" fill={C_BONGKAR} textAnchor="end">{b.vol}</text></>}
                    </g>
                  )
                })}
                <text x={RIGHT + 4} y={yBawah} fontWeight="700" fontSize="11">Keterangan Tambahan:</text>
                <rect x={RIGHT} y={yBawah + 4} width={PW} height="26" fill="#fff" stroke="#222" />
                <text x={RIGHT + 5} y={yBawah + 21} fontSize="10">{potong(p.meta?.keterangan || '', 58)}</text>
                <g transform={`translate(${RIGHT},${yBawah + 34})`}>
                  <rect width={PW} height="16" fill="#fff" stroke="#222" />
                  <text x="6" y="12" fontSize="10.5">No. Gambar</text><text x="62" y="12" fontSize="10.5">{potong(p.meta?.noGambar || '', 20)}</text><text x={half + 12} y="12" fontSize="10.5">Skala</text><text x={half + 46} y="12" fontSize="10.5">{p.meta?.skala}</text>
                  <rect y="16" width={PW} height="16" fill="#fff" stroke="#222" /><text x={half} y="28" textAnchor="middle" fontSize="10.5">Perihal: {potong(p.meta?.perihal || '', 40)}</text>
                  <rect y="32" width={PW} height="30" fill="#fff" stroke="#222" />
                  <text x={half} y="51" textAnchor="middle" fontWeight="700" fontSize="11" fill="#0B6AA6">{potong((p.jenis === 'Tambah Daya' ? 'TD ' : 'PB ') + (p.daya ? Math.round(p.daya / 1000 * 10) / 10 + ' KVA ' : '') + (p.nama || '').toUpperCase(), 50)}</text>
                  {[['Digambar', 'digambar'], ['Diperiksa', 'diperiksa'], ['Diketahui', 'diketahui'], ['Disetujui', 'disetujui']].map(([l, k], i) => (
                    <g key={k} transform={`translate(0,${62 + i * 14})`}>
                      <rect width={PW} height="14" fill="#fff" stroke="#222" strokeWidth="0.6" />
                      <text x="78" y="10.5" fontSize="10" textAnchor="end">{l}</text><text x="86" y="10.5" fontSize="10">{p.meta?.[k]}</text>
                    </g>
                  ))}
                </g>
              </g>
            </svg>
  )
}
