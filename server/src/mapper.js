// Pemetaan dokumen project (format klien/camelCase) <-> baris database
export const docFromRows = (p, titik) => ({
  id: p.id, kode: p.kode_project, nomor: p.nomor, nama: p.nama, jenis: p.jenis, lokasi: p.lokasi, tarif: p.tarif, daya: p.daya,
  status: p.status, jalur: p.jalur, version: p.version, updatedAt: p.updated_at,
  ...p.extra,
  points: titik.map((t) => ({
    id: t.id, lat: t.lat, lng: t.lng, nomor: t.nomor_tiang || '', jenisTiang: t.jenis_tiang || '', peralatan: t.jenis_peralatan || '',
    konduktor: t.jenis_konduktor || '', panjang: t.panjang_konduktor ?? '', kode: t.kode_manual ? undefined : t.konstruksi_baru || undefined,
    kodeManual: t.kode_manual ? t.konstruksi_baru || undefined : undefined, konsLama: t.konstruksi_lama || '', konsBongkar: t.konstruksi_bongkar || '',
    kondisi: { baru: 'Baru', eksisting: 'Eksisting', bongkar: 'Bongkar' }[t.kondisi], tinggi: t.tinggi_lintasan || '', sudut: t.sudut ?? 0,
  })),
})
const KOND = { Baru: 'baru', Eksisting: 'eksisting', Bongkar: 'bongkar' }
const EXTRA = ['meta', 'crossings', 'labelPos', 'rabOpt', 'priceEdits', 'tanggal']
export const extraOf = (d) => Object.fromEntries(EXTRA.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]))
export const titikRow = (t, i) => ({
  id: t.id, urutan: i, lat: t.lat, lng: t.lng, nomor_tiang: t.nomor || null, jenis_tiang: t.jenisTiang || null, jenis_peralatan: t.peralatan || null,
  jenis_konduktor: t.konduktor || null, panjang_konduktor: t.panjang === '' || t.panjang == null ? null : Number(t.panjang),
  konstruksi_baru: t.kodeManual || t.kode || null, kode_manual: !!t.kodeManual, konstruksi_lama: t.konsLama || null,
  konstruksi_bongkar: t.konsBongkar || null, kondisi: KOND[t.kondisi] || 'baru', tinggi_lintasan: t.tinggi === '' || t.tinggi == null ? null : String(t.tinggi), sudut: t.sudut ?? 0,
})
