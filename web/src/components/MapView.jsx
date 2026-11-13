import { DEMO } from '../lib/api'
// Pratinjau tanpa internet: ubin peta tiruan (jalan berbentuk kisi) agar peta tidak kosong.
const hash = (n) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; return (h % 1000) / 1000 }
function demoTile(z, x, y, sat) {
  const q = (a) => Math.round(40 + hash(a + z * 7) * 176)
  const hy = q(y * 31 + 5), vx = q(x * 17 + 11), big = hash(x * 3 + y * 5 + z) > 0.7
  const svg = sat
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#5B6B45"/><rect x="${vx - 60}" y="${hy + 8}" width="70" height="50" fill="${big ? '#3F5230' : '#8A7B6A'}"/><rect x="0" y="${hy - 4}" width="256" height="8" fill="#B8B2A4"/><rect x="${vx - 3}" y="0" width="6" height="256" fill="#B8B2A4"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#EEF1EA"/>` +
    (big ? `<rect x="${vx + 10}" y="${hy + 10}" width="90" height="70" fill="#D7E6C8"/>` : `<rect x="${vx - 70}" y="${hy + 8}" width="60" height="40" fill="#E3E6EC"/>`) +
    `<rect x="0" y="${hy - 5}" width="256" height="10" fill="#fff" stroke="#D6D9DE"/><rect x="${vx - 4}" y="0" width="8" height="256" fill="#fff" stroke="#D6D9DE"/></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
import { useEffect, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, Marker, Polyline, useMap, useMapEvents, CircleMarker, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Icon } from './ui'
import { isTajam } from '../store'
import { Sym, colorOf, symOfPoint, statusOf, lineSymOf } from '../lib/symbols'
import { getTile, LAYERS, MAX_ZOOM, getLayerPref, setLayerPref, getLabelPref, setLabelPref } from '../lib/offlineTiles'

const WARN = '#FF8A00'

// Lapisan tile: cek penyimpanan offline dulu, baru jaringan
function OfflineTiles({ layerKey }) {
  const map = useMap()
  useEffect(() => {
    const Layer = L.TileLayer.extend({
      createTile(coords, done) {
        const img = document.createElement('img')
        img.alt = ''; img.setAttribute('role', 'presentation')
        const url = this.getTileUrl(coords)
        getTile(url).then((blob) => {
          if (blob) {
            const o = URL.createObjectURL(blob)
            img.onload = () => { URL.revokeObjectURL(o); done(null, img) }
            img.onerror = () => done(null, img)
            img.src = o
          } else {
            img.onload = () => done(null, img); img.onerror = () => { img.removeAttribute('src'); img.style.opacity = 0; done(null, img) }
            img.src = DEMO ? demoTile(coords.z, coords.x, coords.y, layerKey === 'satelit') : url
          }
        })
        return img
      },
    })
    const def = LAYERS[layerKey]
    const layer = new Layer(def.url('{z}', '{x}', '{y}'), { maxZoom: MAX_ZOOM, maxNativeZoom: def.maxNative, attribution: def.attr })
    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, layerKey])
  return null
}


// Ikon + nama tempat (masjid, sekolah, pasar, toko, kantor, dll.) dari OpenStreetMap lewat Overpass, ditempel di atas satelit.
const POI_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const poiCache = new Map()
const poiGroup = (t) => {
  const a = t.amenity || '', sh = t.shop, tr = t.tourism, le = t.leisure
  if (/place_of_worship/.test(a)) return ['#7B5EA7', 'ibadah']
  if (/school|university|college|kindergarten|library/.test(a)) return ['#2F6DB5', 'sekolah']
  if (/hospital|clinic|doctors|pharmacy|dentist/.test(a)) return ['#D64545', 'kesehatan']
  if (/restaurant|cafe|fast_food|food_court|bar/.test(a)) return ['#E8862A', 'makan']
  if (sh || /marketplace|bank|atm|fuel/.test(a)) return ['#E8862A', 'toko']
  if (tr || t.historic) return ['#7B5EA7', 'wisata']
  if (le || /park|garden/.test(t.landuse || '')) return ['#2E9E5B', 'taman']
  return ['#5B6C7A', 'kantor']
}
function Poi({ on }) {
  const map = useMap()
  useEffect(() => {
    if (!on || DEMO) return
    const grup = L.layerGroup().addTo(map)
    map.attributionControl?.addAttribution('Nama tempat © OpenStreetMap')
    let timer, ctl
    const muat = async () => {
      if (map.getZoom() < 15) { grup.clearLayers(); return }
      const b = map.getBounds().pad(0.1), r = (v) => v.toFixed(3)
      const key = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(r).join(',')
      let els = poiCache.get(key)
      if (!els) {
        ctl?.abort(); ctl = new AbortController()
        const bb = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`
        const q = `[out:json][timeout:20];(nwr["name"][~"^(amenity|shop|tourism|leisure|office|historic)$"~"."](${bb});nwr["name"]["place"~"^(village|hamlet|suburb|neighbourhood|town|locality|quarter)$"](${bb});way["name"]["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|living_street)$"](${bb}););out center 400;`
        for (const u of POI_URLS) {
          try {
            const res = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal })
            if (!res.ok) continue
            els = (await res.json()).elements || []; poiCache.set(key, els); break
          } catch (e) { if (e.name === 'AbortError') return }
        }
      }
      grup.clearLayers()
      ;(els || []).forEach((e) => {
        const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon, nama = e.tags?.name
        if (lat == null || lng == null || !nama) return
        const t = e.tags, jenis = t.place ? 'place' : t.highway && !t.amenity && !t.shop && !t.tourism ? 'road' : 'poi'
        const [c] = poiGroup(t)
        L.marker([lat, lng], { interactive: false, keyboard: false, zIndexOffset: -500, icon: L.divIcon({
          className: 'poi-wrap', iconSize: [10, 10], iconAnchor: [5, 5],
          html: jenis === 'poi' ? `<span class="poi-dot" style="background:${c}"></span><span class="poi-name">${nama.replace(/[<>&]/g, '')}</span>` : `<span class="poi-${jenis}">${nama.replace(/[<>&]/g, '')}</span>`,
        }) }).addTo(grup)
      })
    }
    const jadwal = () => { clearTimeout(timer); timer = setTimeout(muat, 600) }
    map.on('moveend', jadwal); jadwal()
    return () => { clearTimeout(timer); ctl?.abort(); map.off('moveend', jadwal); map.attributionControl?.removeAttribution('Nama tempat © OpenStreetMap'); map.removeLayer(grup) }
  }, [map, on])
  return null
}

