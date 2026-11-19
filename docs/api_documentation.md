# API Documentation — Survei Tambah Daya & Pasang Baru

Dokumen ini adalah **kontrak** antara frontend (Next.js, sudah jadi) dan backend (belum dibuat). Ditulis untuk **Backend Agent**:
implementasikan semua yang ada di sini sebagai Route Handler Next.js (`app/api/**/route.js`) di atas PostgreSQL, tanpa mengubah UI.

- Frontend memanggil API **hanya** lewat [`src/lib/api.js`](../src/lib/api.js) (`api.get/put/post/del`). Saat `NEXT_PUBLIC_DATA_MODE=live`
  panggilan itu memakai `fetch` ke alamat di bawah; saat `mock` (bawaan) dijawab oleh [`src/lib/mockServer.js`](../src/lib/mockServer.js).
- **`mockServer.js` adalah implementasi acuan** perilaku (versi, konflik 409, salin, hapus lunak, foto). Uji kontrak di
  [`tests/unit/mockServer.test.js`](../tests/unit/mockServer.test.js) dan E2E di [`tests/e2e`](../tests/e2e) dapat dipakai sebagai uji penerimaan: jalankan
  dengan `DATA_MODE=live` dan semuanya harus tetap hijau.
- Skema database awal: [`db/init/001_schema.sql`](../db/init/001_schema.sql) dan [`db/init/002_auth_audit.sql`](../db/init/002_auth_audit.sql).
  Impor data master dari Excel: [`scripts/import-master.mjs`](../scripts/import-master.mjs) (sudah ada, perlu disesuaikan ke kode backend).

## 1. Ketentuan umum

| Hal | Ketentuan |
|---|---|
| Base URL | Satu origin (nginx → Next.js). Semua jalur diawali `/api`. Tanpa CORS. |
| Format | JSON UTF-8 (`Content-Type: application/json`), kecuali unggah foto (biner). |
| Waktu | ISO 8601 UTC, mis. `2026-11-19T10:21:00.000Z`. Tanggal saja: `YYYY-MM-DD`. |
| Bahasa nama field | Campuran Indonesia/Inggris **harus persis seperti di dokumen ini** (frontend membaca nama field ini). |
| Autentikasi | Cookie sesi `HttpOnly; Secure; SameSite=Lax` (disarankan). Tanpa sesi → `401`. |
| Header khusus | `x-client-id` (UUID per perangkat, dikirim di setiap `PUT`/`POST`/`DELETE` project) dipakai agar siaran real time tidak dikirim balik ke pengirimnya. |
| Batas ukuran | JSON ≤ 5 MB, foto ≤ 8 MB (frontend sudah mengecilkan foto ke ≤ 1600 px JPEG). |
| Timeout klien | 12 dtk (30 dtk untuk foto). Respons lambat dianggap server tidak terjangkau → antrean offline. |
| Kapasitas | 10–50 pengguna, ± 500 survei (PRD). Tidak perlu cache terdistribusi. |
| Idempotensi | `PUT /proyek/:kode` dan unggah foto (`x-foto-id`) **harus idempoten**: klien mengulang bila jaringan putus. |

### 1.1 Format galat

```json
{ "error": "Pesan untuk manusia (Bahasa Indonesia)", "code": "KODE_MESIN" }
```

Frontend membaca `error` (ditampilkan) dan `status`; khusus `409` membaca `server` (lihat 4.3).

