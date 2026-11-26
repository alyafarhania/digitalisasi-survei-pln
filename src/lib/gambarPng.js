import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GambarSvg, W } from './gambarSvg'
import { buatSkema } from './skema'
import { petaAktif, petaDataUrl } from './petaOffline'

const keData = async (u) => { const r = await fetch(u); const b = await r.blob(); return new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b) }) }

// Markup SVG lembar penuh dengan logo, kompas, dan peta offline (latar) sebagai data URL — siap dijadikan PNG atau bentuk Excel.
export async function svgUntukFile(p) {
  const sk = buatSkema(p), po = petaAktif(p), bgUrl = po ? await petaDataUrl(po) : null
  let s = renderToStaticMarkup(createElement(GambarSvg, { p, sk, untukFile: true, bgUrl }))
  for (const u of ['/logo-pln.png', '/kompas.jpg']) s = s.split(u).join(await keData(u))
  return { markup: s, sk }
}

// Gambar skematik (lembar penuh) sebagai PNG data-URL. Dibuat dari data project, jadi tidak perlu halaman Gambar sedang dibuka.
export async function gambarPng(p, skala = 2) {
  const { markup: s, sk } = await svgUntukFile(p)
  const img = new Image()
  await new Promise((ok, gagal) => { img.onload = ok; img.onerror = () => gagal(new Error('Gagal membuat gambar')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) })
  const c = document.createElement('canvas'); c.width = W * skala; c.height = sk.H * skala
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}
