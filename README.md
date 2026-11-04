# Sistem Perencanaan Pasang Baru dan Tambah Daya — PLN UP3 Klaten

Web survei lapangan (HP) + gambar skematik + RAB otomatis. Node.js (Express) + PostgreSQL + React (Vite), PWA offline, real time (Socket.IO).

## A. Cara termudah di Windows (Docker) — dari nol

1. **Pasang Docker Desktop**: unduh dari https://www.docker.com/products/docker-desktop, install (centang *WSL 2*), restart laptop bila diminta, lalu buka Docker Desktop sampai statusnya *Running*.
2. **Ekstrak** file ZIP proyek ini, misalnya ke `C:\pln2`.
3. Buka **PowerShell**: klik Start, ketik `powershell`, Enter. Lalu:
   ```
   cd C:\pln2
   docker compose up --build
   ```
   Pertama kali butuh beberapa menit (mengunduh PostgreSQL, Node, dll). Tunggu sampai muncul tulisan `API siap di :3000`. **Jangan tutup jendela ini.**
4. Buka **PowerShell kedua**, impor data master dari Excel (sekali saja):
   ```
   cd C:\pln2
   docker compose run --rm api npm run import -- /data/KKP_PB_53_KVA_PABRIK_ROKOK_HS.xlsx
   ```
   Tunggu ringkasan jumlah material dan konstruksi. Untuk Excel lain: taruh di folder `data\` lalu ganti nama file.
5. Buka browser: **http://localhost:8080**. Klik *Coba dengan project contoh* untuk mencoba.
6. Berhenti: `Ctrl+C` di jendela pertama, atau `docker compose down`. Data tetap tersimpan. Jalankan lagi dengan `docker compose up`.

Alamat lain: pengelola database (Adminer) di http://localhost:8081 (sistem: PostgreSQL, server: `db`, user `pln`, password `pln`, database `pln`).

## B. Dipakai dari HP
- HP dan laptop satu Wi-Fi. Cari IP laptop dengan `ipconfig` (IPv4, mis. `192.168.1.20`), buka `http://192.168.1.20:8080` di HP. Izinkan port 8080 di Windows Firewall bila diminta.
- **GPS dan mode offline (service worker) di HP hanya jalan lewat HTTPS.** Untuk pemakaian lapangan, pasang di server kantor dengan HTTPS (mis. di belakang reverse proxy/Cloudflare Tunnel). Di laptop lewat `localhost` sudah berfungsi.
- Sebelum berangkat: buka project → **Peta Offline** → pilih radius (2/3/5 km) → Unduh, saat masih ada sinyal.

## C. Tanpa Docker (untuk mengembangkan)
Butuh Node.js 22 LTS (https://nodejs.org) dan PostgreSQL 16 dengan database `pln` (user `pln`, password `pln`).
```
cd server
npm install
npm run import -- ..\data\KKP_PB_53_KVA_PABRIK_ROKOK_HS.xlsx
npm run dev          # API di :3000

cd ..\web            # terminal baru
npm install
npm run dev          # web di http://localhost:5173
```
Variabel `DATABASE_URL` mengatur koneksi database (default `postgres://pln:pln@localhost:5432/pln`).

## D. Struktur folder
- `server/` API Express, `sql/schema.sql`, `scripts/import.js` (impor Excel)
- `web/` aplikasi React (`src/pages` halaman, `src/components`, `src/lib`)
- `shared/` kode yang dipakai bersama: simbol, geometri, perhitungan RAB (`rab.js`)
- `data/` tempat file Excel master

## E. Yang perlu Anda konfirmasi
1. Warna **eksisting**: dipakai ungu tua (#3B1D6E) sesuai permintaan; PRD menyebut hitam. Ubah di `shared/symbols.js` (`C_EKS`).
2. Sudut terlalu tajam digambar **oranye** (merah sudah dipakai untuk "baru"). Batas = sudut maksimum kode konstruksi pada grup jalur tersebut.
3. Pemetaan upah AAAC ke A3C (dan AAAC/S ke A3CS) adalah dugaan; cek hasil RAB penghantar.
4. Aturan simbol schoor/pembetonan dan jenis tiang besi belum pasti (tiang besi tidak ada di HARGA SATUAN).
5. Pop-up konflik: pilih satu versi utuh (belum gabung per elemen).
6. Tanpa login: siapa pun yang tahu kode project bisa membuka dan mengubahnya.
7. Tile OpenStreetMap: periksa kebijakan unduhan massal sebelum dipakai nyata (radius default 2 km).
8. Faktor harga KHS (sel G5 yang putus) belum diketahui; item tersebut dibiarkan kosong.

## F. Masalah umum
- *docker: command not found* → Docker Desktop belum jalan/terpasang.
- Port 8080 dipakai aplikasi lain → ubah `"8080:80"` di `docker-compose.yml`.
- Daftar material kosong → langkah impor (A.4) belum dijalankan.
- Reset total database: `docker compose down -v`.