| Status | `code` | Kapan |
|---|---|---|
| 400 | `VALIDATION` | Body/parameter tidak valid (sertakan `fields: { nama: "wajib diisi" }` bila bisa). |
| 401 | `UNAUTHENTICATED` | Tidak ada/kedaluwarsa sesi. Frontend mengarahkan ke `/login`. |
| 403 | `FORBIDDEN` | Peran tidak punya izin (lihat matriks §2). |
| 403 | `PROJECT_LOCKED` | Mengubah project berstatus `Selesai` (Final). |
| 403 | `FORBIDDEN_TRANSITION` | Perpindahan status yang tidak diizinkan (mis. surveyor memfinalisasi). |
| 404 | `NOT_FOUND` | Project/foto tidak ada atau sudah dihapus. |
| 409 | `VERSION_CONFLICT` | `baseVersion` ≠ versi server (lihat 4.3). Body berisi `conflict: true, server: <dokumen>`. |
| 413 | `TOO_LARGE` | Melebihi batas ukuran. |
| 429 | `RATE_LIMITED` | (opsional) batasi `login` 10x/menit/IP. |
| 5xx | `INTERNAL` | Galat server. Klien akan mencoba lagi. |

## 2. Autentikasi & RBAC

Saat ini frontend memakai **login tiruan** ([`src/lib/auth.js`](../src/lib/auth.js)). Backend harus menggantinya dengan endpoint di bawah;
bentuk objek `user` **sama persis** dengan yang dipakai UI.

### 2.1 Peran dan izin

| Izin | admin | perencana | surveyor | manajer |
|---|:-:|:-:|:-:|:-:|
| `project:create` (buat, salin) | ✔ | ✔ | ✔ | ✖ |
| `project:edit:any` (ubah project siapa pun) | ✔ | ✔ | ✖ | ✖ |
| `project:edit` (ubah project **buatan sendiri**) | ✔ | ✔ | ✔ | ✖ |
| `project:finalize` | ✔ | ✔ | ✖ | ✖ |
| `project:reopen` (Final → Draft) | ✔ | ✔ | ✖ | ✖ |
| `project:delete` (hapus project mana pun) | ✔ | ✖ | ✖ | ✖ |
| `project:delete:own` (hapus **draft** buatan sendiri) | – | – | ✔ | ✖ |
| `project:export` | ✔ | ✔ | ✔ | ✔ |
| `audit:view` (lihat riwayat) | ✔ | ✔ | ✖ | ✔ |
| Membaca (list, detail, foto) | ✔ | ✔ | ✔ | ✔ |

Aturan turunan (harus **ditegakkan di server**, UI hanya menyembunyikan tombol):

1. Project berstatus `Selesai` **terkunci untuk semua peran** (tidak bisa diubah/ditambah foto/dihapus-foto) sampai `reopen`.
   Hanya admin yang boleh menghapus project Final.
2. "Milik sendiri" = `createdBy.id == user.id`. Project lama tanpa `createdBy` dianggap milik semua surveyor.
3. Pelaku pada `createdBy`, `finalizedBy`, `lastEditedBy`, dan `audit[].by` **selalu diambil dari sesi server**, bukan dari body klien
   (klien mengirimnya hanya agar mode mock bekerja — abaikan/timpa).
4. Waktu `createdAt`, `finalizedAt`, `lastEditedAt`, `audit[].at` diisi **jam server**.

### 2.2 Endpoint

#### `POST /api/auth/login`
Request `{ "email": "surveyor@pln.test", "password": "…" }` → `200`
```json
{ "user": { "id": "u-surveyor", "email": "surveyor@pln.test", "name": "Agus Santoso", "role": "surveyor" } }
```
`401 { error: "Email atau kata sandi salah.", code: "INVALID_CREDENTIALS" }` — pesan **sama** untuk email tak dikenal dan sandi salah. Set cookie sesi.
`role` ∈ `admin | perencana | surveyor | manajer`. Jangan mengembalikan `password`/hash.

#### `GET /api/auth/me` → `200 { user }` atau `401`. Dipanggil saat aplikasi dibuka untuk memulihkan sesi.
#### `POST /api/auth/logout` → `204`. Hapus cookie.

Akun demo (data awal, sandi di-hash di DB): `admin@pln.test`, `perencana@pln.test`, `surveyor@pln.test`, `surveyor2@pln.test`, `manajer@pln.test`
(sandi lihat [`src/lib/auth.js`](../src/lib/auth.js) — **jangan** dibawa ke produksi).