// Pin merah hasil pencarian lokasi
const pinIcon = (nama) => L.divIcon({
  className: 'pin-wrap',
  html: `<div class="pin-cari"><svg width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7 0 15.6 0 27 16 42 16 42s16-15 16-26.4C32 7 24.8 0 16 0z" fill="#E11D2E" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15.5" r="5.5" fill="#fff"/></svg>${nama ? `<span>${nama.replace(/[<>&]/g, '')}</span>` : ''}</div>`,
  iconSize: [32, 42], iconAnchor: [16, 42],
})

const poleIcon = (p, sel) => {
  const c = colorOf(p.kondisi)
  const svg = renderToStaticMarkup(<svg width="34" height="34" viewBox="-17 -17 34 34"><Sym t={symOfPoint(p)} s={statusOf(p.kondisi)} k={1.25} /></svg>)
  return L.divIcon({ className: 'pole-wrap', html: `<div class="pole ${sel ? 'sel' : ''}">${svg}<span style="background:${c}">${p.nomor || ''}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] })
}
const crossIcon = (type) =>
  L.divIcon({ className: 'pole-wrap', html: `<div class="cross ${type}">${type === 'SUTT' ? '⚡' : type === 'Sungai' ? '≈' : '═'}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] })

function Clicker({ onMap }) { useMapEvents({ click: (e) => onMap(e.latlng) }); return null }
function Fly({ target }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo([target.lat, target.lng], target.zoom || 17, { duration: 0.8 }) }, [target, map])
  return null
}
// Peta menyesuaikan ukuran saat wadahnya melebar/menyempit (tombol Perlebar peta, putar layar, dll.)
function AutoSize() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer(), ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}
function Bridge({ mapRef }) { mapRef.current = useMap(); return null }
function LayerSwitch({ value, onChange, label, onLabel }) {
  return (
    <div className="map-layer" role="group" aria-label="Tampilan peta">
      {Object.entries(LAYERS).map(([k, l]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l.nama}</button>
      ))}
      {value === 'satelit' && <button className={label ? 'on' : ''} onClick={() => onLabel(!label)} title="Tampilkan nama tempat, jalan, dan kampung di atas satelit">Nama tempat</button>}
    </div>
  )
}
function Zoom() {
  const map = useMap()
  return (
    <div className="map-zoom">
      <button onClick={() => map.zoomIn()} aria-label="Perbesar"><Icon n="plus" /></button>
      <button onClick={() => map.zoomOut()} aria-label="Perkecil"><Icon n="minus" /></button>
    </div>
  )
}

