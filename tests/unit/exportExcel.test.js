import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { exportExcel } from '../../src/lib/exportExcel.js'
import { loadMaster } from '../../src/lib/konstruksi.js'
import { demoProject } from '../../src/lib/seed.js'
import { recompute } from '../../src/store.jsx'
import { svgToDrawing } from '../../src/lib/svgToXlsx.js'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

beforeEach(async () => { await loadMaster() })

describe('svgToDrawing: SVG -> bentuk Excel', () => {
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><g fontSize="12">${body}</g></svg>`
  it('garis, lingkaran, kotak, teks, poligon menjadi bentuk (bukan gambar)', () => {
    const r = svgToDrawing(svg(`<rect x="5" y="5" width="100" height="50" fill="#fff" stroke="#222" stroke-width="1.5"/><line x1="0" y1="0" x2="50" y2="20" stroke="#E31E24" stroke-width="2" stroke-dasharray="10 6"/><circle cx="30" cy="30" r="8" fill="#0B6AA6"/><polygon points="0,0 10,0 5,8" fill="#111"/><text x="50" y="40" text-anchor="middle" font-size="12" font-weight="700" fill="#111">T1 &amp; T2</text>`))
    expect(r.images).toHaveLength(0)
    expect((r.xml.match(/<xdr:sp /g) || []).length).toBe(4); expect((r.xml.match(/<xdr:cxnSp /g) || []).length).toBe(1)
    expect(r.xml).toContain('custDash'); expect(r.xml).toContain('T1 &amp; T2'); expect(r.xml).toContain('prst="ellipse"'); expect(r.xml).not.toContain('<xdr:pic')
  })
  it('<g data-xl> menjadi grup bernama, rotasi/skala diterapkan, path M/L menjadi bentuk', () => {
    const r = svgToDrawing(svg(`<g data-xl="Simbol tiang T1" transform="translate(100,100) rotate(90) scale(2)"><path d="M-4-4L4 4M4-4L-4 4" stroke="#E31E24" stroke-width="1.8" fill="none"/><circle r="5" fill="none" stroke="#000"/></g>`))
    expect(r.xml).toContain('<xdr:grpSp>'); expect(r.xml).toContain('name="Simbol tiang T1"')
    const m = r.xml.match(/<a:ellipse|prst="ellipse"/); expect(m).toBeTruthy()
  })
  it('gambar data-URL menjadi picture dengan rId berurutan', () => {
    const r = svgToDrawing(svg(`<image href="${PNG}" x="10" y="20" width="100" height="80"/>`))
    expect(r.images).toEqual([{ ext: 'png', base64: PNG.split(',')[1] }]); expect(r.xml).toContain('r:embed="rId1"')
  })
})

describe('exportExcel: sheet GAMBAR berisi bentuk yang bisa diedit', () => {
  it('xlsx valid: drawing berisi bentuk, teks, legenda; gambar hanya kompas & logo', async () => {
    const aset = (u) => ({ blob: async () => new Blob([readFileSync('public' + u)]), arrayBuffer: async () => readFileSync('public' + u) })
    vi.stubGlobal('fetch', async (u) => aset(u))
    let blob; vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b) => { blob = b; return 'blob:x' }, revokeObjectURL() {} }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const d = demoProject(); const p = recompute({ ...d, points: d.points.map((x, i) => (i === 1 ? { ...x, konsBaru: [{ id: 'k', grup: 'KONSTRUKSI JTR PADA TIANG BETON', kode: 'CJ5' }] } : x)) })
    await exportExcel(p)
    expect(blob).toBeTruthy()
    const zip = await JSZip.loadAsync(await bacaBlob(blob))
    const names = Object.keys(zip.files)
    const rels = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string')
    const dn = rels.match(/drawings\/(drawing\d+\.xml)/)[1]
    const xml = await zip.file('xl/drawings/' + dn).async('string')
    const drel = await zip.file('xl/drawings/_rels/' + dn + '.rels').async('string')
    const count = (re) => (xml.match(re) || []).length
    expect(count(/<xdr:sp /g)).toBeGreaterThan(60); expect(count(/<xdr:cxnSp /g)).toBeGreaterThan(5); expect(count(/<xdr:grpSp>/g)).toBeGreaterThan(5)
    expect(count(/<xdr:pic>/g)).toBe(2)              // kompas + logo saja; garis/titik/simbol/teks = bentuk
    expect(xml).toContain('Legenda'); expect(xml).toContain('1CJ5'); expect(xml).toContain('Teks: ')
    for (const m of drel.matchAll(/Target="\.\.\/media\/(image\d+\.\w+)"/g)) expect(names).toContain('xl/media/' + m[1])
    require_wellformed(xml)
    if (process.env.XLSX_OUT) (await import('node:fs')).writeFileSync(process.env.XLSX_OUT, new Uint8Array(await bacaBlob(blob)))
  })
})
const bacaBlob = (b) => new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsArrayBuffer(b) })
function require_wellformed(xml) { const d = new DOMParser().parseFromString(xml, 'application/xml'); expect(d.querySelector('parsererror')).toBeNull() }