## 3. Data master (baca saja)

Dimuat sekali saat aplikasi dibuka, disalin ke perangkat (offline) dan dipakai klien untuk menghitung RAB dan memilih kode konstruksi.
Sumber: sheet `HARGA SATUAN` dan `KONSTRUKSI` pada Excel (impor manual oleh pengembang; **tanpa halaman admin**).

### `GET /api/master` → `200`
Disarankan `ETag` + `Cache-Control: no-cache` (klien boleh memakai `If-None-Match`). ± 400 KB, kompres gzip.

```jsonc
{
  "at": "2026-11-19T10:00:00.000Z",          // waktu master dibuat
  "tarif": ["R1","R2","R3","B1","B2","B3","I1","I2","I3","I4","P1","P2","P3"],
  "konstruksi": [ Konstruksi, … ],            // ± 333 kode
  "tiang":      [ Material, … ],              // dropdown "Jenis tiang"
  "peralatan":  [ Material, … ],              // dropdown "Jenis peralatan"
  "konduktor":  [ Konduktor, … ],             // dropdown "Jenis konduktor"
  "simbol": [], "aturan": []                  // boleh kosong → klien memakai bawaan src/lib/shared/symbols.js
}
```

**Konstruksi**
```jsonc
{ "grup": "KONSTRUKSI JTM 3 FASA PADA TIANG BETON",   // kelompok jaringan (dipakai sebagai project.jalur)
  "kode": "CC1",
  "desc": "Sudut 0º-10º",                              // uraian dari nama upah
  "smin": 0, "smax": 10,                               // rentang sudut BELOKAN (0° = lurus) dibaca dari nama kode; null bila tidak ada
  "items": [ { "u": "Isolator Tumpu ( Line Post ) 20 KV Polymer", "s": "Bh", "v": 3,   // uraian, satuan, volume per unit
               "hss": 235202, "khs": null, "gol": "MDU" } ],                          // harga (Rp) bisa null; gol: MDU|MDU-KD|HDW|JASA|NON MDU KHS
  "bongkar": { "u": "Upah Bongkar …", "s": "Unit", "hss": 500, "khs": null, "gol": "JASA" }   // null bila tidak ada
}
```
**Material** (`tiang`, `peralatan`): `{ nama, sat, gol, hss, khs, kelompok }`.
**Konduktor**: `{ nama, kelompok_garis: "JTM"|"JTR", fasa: 1|3, sat, gol, hss, khs, upah_pasang, upah_bongkar }`.
Harga `null` = belum ada di Excel (±194 baris KHS 2024 kosong, PRD §Risiko). **Jangan ubah `null` menjadi 0** — UI memakainya untuk mengunci ekspor RAB.

Kode jaringan yang dikenal (`project.jalur` / `Konstruksi.grup`): `KONSTRUKSI JTM 3 FASA PADA TIANG BETON`, `… TIANG BESI`, `KONSTRUKSI JTM 1 FASA PADA TIANG BETON`, `… TIANG BESI`, `SKUTM`, dan kelompok lain pada master.

Opsional (tidak dipakai UI saat ini, ada di server lama): `GET /api/master/konstruksi|tiang|peralatan|konduktor?q=`, `GET /api/simbol`.

## 4. Project

### 4.1 Dokumen project (`Project`)

Ini bentuk yang dikirim dan diterima frontend. **Server-owned** = klien boleh mengirim tetapi server menimpa.

