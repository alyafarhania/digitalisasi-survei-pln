# Survei Tambah Daya & Pasang Baru

Survei di HP, gambar skematik dan RAB jadi otomatis, hasilnya diunduh sebagai Excel.
Untuk divisi Perencanaan PT PLN (Persero) UP3 Klaten. Acuan kebutuhan: `PRD Web Survei Tambah Daya dan Pasang Baru.pdf`.

## Stack (satu bahasa, satu aplikasi)

| Lapisan | Pakai apa |
|---|---|
| Aplikasi | **Next.js 15** (App Router) + React 19, JavaScript |
| Database | **PostgreSQL 16** (Docker) |
| Gerbang | **nginx** (reverse proxy, gzip, cache aset, siap HTTPS) |
| Peta | Leaflet, OpenStreetMap + Esri satelit, tile offline di IndexedDB |
| Excel | ExcelJS (dibuat di perangkat, jalan juga saat offline) |

## Tahap pengerjaan

**Tahap 1 (sekarang): UI/UX dengan data MOCK.** Seluruh alur F1–F9 jalan di browser:
data master dibaca dari `public/mock/master.json` (dibangun dari Excel), project disimpan di `localStorage`
lewat "server tiruan" (`src/lib/mockServer.js`) yang meniru kontrak API (versi, konflik 409, kode project, salin, cari).
Real time antar tab memakai BroadcastChannel (`src/lib/realtime.js`).
PostgreSQL sudah berjalan di Docker dengan skema terpasang, tapi belum dipakai aplikasi.

**Tahap 2: backend.** Buat route handler `app/api/**` yang memakai `DATABASE_URL`, ganti isi `realtime.js` dengan SSE
(`/api/events`, nginx sudah disiapkan), jalankan `scripts/import-master.mjs` untuk mengisi master ke PostgreSQL,
lalu set `DATA_MODE=live`. Tidak ada kode UI yang perlu diubah: semua panggilan lewat `src/lib/api.js`.

## Menjalankan

```bash
cp .env.example .env          # isi DB_PASSWORD
docker compose up --build -d
```
Buka **http://localhost:8080** (ubah `HTTP_PORT` di `.env` bila port bentrok).
Lihat isi database (opsional): `docker compose --profile tools up -d` lalu http://localhost:8081.

Tanpa Docker (pengembangan):
```bash
npm install
npm run dev                   # http://localhost:3000
npm run mock:build            # bangun ulang master.json dari data/*.xlsx
```

### Dipakai di HP
GPS dan mode offline (service worker) butuh **HTTPS**. Taruh `fullchain.pem` dan `privkey.pem` di `nginx/certs/`,
lalu aktifkan blok HTTPS di `nginx/nginx.conf`. Sebelum berangkat, unduh peta area survei di menu **Offline & Sinkron**.

## Masuk, peran (RBAC mock), dan audit

Halaman **/login** memakai akun tiruan. Ketuk akun demo di halaman login untuk mengisi otomatis.

| Peran | Email | Sandi | Boleh |
|---|---|---|---|
| Admin UP3 | `admin@pln.test` | `admin123` | semuanya, termasuk hapus project mana pun dan lihat riwayat |
| Perencana | `perencana@pln.test` | `perencana123` | ubah semua project, finalisasi, buka kembali, ekspor, riwayat |
| Surveyor | `surveyor@pln.test` / `surveyor2@pln.test` | `surveyor123` | buat/salin, ubah dan hapus (draft) **buatan sendiri**, ekspor |
| Manajer | `manajer@pln.test` | `manajer123` | hanya lihat, ekspor, riwayat |

Project **Final** terkunci untuk semua peran sampai dibuka kembali. Setiap project mencatat **dibuat oleh**, **difinalisasi oleh**, dan **terakhir diubah oleh**
(tampil di kartu daftar) beserta riwayat lengkap (tombol *Riwayat*). Matriks izin lengkap: [docs/api_documentation.md](docs/api_documentation.md#2-autentikasi--rbac).

## Tes

```bash
npm test                 # 224 tes unit (Vitest): RAB, geometri, langkah, RBAC, audit, store, server tiruan, master
npx playwright install chromium    # sekali
npm run test:e2e         # 100+ tes end-to-end (Playwright, desktop + HP): login, RBAC, daftar, alur 5 langkah, RAB, foto, routing, audit
npm run test:all         # keduanya
E2E_BASE_URL=http://localhost:8080 npm run test:e2e   # uji server Docker yang sedang jalan
```
Atau `make test`, `make e2e`, `make e2e-docker`.

## Dokumentasi

- [docs/RUN_WINDOWS.md](docs/RUN_WINDOWS.md) — menjalankan di Windows langkah demi langkah (Docker dan tanpa Docker, tes, masalah umum)
- [docs/api_documentation.md](docs/api_documentation.md) — kontrak API untuk Backend Agent (endpoint, filter, skema, RBAC, sinkron offline)

## Alamat halaman

| Alamat | Halaman |
|---|---|
| `/` | Daftar project (cari, filter, urutkan; `?q=&status=&sort=` ikut tersimpan di URL) |
| `/project/baru` | Project baru |
| `/project/<kode>/data` · `peta` · `gambar` · `rab` · `ekspor` | Lima langkah kerja |
| `/offline` | Offline & Sinkron |
| `/login` | Masuk (mock) |

Link ke project (`/project/<kode>/data`) bisa dibagikan; link lama `#/p/<kode>` tetap dialihkan. Aplikasi dipasang di `app/layout.jsx`
agar tidak dimuat ulang saat pindah halaman.

## Struktur

```
app/            halaman Next.js (layout, manifest PWA, /api/health)
src/App.jsx     cangkang aplikasi + navigasi alur kerja
src/views/      Data, Peta, Gambar, RAB, Project, Offline, Ekspor
src/components/ peta (Leaflet), panel atribut titik, komponen UI
src/lib/        hitungan RAB, gambar skematik, ekspor Excel, tile offline, API + mock
src/lib/shared/ geometri, RAB, simbol (dipakai klien dan nanti backend)
db/init/        skema PostgreSQL (dijalankan otomatis saat volume baru)
scripts/        build-mock-master.mjs, import-master.mjs (tahap 2)
nginx/          konfigurasi nginx
data/           Excel sumber data harga dan konstruksi
```

## Aturan yang diterapkan dari PRD (dan asumsinya)

- Ekspor RAB **terkunci** bila ada item tanpa harga (Rp0) pada pilihan harga yang aktif, baik KHS maupun HSS.
  PRD belum memutuskan apakah HSS kosong juga mengunci; dipilih terkunci agar RAB tidak keliru.
- Sudut terlalu tajam: batas = sudut maksimum standar konstruksi pada jenis jaringan (dibaca dari nama kode di master).
  Garis diberi warna **oranye** agar tidak tertukar dengan merah = konstruksi baru.
- Radius unduhan peta offline: 2–5 km (zoom dekat dibatasi 1 km).
- Tanpa login: siapa pun yang punya link/kode project dapat membuka dan mengubahnya.
