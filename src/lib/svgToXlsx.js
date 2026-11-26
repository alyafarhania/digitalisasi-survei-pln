// Mengubah markup SVG lembar gambar (garis, titik, simbol, kotak keterangan, teks, legenda) menjadi bentuk (shape)
// DrawingML Excel, sehingga hasil gambar di Excel bisa diedit: garis digeser/diubah warnanya, teks diketik ulang,
// simbol dipindah, dst. Hanya gambar latar (peta offline), kompas, dan logo yang berupa gambar (picture).
//
// Tata letak dibaca dari SVG yang sama dengan tampilan web, jadi susunan, skala, dan tampilan tetap sama.
// Setiap elemen diletakkan dengan absoluteAnchor (posisi mutlak dalam piksel 96 dpi -> EMU) supaya tidak bergantung
// pada lebar kolom/tinggi baris. <g data-xl="Nama"> menjadi grup bernama (mis. satu simbol atau satu kotak titik).

const EMU = 9525
const e = (v) => Math.round(v * EMU)
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d }

// ---- matriks affine [a b c d e f]: x' = a x + c y + e ; y' = b x + d y + f
const I = [1, 0, 0, 1, 0, 0]
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
const pt = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] })
function parseTransform(str) {
  let m = I
  for (const [, fn, raw] of (str || '').matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = raw.split(/[\s,]+/).filter(Boolean).map(Number)
    if (fn === 'translate') m = mul(m, [1, 0, 0, 1, a[0] || 0, a[1] || 0])
    else if (fn === 'scale') m = mul(m, [a[0], 0, 0, a[1] ?? a[0], 0, 0])
    else if (fn === 'rotate') {
      const r = ((a[0] || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] || 0, cy = a[2] || 0
      m = mul(m, [1, 0, 0, 1, cx, cy]); m = mul(m, [c, s, -s, c, 0, 0]); m = mul(m, [1, 0, 0, 1, -cx, -cy])
    } else if (fn === 'matrix' && a.length === 6) m = mul(m, a)
  }
  return m
}
const skala = (m) => Math.hypot(m[0], m[1]) || 1
const sudut = (m) => (Math.atan2(m[1], m[0]) * 180) / Math.PI

// ---- warna
const NAMA = { white: 'FFFFFF', black: '000000', red: 'FF0000' }
function warna(v) {
  if (!v) return null
  v = String(v).trim().toLowerCase()
  if (v === 'none' || v === 'transparent' || v === 'currentcolor') return null
  if (NAMA[v]) return NAMA[v]
  const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return h.toUpperCase()
}

// ---- gaya yang diwariskan antar elemen
const WARIS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'font-size', 'font-weight', 'text-anchor', 'font-family']
const gayaDari = (el, induk) => {
  const g = { ...induk }
  for (const k of WARIS) { const v = el.getAttribute(k); if (v != null) g[k] = v }
  return g
}

// ---- pembuat XML
const fillXml = (c) => (c ? `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>` : '<a:noFill/>')
function lnXml(g, sk) {
  const c = warna(g.stroke)
  if (!c) return '<a:ln><a:noFill/></a:ln>'
  const w = Math.max(0.25, num(g['stroke-width'], 1) * sk)
  const da = String(g['stroke-dasharray'] || '').split(/[\s,]+/).map(Number).filter((n) => n > 0)
  let dash = ''
  if (da.length) {
    const arr = da.length % 2 ? [...da, ...da] : da, ds = []
    for (let i = 0; i < arr.length; i += 2) ds.push(`<a:ds d="${Math.round((arr[i] * sk / w) * 100000)}" sp="${Math.round((arr[i + 1] * sk / w) * 100000)}"/>`)
    dash = `<a:custDash>${ds.join('')}</a:custDash>`
  }
  const cap = g['stroke-linecap'] === 'round' ? ' cap="rnd"' : ''
  return `<a:ln w="${e(w)}"${cap}>${fillXml(c)}${dash}<a:round/></a:ln>`
}
const bbox = (ps) => {
  const xs = ps.map((q) => q.x), ys = ps.map((q) => q.y)
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }
}