```jsonc
{
  "id": "uuid-v4",                       // dibuat klien (agar bisa dibuat offline). PRIMARY KEY.
  "kode": "hgvpjnsax2",                  // kode project untuk tautan; ^[A-Za-z0-9_-]{8,32}$; unik; dibuat klien (10 huruf), server memvalidasi
  "nomor": "PB/2026/10/0053",            // nomor pekerjaan (diisi manual mengikuti penomoran kantor). Tidak harus unik.
  "nama": "PABRIK ROKOK HS PEDAN",       // wajib
  "jenis": "Pasang Baru",                // "Pasang Baru" | "Tambah Daya"
  "lokasi": "Jl. Pedan, Klaten",         // alamat
  "tarif": "R1",                         // dari master.tarif
  "daya": 53000,                         // VA, integer
  "status": "Draft",                     // "Draft" | "Selesai" (= Final). Lihat 4.5 untuk aturan perubahan.
  "jalur": "KONSTRUKSI JTM 3 FASA PADA TIANG BETON",   // Konstruksi.grup
  "tanggal": "2026-11-19",
  "version": 3,                          // SERVER-OWNED, naik 1 tiap simpan
  "updatedAt": "2026-11-19T10:21:00.000Z", // SERVER-OWNED

  "points":    [ Titik, … ],             // urutan array = urutan di jalur
  "crossings": [ Penyeberangan, … ],
  "meta": {                              // kotak judul gambar & data jaringan (semua string, boleh "")
    "noGambar": "", "skala": "1 : 500", "perihal": "Pasang Baru", "digambar": "", "diperiksa": "", "diketahui": "", "disetujui": "",
    "keterangan": "", "ulp": "ULP Klaten", "dayaLama": "", "feeder": "", "gi": "", "subsistem": ""
  },
  "rabOpt": { "harga": "HSS", "jenis": "Total", "asal": "Gudang UP3", "slo": true },
  "priceEdits": { "Tiang Beton 12M-350 daN+E": "5900000" },   // override harga satuan: kunci = uraian item, nilai = digit saja (Rp)
  "labelPos":   { "<point.id>": { "dx": 12.5, "dy": -4 } },    // geseran kotak keterangan gambar (px)
  "guide":      { "peta:selesai": true, "gambar:cek": true },  // centang panduan: "<langkah>:<id>" → boolean

  // ---- audit (SERVER-OWNED, lihat §2.1 aturan 3-4) ----
  "createdBy":    { "id": "u-surveyor", "name": "Agus Santoso", "role": "surveyor" },
  "createdAt":    "2026-11-18T08:00:00.000Z",
  "lastEditedBy": { "id": "u-perencana", "name": "Bagus Prasetyo", "role": "perencana" },
  "lastEditedAt": "2026-11-19T10:21:00.000Z",
  "finalizedBy":  { "id": "u-perencana", "name": "Bagus Prasetyo", "role": "perencana" },   // hanya ada bila status = Selesai
  "finalizedAt":  "2026-11-19T11:00:00.000Z",
  "audit": [ { "id": "uuid", "action": "created", "by": { "id": "…", "name": "…", "role": "…" }, "at": "…", "note": "opsional" } ]
}
```

**Titik** (`points[]`)
```jsonc
{ "id": "uuid", "lat": -7.70595, "lng": 110.6012,
  "nomor": "T1",                       // nomor tiang, diketik surveyor
  "jenisTiang": "Tiang Beton 12M-350 daN+E",   // master.tiang[].nama
  "peralatan": "",                     // master.peralatan[].nama atau ""
  "konduktor": "AAAC 70 mm²",          // master.konduktor[].nama
  "panjang": 50,                       // m; "" = pakai jarak antar titik dari peta
  "kode": "CC1",                       // kode konstruksi OTOMATIS dari sudut (dihitung klien)
  "kodeManual": "CC3",                 // bila pengguna menimpa kode otomatis; undefined bila tidak
  "konsLama": "", "konsBongkar": "",   // kode konstruksi lama / dibongkar (master.konstruksi[].kode)
  "kondisi": "Baru",                   // "Baru" | "Eksisting" | "Bongkar"
  "tinggi": "",                        // tinggi lintasan (string bebas)
  "sudut": 0 }                         // sudut BELOKAN 0–180 (0 = lurus); dihitung klien; sudut dalam = 180 − sudut
```
**Penyeberangan** (`crossings[]`): `{ "id": "uuid", "type": "Jalan"|"SUTT"|"Sungai", "lat": …, "lng": …, "label": "Jl. Raya Klaten", "tinggi": "11" }`
(`tinggi` hanya bermakna untuk `SUTT`, dalam meter).

