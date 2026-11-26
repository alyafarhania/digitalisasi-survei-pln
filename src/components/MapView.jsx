import { useEffect, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MapContainer, Marker, Polyline, Pane, ImageOverlay, useMap, useMapEvents, CircleMarker, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Icon } from './ui'
import { isTajam } from '../store'
import { Sym, colorOf, symOfPoint, statusOf, lineSymOf, C_BONGKAR } from '../lib/symbols'
import { getTile, LAYERS, MAX_ZOOM, getLayerPref, setLayerPref } from '../lib/offlineTiles'

const WARN = '#FF8A00'

// Ukuran marker mengikuti zoom: penuh (seperti semula) pada zoom 17 ke atas, makin kecil saat zoom out
// (faktor 2^(0,45 per tingkat)) supaya titik tidak memenuhi peta. Batas bawah 0,28 agar tetap terlihat.
export const ZOOM_PENUH = 17
export const skalaMarker = (z) => Math.max(0.28, Math.min(1, 2 ** ((z - ZOOM_PENUH) * 0.45)))
// Jalur pembongkaran (ungu) digambar sejajar dan sedikit di atas (utara) jalur pemasangan (merah): selisih tetap dalam piksel layar,
// ikut mengecil bersama marker saat zoom out. Koordinat titik aslinya tidak berubah.
export const GESER_BONGKAR_PX = 16
export const geserBongkarLat = (z, lat) => (GESER_BONGKAR_PX * skalaMarker(z) * (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z) / 110574

// Lapisan tile: cek penyimpanan offline dulu, baru jaringan. Tidak dipasang saat peta offline unggahan dipakai.
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
            img.src = url
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

// Pin merah hasil pencarian lokasi + nama tempat yang dicari. Satu-satunya nama yang tampil di peta.
const esc = (t) => String(t).replace(/[<>&"]/g, '')
const pinIcon = (nama) => L.divIcon({
  className: 'pin-wrap',
  html: `<div class="pin-cari"><svg width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7 0 15.6 0 27 16 42 16 42s16-15 16-26.4C32 7 24.8 0 16 0z" fill="#E11D2E" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15.5" r="5.5" fill="#fff"/></svg>${nama ? `<span>${esc(nama)}</span>` : ''}</div>`,
  iconSize: [32, 42], iconAnchor: [16, 42],
})

const poleIcon = (p, sel, s = 1) => {
  const c = colorOf(p.kondisi), size = Math.max(10, Math.round(34 * s)), n = (p.konsBaru || []).length
  const svg = renderToStaticMarkup(<svg width={size} height={size} viewBox="-17 -17 34 34"><Sym t={symOfPoint(p)} s={statusOf(p.kondisi)} k={1.25} /></svg>)
  const label = s >= 0.45 && p.nomor
    ? `<span style="background:${c};font-size:${(11 * s).toFixed(1)}px;padding:${(1 * s).toFixed(1)}px ${(6 * s).toFixed(1)}px;top:${Math.round(-14 * s)}px;border-radius:${Math.round(5 * s)}px">${esc(p.nomor)}</span>` : ''
  const badge = n && s >= 0.6 ? `<i class="pole-kb" style="font-size:${(9.5 * s).toFixed(1)}px;min-width:${Math.round(15 * s)}px;height:${Math.round(15 * s)}px">+${n}</i>` : ''
  return L.divIcon({ className: 'pole-wrap', html: `<div class="pole ${sel ? 'sel' : ''}" style="width:${size}px;height:${size}px">${svg}${label}${badge}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}
const crossIcon = (type, s = 1) => {
  const size = Math.max(10, Math.round(26 * s))
  return L.divIcon({ className: 'pole-wrap', html: `<div class="cross ${type}" style="width:${size}px;height:${size}px;font-size:${(13 * s).toFixed(1)}px;border-radius:${Math.round(6 * s)}px">${type === 'SUTT' ? '⚡' : type === 'Sungai' ? '≈' : '═'}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function Clicker({ onMap }) { useMapEvents({ click: (e) => onMap(e.latlng) }); return null }
function Fly({ target }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo([target.lat, target.lng], target.zoom || 17, { duration: 0.8 }) }, [target, map])
  return null
}
// Pas-kan tampilan ke gambar peta offline saat dipilih/diganti (bukan tiap kali skala diubah)
function FitOffline({ id, bounds }) {
  const map = useMap()
  useEffect(() => { if (id && bounds) map.fitBounds(bounds, { padding: [16, 16], animate: false }) }, [id]) // eslint-disable-line
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
function ZoomWatch({ onZoom }) {
  const map = useMap()
  useEffect(() => { onZoom(map.getZoom()) }, [map]) // eslint-disable-line
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  return null
}
function Bridge({ mapRef }) { mapRef.current = useMap(); return null }
function LayerSwitch({ value, onChange }) {
  return (
    <div className="map-layer" role="group" aria-label="Tampilan peta">
      {Object.entries(LAYERS).map(([k, l]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l.nama}</button>
      ))}
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

// offline = { id, url, bounds } : gambar peta offline unggahan yang menggantikan peta online (url null = belum terbaca)
// jalur = jalur yang sedang dikerjakan ('baru' merah | 'bongkar' ungu)
export default function MapView({ project, selected, onSelect, mode, running, onAddPoint, onAddCross, onDelete, onMove, fly, gpsPos, areaCircle, mapRef, pin, offline, kalibrasi, onKalibrasi, calPts = [], jalur = 'baru' }) {
  const [layerKey, setLayerKey] = useState(getLayerPref)
  const pilihLayer = (k) => { setLayerKey(k); setLayerPref(k) }
  const [zoom, setZoom] = useState(ZOOM_PENUH)
  const s = skalaMarker(zoom)
  const pts = project.points, ptsB = project.pointsBongkar || []
  const first = pts[0] || ptsB[0]
  const center = first ? [first.lat, first.lng] : [-7.7059, 110.6016]
  const dLat = geserBongkarLat(zoom, first ? first.lat : -7.7)
  const gb = (q) => [q.lat + dLat, q.lng]
  // saat menambah titik, marker jalur lain tidak menangkap ketukan supaya titik baru bisa diletakkan tepat di atasnya
  const bisaKlik = (j) => jalur === j || !(running && mode === 'titik')
  const onMap = (ll) => {
    if (kalibrasi) return onKalibrasi?.(ll)
    if (!running) return
    if (mode === 'titik') onAddPoint(ll)
    if (mode === 'silang') onAddCross(ll)
  }
  return (
    <MapContainer center={center} zoom={17} maxZoom={MAX_ZOOM} zoomControl={false} className={`map ${offline ? 'map-offline' : ''}`}>
      {!offline && <OfflineTiles layerKey={layerKey} />}
      {offline && (
        <>
          <Pane name="petaoffline" style={{ zIndex: 250 }}>{offline.url && <ImageOverlay url={offline.url} bounds={offline.bounds} />}</Pane>
          <FitOffline id={offline.id} bounds={offline.bounds} />
        </>
      )}
      <AutoSize />
      <ZoomWatch onZoom={setZoom} />
      {!offline && <LayerSwitch value={layerKey} onChange={pilihLayer} />}
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
            pathOptions={{ color: warn ? WARN : c, weight: Math.max(1.5, (warn ? 6 : 4) * s), dashArray: p.kondisi === 'Bongkar' ? '2 8' : lineSymOf(p.konduktor) === 'jtm1' ? '10 6' : undefined }} />
        )
      })}
      {ptsB.slice(1).map((p, i) => <Polyline key={'bl' + p.id} positions={[gb(ptsB[i]), gb(p)]} pathOptions={{ color: C_BONGKAR, weight: Math.max(1.5, 4 * s), dashArray: lineSymOf(p.konduktor) === 'jtm1' ? '10 6' : undefined }} interactive={false} />)}
      {pts.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={poleIcon(p, selected === p.id, s)} draggable={!!onMove} interactive={bisaKlik('baru')}
          eventHandlers={{ click: (e) => { e.originalEvent?.stopPropagation?.(); mode === 'hapus' && running ? onDelete(p.id) : onSelect(p.id) }, dragend: (e) => onMove && onMove(p.id, e.target.getLatLng()) }} />
      ))}
      {ptsB.map((p) => (
        <Marker key={p.id} position={gb(p)} icon={poleIcon({ ...p, kondisi: 'Bongkar' }, selected === p.id, s)} draggable={!!onMove} interactive={bisaKlik('bongkar')} zIndexOffset={200}
          eventHandlers={{ click: (e) => { e.originalEvent?.stopPropagation?.(); mode === 'hapus' && running ? onDelete(p.id) : onSelect(p.id) }, dragend: (e) => { const ll = e.target.getLatLng(); onMove && onMove(p.id, { lat: ll.lat - dLat, lng: ll.lng }) } }} />
      ))}
      {project.crossings.map((c) => (
        <Marker key={c.id} position={[c.lat, c.lng]} icon={crossIcon(c.type, s)} draggable={!!onMove} eventHandlers={{ click: () => mode === 'hapus' && onDelete(c.id, true), dragend: (e) => onMove && onMove(c.id, e.target.getLatLng(), true) }} />
      ))}
      {calPts.map((q, i) => <CircleMarker key={i} center={[q.lat, q.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#E11D2E', fillOpacity: 1 }} />)}
      {calPts.length === 2 && <Polyline positions={calPts.map((q) => [q.lat, q.lng])} pathOptions={{ color: '#E11D2E', weight: 2, dashArray: '6 6' }} />}
      {pin && <Marker position={[pin.lat, pin.lng]} icon={pinIcon(pin.nama)} zIndexOffset={1000} />}
      {gpsPos && <CircleMarker center={[gpsPos.lat, gpsPos.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#0B6AA6', fillOpacity: 1 }} />}
    </MapContainer>
  )
}
