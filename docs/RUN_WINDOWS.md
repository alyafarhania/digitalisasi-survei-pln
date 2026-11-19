# Menjalankan di Windows — langkah demi langkah

Dua cara. **Cara A (Docker)** = hasilnya sama dengan server sungguhan (Next.js + PostgreSQL + nginx). **Cara B (tanpa Docker)** = paling cepat untuk
mengembangkan UI. Semua perintah dijalankan di **PowerShell** (bukan CMD). Buka lewat menu Start → ketik `PowerShell`.

> Aplikasi saat ini memakai **data mock** (tahap UI): tidak ada server backend, data project tersimpan di browser. PostgreSQL tetap dijalankan
> Docker agar siap dipakai saat backend dibuat.

---

## 0. Pasang prasyarat (sekali saja)

| Alat | Untuk apa | Cara pasang (PowerShell) |
|---|---|---|
| **Git** | mengunduh kode | `winget install --id Git.Git -e` |
| **Node.js 22 LTS** | Cara B + menjalankan tes | `winget install --id OpenJS.NodeJS.LTS -e` |
| **Docker Desktop** | Cara A | `winget install --id Docker.DockerDesktop -e` |

1. **Tutup lalu buka ulang PowerShell** setelah memasang (agar `git`, `node` dikenali).
2. Cek versi:
   ```powershell
   git --version
   node --version     # harus v22.x (minimal v20)
   npm --version
   ```
3. Untuk Docker Desktop: pasang → **restart Windows** → buka **Docker Desktop** → tunggu sampai kiri-bawah hijau tertulis **Engine running**.
   Bila diminta, aktifkan **WSL 2**: `wsl --install` (PowerShell *Run as administrator*), lalu restart.
   Cek: `docker --version` dan `docker compose version`.

