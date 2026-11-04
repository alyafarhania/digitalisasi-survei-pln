// Proyek contoh (4 tiang di Klaten) untuk mencoba tampilan
const P = (lat, lng, o = {}) => ({ id: crypto.randomUUID(), lat, lng, jenisTiang: 'Tiang Beton 12M-350 daN+E', konduktor: 'AAAC 70 mm²', kondisi: 'Baru', peralatan: '', konsLama: '', konsBongkar: '', ...o })
export const demoProject = () => ({
  id: crypto.randomUUID(), kode: Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('') + 'x2',
  version: 0, nomor: 'PB-2026-001', nama: 'Budi Santoso', jenis: 'Pasang Baru', lokasi: 'Jl. Melati No. 12, Klaten', tarif: 'R1', daya: 1300, status: 'Draft',
  tanggal: new Date().toISOString().slice(0, 10), jalur: 'KONSTRUKSI JTM 3 FASA PADA TIANG BETON',
  points: [
    P(-7.70595, 110.60120, { nomor: 'T1' }), P(-7.70640, 110.60205, { nomor: 'T2' }), P(-7.70655, 110.60290, { nomor: 'T3' }),
    P(-7.70720, 110.60345, { nomor: 'T4', peralatan: 'Trafo 3 phasa 100 kVA YNyn0' }), P(-7.70790, 110.60410, { nomor: 'T5', kondisi: 'Eksisting' }),
  ],
  crossings: [{ id: crypto.randomUUID(), type: 'Jalan', lat: -7.70625, lng: 110.60165, label: 'Jl. Raya Klaten' }, { id: crypto.randomUUID(), type: 'SUTT', tinggi: '11', lat: -7.70688, lng: 110.60317, label: 'SUTT 150 kV' }],
  meta: { noGambar: '001/PLN/2026', skala: '1 : 500', perihal: 'Pasang Baru', digambar: '', diperiksa: '', diketahui: '', disetujui: '' },
  rabOpt: { harga: 'HSS', jenis: 'Total', asal: 'Gudang UP3' }, priceEdits: {}, labelPos: {}, foto: [],
})