export function svgToDrawing(svgMarkup) {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('SVG tidak valid')
  const root = doc.documentElement
  const vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  const lebar = vb[2] || num(root.getAttribute('width'), 1280), tinggi = vb[3] || num(root.getAttribute('height'), 905)
  let nid = 1
  const images = []

  // setiap fungsi gambar mengembalikan { xml, b: {x,y,w,h} } (kotak pembatas dalam piksel) atau null
  const sp = ({ name, b, rot = 0, geom, fill, ln, tx, txBox }) => {
    const id = ++nid
    return { b, xml: `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${esc(name)}"/><xdr:cNvSpPr${txBox ? ' txBox="1"' : ''}/></xdr:nvSpPr><xdr:spPr><a:xfrm${rot ? ` rot="${Math.round(rot * 60000)}"` : ''}><a:off x="${e(b.x)}" y="${e(b.y)}"/><a:ext cx="${e(b.w)}" cy="${e(b.h)}"/></a:xfrm>${geom}${fill}${ln}</xdr:spPr>${tx || ''}</xdr:sp>` }
  }
  const prst = (n) => `<a:prstGeom prst="${n}"><a:avLst/></a:prstGeom>`
  const cust = (subs, b) => {
    const W = Math.max(1, e(b.w)), H = Math.max(1, e(b.h))
    const paths = subs.map((s) => `<a:path w="${W}" h="${H}"${s.fill ? '' : ' fill="none"'}>${s.pts.map((q, i) => `<a:${i ? 'lnTo' : 'moveTo'}><a:pt x="${e(q.x - b.x)}" y="${e(q.y - b.y)}"/></a:${i ? 'lnTo' : 'moveTo'}>`).join('')}${s.closed ? '<a:close/>' : ''}</a:path>`).join('')
    return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst>${paths}</a:pathLst></a:custGeom>`
  }

  function garis(el, m, g) {
    const a = pt(m, num(el.getAttribute('x1')), num(el.getAttribute('y1'))), z = pt(m, num(el.getAttribute('x2')), num(el.getAttribute('y2')))
    if (!warna(g.stroke)) return null
    const b = bbox([a, z]), id = ++nid, flip = (z.x - a.x) * (z.y - a.y) < 0 ? ' flipV="1"' : ''
    return { b, xml: `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id}" name="Garis ${id}"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr><xdr:spPr><a:xfrm${flip}><a:off x="${e(b.x)}" y="${e(b.y)}"/><a:ext cx="${e(b.w)}" cy="${e(b.h)}"/></a:xfrm>${prst('line')}${lnXml(g, skala(m))}</xdr:spPr></xdr:cxnSp>` }
  }
  function persegi(el, m, g) {
    const x = num(el.getAttribute('x')), y = num(el.getAttribute('y')), w = num(el.getAttribute('width')), h = num(el.getAttribute('height'))
    const f = warna(g.fill ?? '#000'), s = warna(g.stroke)
    if (!f && !s) return null
    const sk = skala(m)
    if (Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9 && m[0] > 0 && m[3] > 0) {
      const o = pt(m, x, y)
      return sp({ name: 'Kotak', b: { x: o.x, y: o.y, w: w * m[0], h: h * m[3] }, geom: prst('rect'), fill: fillXml(f), ln: lnXml(g, sk) })
    }
    const ps = [pt(m, x, y), pt(m, x + w, y), pt(m, x + w, y + h), pt(m, x, y + h)], b = bbox(ps)
    return sp({ name: 'Kotak', b, geom: cust([{ pts: ps, closed: true, fill: !!f }], b), fill: fillXml(f), ln: lnXml(g, sk) })
  }
  function lingkaran(el, m, g) {
    const c = pt(m, num(el.getAttribute('cx')), num(el.getAttribute('cy'))), r = num(el.getAttribute('r')) * skala(m)
    const f = warna(g.fill ?? '#000'), s = warna(g.stroke)
    if (!f && !s) return null
    return sp({ name: 'Lingkaran', b: { x: c.x - r, y: c.y - r, w: 2 * r, h: 2 * r }, geom: prst('ellipse'), fill: fillXml(f), ln: lnXml(g, skala(m)) })
  }
  function poligon(subs, m, g, nama) {
    const f = warna(g.fill ?? '#000'), s = warna(g.stroke)
    const ok = subs.filter((q) => q.pts.length > 1)
    if (!ok.length || (!f && !s)) return null
    const all = ok.flatMap((q) => q.pts), b = bbox(all)
    return sp({ name: nama, b, geom: cust(ok.map((q) => ({ ...q, fill: !!f && q.closed })), b), fill: fillXml(f), ln: lnXml(g, skala(m)) })
  }
  function jalurPath(el, m) {
    const toks = [...(el.getAttribute('d') || '').matchAll(/([MLHVZmlhvz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi)].map((t) => t[1] || parseFloat(t[2]))
    const subs = []; let cur = null, x = 0, y = 0, cmd = null, i = 0
    const take = () => toks[i++]
    while (i < toks.length) {
      if (typeof toks[i] === 'string') cmd = take()
      const rel = cmd === cmd?.toLowerCase(), C = cmd?.toUpperCase()
      if (C === 'Z') { if (cur) cur.closed = true; cur = null; continue }
      if (C === 'M' || C === 'L') {
        const nx = take(), ny = take(); x = rel ? x + nx : nx; y = rel ? y + ny : ny
        if (C === 'M') { cur = { pts: [pt(m, x, y)], closed: false }; subs.push(cur); cmd = rel ? 'l' : 'L' } else { if (!cur) { cur = { pts: [], closed: false }; subs.push(cur) } cur.pts.push(pt(m, x, y)) }
      } else if (C === 'H') { const nx = take(); x = rel ? x + nx : nx; cur?.pts.push(pt(m, x, y)) }
      else if (C === 'V') { const ny = take(); y = rel ? y + ny : ny; cur?.pts.push(pt(m, x, y)) }
      else return []   // perintah kurva tidak dipakai simbol kita
    }
    return subs
  }
  function teks(el, m, g) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    const f = warna(g.fill ?? '#000')
    if (!t) return null
    const sk = skala(m), fs = num(g['font-size'], 16) * sk, bold = /^(bold|[6-9]00)$/.test(String(g['font-weight'] || ''))
    const anchor = g['text-anchor'] || 'start', w = Math.max(fs, t.length * fs * (bold ? 0.56 : 0.52) * 1.25 + 6), h = fs * 1.35
    const rot = sudut(m)
    // pusat kotak teks di sistem lokal (sebelum rotasi), lalu dipindah ke koordinat lembar
    const lx = num(el.getAttribute('x')) + (anchor === 'middle' ? 0 : anchor === 'end' ? -w / (2 * sk) : w / (2 * sk))
    const ly = num(el.getAttribute('y')) - (fs * 0.9) / sk + h / (2 * sk)
    const c = pt(m, lx, ly)
    const b = { x: c.x - w / 2, y: c.y - h / 2, w, h }
    const algn = anchor === 'middle' ? 'ctr' : anchor === 'end' ? 'r' : 'l'
    const tx = `<xdr:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="t"/><a:lstStyle/><a:p><a:pPr algn="${algn}"/><a:r><a:rPr lang="id-ID" sz="${Math.max(100, Math.round(fs * 75))}"${bold ? ' b="1"' : ''} dirty="0">${fillXml(f)}<a:latin typeface="Calibri"/><a:cs typeface="Calibri"/></a:rPr><a:t>${esc(t)}</a:t></a:r></a:p></xdr:txBody>`
    return sp({ name: `Teks: ${t.slice(0, 28)}`, b, rot: Math.abs(rot) < 0.01 ? 0 : (rot + 360) % 360, geom: prst('rect'), fill: '<a:noFill/>', ln: '<a:ln><a:noFill/></a:ln>', tx, txBox: true })
  }
  function gambar(el, m) {
    const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
    const mm = href.match(/^data:[^;,]*;base64,(.+)$/)
    if (!mm) return null
    // jenis gambar dikenali dari isinya (tipe MIME pada data URL tidak selalu benar)
    const ext = mm[1].startsWith('iVBOR') ? 'png' : mm[1].startsWith('/9j/') ? 'jpeg' : mm[1].startsWith('R0lG') ? 'gif' : null
    if (!ext) return null
    images.push({ ext, base64: mm[1] })
    const rid = `rId${images.length}`, id = ++nid
    const o = pt(m, num(el.getAttribute('x')), num(el.getAttribute('y'))), w = num(el.getAttribute('width')) * m[0], h = num(el.getAttribute('height')) * m[3]
    const b = { x: o.x, y: o.y, w, h }
    return { b, xml: `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Gambar ${id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="${e(b.x)}" y="${e(b.y)}"/><a:ext cx="${e(b.w)}" cy="${e(b.h)}"/></a:xfrm>${prst('rect')}</xdr:spPr></xdr:pic>` }
  }

  // jalan di pohon SVG menurut urutan dokumen (urutan = tumpukan lapisan)
  function proses(el, m, g, hasil) {
    for (const k of el.children) {
      const tag = k.localName
      const mk = k.getAttribute('transform') ? mul(m, parseTransform(k.getAttribute('transform'))) : m
      const gk = gayaDari(k, g)
      if (tag === 'g') {
        const nama = k.getAttribute('data-xl')
        if (!nama) { proses(k, mk, gk, hasil); continue }
        const anak = []; proses(k, mk, gk, anak)
        if (anak.length) hasil.push(grup(nama, anak))
        continue
      }
      let r = null
      if (tag === 'line') r = garis(k, mk, gk)
      else if (tag === 'rect') r = persegi(k, mk, gk)
      else if (tag === 'circle') r = lingkaran(k, mk, gk)
      else if (tag === 'polygon') r = poligon([{ pts: (k.getAttribute('points') || '').trim().split(/\s+/).map((s) => { const [x, y] = s.split(',').map(Number); return pt(mk, x, y) }), closed: true }], mk, gk, 'Segitiga')
      else if (tag === 'path') r = poligon(jalurPath(k, mk), mk, gk, 'Bentuk')
      else if (tag === 'text') r = teks(k, mk, gk)
      else if (tag === 'image') r = gambar(k, mk)
      if (r) hasil.push(r)
    }
  }
  function grup(nama, anak) {
    const id = ++nid
    const xs0 = Math.min(...anak.map((a) => a.b.x)), ys0 = Math.min(...anak.map((a) => a.b.y))
    const xs1 = Math.max(...anak.map((a) => a.b.x + a.b.w)), ys1 = Math.max(...anak.map((a) => a.b.y + a.b.h))
    const b = { x: xs0, y: ys0, w: xs1 - xs0, h: ys1 - ys0 }
    const xf = `<a:off x="${e(b.x)}" y="${e(b.y)}"/><a:ext cx="${e(b.w)}" cy="${e(b.h)}"/><a:chOff x="${e(b.x)}" y="${e(b.y)}"/><a:chExt cx="${e(b.w)}" cy="${e(b.h)}"/>`
    return { b, xml: `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${id}" name="${esc(nama)}"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr><xdr:grpSpPr><a:xfrm>${xf}</a:xfrm></xdr:grpSpPr>${anak.map((a) => a.xml).join('')}</xdr:grpSp>` }
  }

  const atas = []
  proses(root, I, { fill: '#000', 'font-family': 'Calibri' }, atas)
  const anchors = atas.map((a) => `<xdr:absoluteAnchor><xdr:pos x="${e(a.b.x)}" y="${e(a.b.y)}"/><xdr:ext cx="${e(a.b.w)}" cy="${e(a.b.h)}"/>${a.xml}<xdr:clientData/></xdr:absoluteAnchor>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`
  return { xml, images, lebar, tinggi, jumlah: nid - 1 }
}