> Tidak punya `winget`? Unduh manual: [git-scm.com](https://git-scm.com/download/win), [nodejs.org](https://nodejs.org) (pilih LTS), [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).

## 1. Unduh proyek

```powershell
cd $HOME\Documents
git clone <alamat-repo-github> digitalisasi-survei-pln
cd digitalisasi-survei-pln
```
(Sudah punya foldernya? Cukup `cd` ke sana lalu `git pull`.)

---

## Cara A — Docker (disarankan untuk uji seperti produksi)

1. **Buat file pengaturan.**
   ```powershell
   copy .env.example .env
   notepad .env
   ```
   Ganti `DB_PASSWORD=ganti-dengan-sandi-kuat` dengan sandi Anda. Biarkan `DATA_MODE=mock`. Simpan lalu tutup Notepad.
2. **Pastikan Docker Desktop berjalan** (Engine running).
3. **Bangun dan jalankan** (pertama kali ± 3–6 menit, perlu internet):
   ```powershell
   docker compose up --build -d
   ```
4. **Cek semuanya hidup** — tiga layanan harus `Up` / `healthy`:
   ```powershell
   docker compose ps
   ```
5. **Buka browser:** <http://localhost:8080> → halaman **Masuk**.
6. **Masuk** dengan salah satu akun demo (ketuk namanya di halaman login agar terisi otomatis):

   | Peran | Email | Sandi |
   |---|---|---|
   | Admin UP3 | `admin@pln.test` | `admin123` |
   | Perencana | `perencana@pln.test` | `perencana123` |
   | Surveyor | `surveyor@pln.test` | `surveyor123` |
   | Manajer (lihat saja) | `manajer@pln.test` | `manajer123` |

7. **Berhenti / lanjut / bersihkan**
   ```powershell
   docker compose down          # berhenti (data database tetap)
   docker compose up -d         # jalan lagi (tanpa --build bila kode tidak berubah)
   docker compose logs -f app   # lihat log aplikasi (Ctrl+C untuk keluar)
   docker compose down -v       # berhenti DAN hapus data PostgreSQL
   ```
8. **Setelah `git pull` (kode berubah):** `docker compose up --build -d`.

### Port 8080 sudah dipakai?
Cek siapa pemakainya, lalu pilih port lain di `.env`:
```powershell
netstat -ano | findstr :8080
notepad .env        # ubah:  HTTP_PORT=8088
docker compose up -d
```
Lalu buka <http://localhost:8088>.

### Membuka dari HP (satu Wi-Fi)
1. Cari IP laptop: `ipconfig` → **IPv4 Address**, mis. `192.168.1.20`.
2. Izinkan port di Windows Firewall (PowerShell *Run as administrator*):
   ```powershell
   New-NetFirewallRule -DisplayName "Survei PLN" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```
3. Di HP buka `http://192.168.1.20:8080`.
> **GPS dan mode offline di HP butuh HTTPS.** Lewat `http://IP` keduanya tidak aktif. Untuk uji lapangan pasang sertifikat (lihat `nginx/nginx.conf`) atau pakai domain ber-HTTPS.

---

## Cara B — Tanpa Docker (mode pengembangan)

1. Pasang dependensi (sekali, atau setelah `package.json` berubah):
   ```powershell
   npm install
   ```
2. Jalankan:
   ```powershell
   npm run dev
   ```
3. Buka <http://localhost:3000>. Perubahan kode langsung tampil (hot reload). Hentikan dengan **Ctrl+C**.
4. (Opsional) Bangun ulang data master mock dari Excel `data\KKP_PB_53_KVA_PABRIK_ROKOK_HS.xlsx`:
   ```powershell
   npm run mock:build
   ```

---

## Menjalankan tes

### Tes unit (cepat, ±10 detik, tanpa browser)
```powershell
npm test
```
Hasil yang diharapkan: `Test Files 12 passed`, `Tests 224 passed`.

### Tes end-to-end (membuka browser Chromium sungguhan)
Sekali saja pasang browser uji:
```powershell
npx playwright install chromium
```
Lalu pilih salah satu:
```powershell
npm run test:e2e                                    # menyalakan server dev otomatis di :3100
$env:E2E_BASE_URL = "http://localhost:8080"; npm run test:e2e   # menguji server Docker yang sedang jalan
npx playwright test rab.spec.js                     # satu berkas saja
npx playwright test --headed --project=desktop      # lihat browser bekerja
npx playwright show-report                          # buka laporan HTML setelah selesai
```
Semuanya sekaligus (unit + E2E): `npm run test:all`.

> Untuk kembali ke penunjuk server dev: `Remove-Item Env:E2E_BASE_URL`.

---

## Pengganti perintah `make` (Makefile tidak ada di Windows)

| Linux/macOS (`make …`) | Windows PowerShell |
|---|---|
| `make setup` | `copy .env.example .env` |
| `make up` | `docker compose up --build -d` |
| `make down` | `docker compose down` |
| `make logs` | `docker compose logs -f --tail=100` |
| `make ps` | `docker compose ps` |
| `make health` | `curl.exe http://localhost:8080/api/health` |
| `make psql` | `docker compose exec db psql -U pln -d pln` |
| `make adminer` | `docker compose --profile tools up -d adminer` → <http://localhost:8081> |
| `make clean` | `docker compose down -v` |
| `make dev` | `npm install; npm run dev` |
| `make test` / `make e2e` | `npm test` / `npm run test:e2e` |

(Mau memakai `make`? `winget install ezwinports.make`, lalu buka ulang PowerShell.)

## Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| `docker : The term 'docker' is not recognized` | Docker Desktop belum terpasang/terbuka. Buka Docker Desktop, tunggu *Engine running*, buka ulang PowerShell. |
| `error during connect … dockerDesktopLinuxEngine` | Docker Desktop belum selesai start, atau WSL 2 mati: `wsl --update` lalu restart Docker Desktop. |
| `Bind for 0.0.0.0:8080 failed: port is already allocated` | Port bentrok → ganti `HTTP_PORT` di `.env` (lihat atas). |
| `invalid interpolation format` / `isi DB_PASSWORD di file .env` | `.env` belum dibuat atau `DB_PASSWORD` kosong. Ulangi langkah A.1. |
| `npm : File … cannot be loaded because running scripts is disabled` | PowerShell memblokir skrip: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` lalu buka ulang PowerShell. |
| `npm install` gagal `EACCES` / antivirus menghapus berkas | Pindahkan proyek ke folder pendek seperti `C:\proyek\survei` (hindari OneDrive) dan coba lagi. |
| Halaman putih / "Memuat aplikasi…" terus | Tekan **Ctrl+Shift+R**. Bila masih: DevTools → Application → *Clear site data* (service worker lama). |
| Login terus dikembalikan ke halaman masuk | Cookie/penyimpanan situs diblokir. Izinkan penyimpanan lokal untuk situs ini, atau pakai jendela non-incognito. |
| E2E: `browserType.launch: Executable doesn't exist` | Jalankan `npx playwright install chromium`. |
| E2E lambat/gagal pertama kali | `next dev` mengompilasi halaman saat pertama dibuka. Jalankan ulang, atau uji server Docker (`E2E_BASE_URL`). |
| Peta abu-abu | Perlu internet (ubin OpenStreetMap/Esri). Untuk offline, unduh area dulu di menu **Offline & Sinkron**. |
| Data hilang setelah ganti browser | Data mock tersimpan **per browser**. Itu normal pada tahap mock; backend akan menyimpannya di PostgreSQL. |