export default function MapView({ project, selected, onSelect, mode, running, onAddPoint, onAddCross, onDelete, onMove, fly, gpsPos, areaCircle, mapRef, pin }) {
  const [label, setLabel] = useState(getLabelPref)
  const pilihLabel = (v) => { setLabel(v); setLabelPref(v) }
  const [layerKey, setLayerKey] = useState(getLayerPref)
  const pilihLayer = (k) => { setLayerKey(k); setLayerPref(k) }
  const pts = project.points
  const center = pts[0] ? [pts[0].lat, pts[0].lng] : [-7.7059, 110.6016]
  const onMap = (ll) => {
    if (!running) return
    if (mode === 'titik') onAddPoint(ll)
    if (mode === 'silang') onAddCross(ll)
  }
  return (
    <MapContainer center={center} zoom={17} maxZoom={MAX_ZOOM} zoomControl={false} className="map">
      <OfflineTiles layerKey={layerKey} />
      <AutoSize />
      <Poi on={layerKey === 'satelit' && label} />
      <LayerSwitch value={layerKey} onChange={pilihLayer} label={label} onLabel={pilihLabel} />
      <Bridge mapRef={mapRef} />
      <Clicker onMap={onMap} />
      <Fly target={fly} />
      <Zoom />
      {areaCircle && <Circle center={[areaCircle.lat, areaCircle.lng]} radius={areaCircle.r} pathOptions={{ color: '#0B6AA6', weight: 1.5, dashArray: '6 6', fillOpacity: 0.05 }} />}
      {pts.slice(1).map((p, i) => {
        const warn = isTajam(project, p) || isTajam(project, pts[i])
        const c = colorOf(p.kondisi)
        return (
          <Polyline key={'l' + p.id} positions={[[pts[i].lat, pts[i].lng], [p.lat, p.lng]]}
            pathOptions={{ color: warn ? WARN : c, weight: warn ? 6 : 4, dashArray: p.kondisi === 'Bongkar' ? '2 8' : lineSymOf(p.konduktor) === 'jtm1' ? '10 6' : undefined }} />
        )
      })}
      {pts.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={poleIcon(p, selected === p.id)} draggable={!!onMove}
          eventHandlers={{ click: (e) => { e.originalEvent?.stopPropagation?.(); mode === 'hapus' && running ? onDelete(p.id) : onSelect(p.id) }, dragend: (e) => onMove && onMove(p.id, e.target.getLatLng()) }} />
      ))}
      {project.crossings.map((c) => (
        <Marker key={c.id} position={[c.lat, c.lng]} icon={crossIcon(c.type)} draggable={!!onMove} eventHandlers={{ click: () => mode === 'hapus' && onDelete(c.id, true), dragend: (e) => onMove && onMove(c.id, e.target.getLatLng(), true) }} />
      ))}
      {pin && <Marker position={[pin.lat, pin.lng]} icon={pinIcon(pin.nama)} zIndexOffset={1000} />}
      {gpsPos && <CircleMarker center={[gpsPos.lat, gpsPos.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#0B6AA6', fillOpacity: 1 }} />}
    </MapContainer>
  )
}