> Backend **tidak perlu** menghitung `sudut`, `kode`, RAB, gambar, atau Excel — semuanya dihitung klien (agar jalan offline). Simpan apa adanya.

Pemetaan ke DB (acuan, boleh disesuaikan): kolom skalar → `proyek`; `meta, crossings, rabOpt, priceEdits, labelPos, guide, tanggal` → `proyek.extra` (JSONB);
`points[]` → `titik_tagging` (hapus lunak titik yang hilang dari array); `audit[]` → `audit_log` (append-only); pelaku → `created_by/finalized_by/last_edited_by` (JSONB).

### 4.2 `GET /api/proyek` — daftar & cari

Dipakai halaman Daftar untuk mencari project **yang belum ada di perangkat** (bagian "Ditemukan di server"); jumlah baris kecil. Respons **array JSON** (kompatibel dengan klien saat ini).

| Query | Tipe | Default | Keterangan |
|---|---|---|---|
| `q` | string | `""` | Cari tidak peka huruf besar pada `nama`, `nomor`, `lokasi`; cocok **persis** pada `kode`. Klien baru mengirim bila ≥ 2 huruf. |
| `status` | `draft` \| `final` | semua | Filter status (`Draft` / `Selesai`). |
| `jenis` | `Pasang Baru` \| `Tambah Daya` | semua | |
| `createdBy` | user id | semua | Project buatan pengguna tertentu. |
| `sort` | `baru` \| `lama` \| `nama` \| `nomor` \| `daya` | `baru` | `baru` = `updated_at` turun; `lama` = naik; `nama` A–Z (locale `id`); `nomor` natural sort; `daya` turun. |
| `limit` | int 1–100 | 100 | Ukuran halaman. |
| `cursor` | string (buram) | – | Untuk halaman berikutnya (muat bertahap/infinite scroll). |

Respons `200`: array **ringkasan** (tanpa `points`):
```json
[ { "kode": "hgvpjnsax2", "nomor": "PB-2026-001", "nama": "Budi Santoso", "jenis": "Pasang Baru", "lokasi": "Jl. Melati 12", "tarif": "R1", "daya": 1300,
    "status": "Draft", "version": 3, "updated_at": "2026-11-19T10:21:00.000Z", "titik": 5,
    "createdBy": { "id": "u-surveyor", "name": "Agus Santoso", "role": "surveyor" }, "createdAt": "…",
    "lastEditedBy": { … }, "lastEditedAt": "…", "finalizedBy": null, "finalizedAt": null } ]
```
Header: `X-Total-Count: <jumlah semua yang cocok>`, `X-Next-Cursor: <cursor>` (kosong bila habis). Project `deleted = true` tidak pernah muncul.
Urutan harus **stabil** (tambahkan `id` sebagai pemecah seri agar kursor tidak melompat).

> Catatan: Daftar utama di UI ("Project Survei") dibangun dari project yang tersimpan di **perangkat** (offline-first) dan
> menyaring/mengurutkan/memuat bertahap di klien. Filter cepat **Tersinkron / Belum tersinkron** adalah status lokal (`dirty`/`version`) dan **bukan** parameter API.

### 4.3 `GET /api/proyek/:kode` → `200 Project` · `404`

Dipakai saat membuka project dari tautan/kode (`/project/<kode>/<langkah>`), dari hasil pencarian server, dan untuk menarik versi terbaru. Sertakan `audit[]` penuh.

### 4.4 `PUT /api/proyek/:kode[?force=1]` — buat atau simpan (upsert, **optimistic concurrency**)

Dipanggil otomatis ± 0,7 dtk setelah perubahan dan saat tombol *Simpan*. Body = `Project` + `baseVersion`.

```jsonc
{ …Project…, "baseVersion": 3 }     // versi yang dipegang klien; 0 untuk project baru
```
Alur server (dalam satu transaksi, `SELECT … FOR UPDATE` pada baris project):

1. Validasi: `kode` cocok regex & sama dengan jalur, `id` UUID, `nama` tidak kosong, enum valid, `lat∈[-90,90]`, `lng∈[-180,180]`, ukuran array wajar (≤ 500 titik).
2. Belum ada → **buat** (`version = 1`). Izin `project:create`. Isi `createdBy/createdAt` dari sesi; buat `audit: created`.
3. Sudah ada:
   - Izin ubah (§2.1). Project `Selesai` → `403 PROJECT_LOCKED` (kecuali body ini adalah *buka kembali* yang sah, lihat 4.5).
   - **Bila `?force` tidak ada dan `baseVersion ≠ version` server → `409`** dan batalkan:
     ```json
     { "error": "Project diubah di perangkat lain", "code": "VERSION_CONFLICT", "conflict": true, "server": { …Project terbaru… } }
     ```
   - Selain itu simpan, `version = version + 1`, `updated_at = now()`, `lastEditedBy/At` dari sesi.
4. `?force=1` (pengguna memilih *Pakai versi saya*) melewati cek versi; tetap cek izin dan kunci Final.
5. Respons `200`: **Project lengkap terbaru** (klien memakai `version` dari sini).
6. Siarkan event SSE `proyek:diubah` (§6) ke pelanggan project tsb. kecuali pengirim (`x-client-id`).

Titik yang tidak ada lagi di array → ditandai `deleted` (hapus lunak). `id` titik dibuat klien (UUID).

### 4.5 Perubahan status (finalisasi & buka kembali)

Versi 1 (yang dipanggil frontend sekarang): klien mengirim `PUT` dengan `status: "Selesai"` (finalisasi) atau `status: "Draft"` (buka kembali)
dan menambahkan entri `audit` baru. **Server harus** menganggap ini *permintaan perubahan status* dan memvalidasinya sendiri:

| Dari → ke | Izin | Syarat lain | Server mencatat |
|---|---|---|---|
| `Draft` → `Selesai` | `project:finalize` | (disarankan) kelima langkah lengkap — UI sudah memblokir, server boleh ikut menolak `400 VALIDATION` | `finalizedBy/At`, audit `finalized` |
| `Selesai` → `Draft` | `project:reopen` | – | hapus `finalizedBy/At`, audit `reopened` |
| lainnya | – | – | `403 FORBIDDEN_TRANSITION` |

Entri `audit` dari klien **diabaikan**; server menulis sendiri (pelaku dari sesi, waktu dari jam server). Saat status berubah, isi lain pada body
tidak boleh sekaligus diubah pada project Final.
Opsional (v1.1): `POST /api/proyek/:kode/finalisasi` dan `POST /api/proyek/:kode/buka-kembali` (tanpa body, `200 Project`) — bila tersedia, beri tahu agar frontend beralih.

### 4.6 `DELETE /api/proyek/:kode` → `200 { "ok": true }`
Hapus **lunak** (`deleted = true`, `version + 1`), catat audit `deleted`. Izin: `project:delete`, atau `project:delete:own` bila milik sendiri **dan** `Draft`. Selain itu `403`. `404` bila tidak ada.
Foto ikut tidak terlihat. Siarkan event agar perangkat lain menutup project.

### 4.7 `POST /api/proyek/:kode/salin`
Body `{ "by": {…}, "at": "…" }` (diabaikan; pelaku dari sesi). Salin project (izin `project:create`; boleh menyalin project siapa pun yang bisa dibaca).
`200 Project` baru:

- `id` baru, `kode` baru (10 karakter acak), `version = 1`, `status = "Draft"`
- `nama = <nama> + " (salinan)"`, `nomor = <nomor> + "-SALIN"`
- semua `points[].id` baru; `guide = {}`; `foto` **tidak** disalin
- `createdBy/At` = penyalin; `lastEditedBy/At` sama; tanpa `finalizedBy/At`
- `audit = [ { action: "copied", note: "Salinan dari <nomor asal>" } ]`

### 4.8 `GET /api/proyek/:kode/audit` (opsional, izin `audit:view`)
`200` array `AuditEntry` terurut waktu naik. UI saat ini membaca `Project.audit` dari dokumen (tombol *Riwayat* hanya muncul untuk peran dengan `audit:view`),
jadi endpoint ini hanya perlu bila `audit` dihapus dari dokumen untuk peran tanpa izin — **sebaiknya** server menyaring `audit` keluar dari dokumen bagi peran tanpa `audit:view`.

`AuditEntry`: `{ id: uuid, action: "created"|"copied"|"finalized"|"reopened"|"deleted", by: {id,name,role}, at: ISO, note?: string }`. Tabel append-only.

## 5. Foto lokasi

Foto dikompres klien (JPEG ≤ 1600 px), disimpan di perangkat, lalu diunggah saat online (bisa tertunda; id dibuat klien).

| Endpoint | Detail |
|---|---|
| `POST /api/proyek/:kode/foto` | Body **biner** gambar. Header: `Content-Type: image/*`, `x-foto-id: <uuid>` (idempoten — id sama = timpa/abaikan), `x-foto-meta: {"id","by":{…},"at":"ISO","name":"foto.jpg"}` (JSON; `by` diabaikan → sesi). Izin: boleh mengubah project (project Final `403`). `200 { "id": "<uuid>" }`. ≤ 8 MB, hanya `image/jpeg|png|webp`. Siarkan event `{ kode, foto: true }`. |
| `GET /api/proyek/:kode/foto` | `200` array **berurutan waktu unggah**: `[ { "id": "uuid", "by": {id,name,role}, "at": "ISO", "name": "foto.jpg" } ]`. (Klien juga menerima array string id untuk kompatibilitas.) |
| `GET /api/foto/:id` | `200` bytes gambar, `Content-Type` sesuai, `Cache-Control: private, max-age=31536000, immutable`. `404` bila dihapus. Dipakai `<img src>` saat foto tak ada di perangkat. |
| `DELETE /api/foto/:id` | `200 { "ok": true }` hapus lunak. Izin sama dengan mengubah project; Final → `403`. |

## 6. Real time — `GET /api/events` (Server-Sent Events)

Menggantikan Socket.IO lama; mengganti isi [`src/lib/realtime.js`](../src/lib/realtime.js) dengan `EventSource`. nginx sudah menyiapkan lokasi ini tanpa buffering.

- Query `?kode=<kode>` (boleh berulang, atau `?kodes=a,b,c`) = project yang sedang dibuka/disimpan di perangkat. Wajib sesi.
- `Content-Type: text/event-stream`, kirim komentar `:keepalive` tiap 25 dtk.
- Event `proyek:diubah` (`data` JSON):
  ```json
  { "kode": "hgvpjnsax2", "version": 4, "from": "<x-client-id pengirim>" }
  ```
  `version` = versi baru. Klien mengabaikan bila `from` = dirinya, atau bila ia punya perubahan lokal (`dirty`; konflik diselesaikan saat kirim), atau `version ≤` miliknya; selain itu klien memanggil `GET /api/proyek/:kode`.
- Event foto: `{ "kode": "…", "foto": true, "from": "…" }` → klien memuat ulang `GET …/foto`.
- Event `deleted`: `{ "kode": "…", "deleted": true }` (disarankan; UI saat ini belum menangani, aman diabaikan).
- Backend multi-instance: gunakan `LISTEN/NOTIFY` PostgreSQL untuk meneruskan event antar instance.
- Status koneksi ditampilkan di pil "Tersinkron / Server belum terjangkau" — `GET /api/health` dipakai bersama SSE.

## 7. Health

`GET /api/health` → `200 { "ok": true }` (sudah ada di `app/api/health/route.js`; backend boleh memperluas dengan cek `SELECT 1`, tetapi respons tetap `{ ok: true }` saat sehat).
Dipakai klien (status online) dan `HEALTHCHECK` Docker.

## 8. Semantik sinkron offline-first (penting untuk backend)

1. **UUID dari klien.** `Project.id`, `points[].id`, `crossings[].id`, `foto.id`, `audit[].id` dibuat di perangkat — server menerimanya apa adanya (validasi format).
2. **Antrean.** Klien menandai project `dirty`, mengirim `PUT` bila online, dan mengulang sampai berhasil. Jangan menganggap satu `PUT` = satu aksi pengguna; boleh ada banyak per menit.
3. **Versi.** `version` naik 1 per simpan yang berhasil. Dua perangkat yang sama-sama mengubah dari versi `N` → yang kedua mendapat `409`; klien menampilkan pop-up pilih versi (*versi server* atau *versi saya* → `?force=1`).
4. **Hapus lunak.** Project, titik, dan foto tidak dihapus fisik (jejak audit & pemulihan). Project terhapus: `GET` → `404`, tidak muncul di daftar.
5. **Foto tertunda.** Foto hanya diunggah setelah project punya `version > 0` di server (klien menunggu project tersinkron lebih dulu); backend cukup membalas `404` bila project belum ada.
6. **Jam.** Jangan memercayai waktu perangkat; semua stempel waktu dari jam server.
7. **Satu sumber hitungan.** RAB, gambar skematik, dan Excel dihitung **di klien**; server tidak menyimpan hasilnya.

## 9. Ringkasan endpoint

| Metode | Jalur | Izin | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | publik | Masuk, set cookie sesi |
| GET | `/api/auth/me` | sesi | Pulihkan sesi |
| POST | `/api/auth/logout` | sesi | Keluar |
| GET | `/api/health` | publik | `{ ok: true }` |
| GET | `/api/master` | sesi | Seluruh data master |
| GET | `/api/proyek` | sesi | Cari/daftar ringkasan (filter, urut, paginasi) |
| GET | `/api/proyek/:kode` | sesi | Dokumen project lengkap |
| PUT | `/api/proyek/:kode[?force=1]` | create/edit | Upsert + versi + konflik 409 |
| DELETE | `/api/proyek/:kode` | delete/delete:own | Hapus lunak |
| POST | `/api/proyek/:kode/salin` | create | Salin project |
| GET | `/api/proyek/:kode/audit` | audit:view | Riwayat (opsional) |
| POST | `/api/proyek/:kode/foto` | edit | Unggah foto (biner) |
| GET | `/api/proyek/:kode/foto` | sesi | Daftar foto |
| GET | `/api/foto/:id` | sesi | Bytes foto |
| DELETE | `/api/foto/:id` | edit | Hapus foto |
| GET | `/api/events` | sesi | SSE real time |

## 10. Daftar periksa untuk Backend Agent

- [ ] Route handler Next.js di `app/api/**`, koneksi `pg` memakai `DATABASE_URL` (sudah diisi docker-compose).
- [ ] Tegakkan RBAC §2.1 di **semua** endpoint (jangan percaya UI); uji dengan kelima akun demo.
- [ ] `PUT` transaksional + `409` seperti §4.4; semua kolom audit dari sesi/jam server.
- [ ] Hapus lunak; indeks pada `proyek(status, updated_at)`; `audit_log` append-only.
- [ ] `GET /api/master` dari tabel hasil `scripts/import-master.mjs` (bentuk JSON persis §3, harga `null` dipertahankan).
- [ ] SSE `/api/events` (+ `LISTEN/NOTIFY` bila lebih dari satu instance).
- [ ] Ganti `DATA_MODE=live`, bangun ulang image, jalankan `npm run test:all` (unit + E2E) — semua harus hijau.
- [ ] Tambahkan uji kontrak API sendiri (mis. `tests/api/*.test.js`) memakai kasus di `tests/unit/mockServer.test.js` sebagai daftar skenario.
