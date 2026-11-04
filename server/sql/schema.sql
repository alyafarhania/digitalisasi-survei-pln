-- Skema PostgreSQL — aman dijalankan berulang (CREATE ... IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE peran_konstruksi AS ENUM ('baru', 'eksisting', 'bongkar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Data master (diimpor dari Excel) =====
CREATE TABLE IF NOT EXISTS material (
  id        SERIAL PRIMARY KEY,
  kelompok  TEXT NOT NULL,
  nama      TEXT NOT NULL,
  golongan  TEXT NOT NULL,                 -- MDU, MDU-KD, HDW, JASA, NON MDU KHS
  satuan    TEXT,
  hss_2024  NUMERIC(14,2),
  khs_2024  NUMERIC(14,2),
  UNIQUE (kelompok, nama, golongan)
);
CREATE INDEX IF NOT EXISTS material_nama_idx ON material (lower(nama));

CREATE TABLE IF NOT EXISTS konduktor (
  id               SERIAL PRIMARY KEY,
  kode             TEXT NOT NULL UNIQUE,    -- sama dengan nama material penghantar
  kelompok_garis   TEXT NOT NULL CHECK (kelompok_garis IN ('JTM','JTR')),
  fasa             SMALLINT NOT NULL,       -- 1 atau 3
  material_id      INTEGER REFERENCES material(id) ON DELETE SET NULL,
  upah_pasang_id   INTEGER REFERENCES material(id) ON DELETE SET NULL,
  upah_bongkar_id  INTEGER REFERENCES material(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS konstruksi (
  id       SERIAL PRIMARY KEY,
  kelompok TEXT NOT NULL,
  kode     TEXT NOT NULL,
  uraian   TEXT,
  sudut_min SMALLINT,
  sudut_maks SMALLINT,
  UNIQUE (kelompok, kode)
);
CREATE TABLE IF NOT EXISTS konstruksi_item (
  id            SERIAL PRIMARY KEY,
  konstruksi_id INTEGER NOT NULL REFERENCES konstruksi(id) ON DELETE CASCADE,
  urut          INTEGER NOT NULL,
  uraian        TEXT NOT NULL,
  satuan        TEXT,
  volume        NUMERIC(14,4),
  material_id   INTEGER REFERENCES material(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS konstruksi_item_k_idx ON konstruksi_item (konstruksi_id);

CREATE TABLE IF NOT EXISTS simbol (
  kode          TEXT PRIMARY KEY,
  nama          TEXT NOT NULL,
  geometri      TEXT NOT NULL CHECK (geometri IN ('titik','garis')),
  urut          INTEGER NOT NULL,
  ikon_baru      TEXT,
  ikon_eksisting TEXT,
  ikon_bongkar   TEXT
);
CREATE TABLE IF NOT EXISTS aturan_simbol (
  id         SERIAL PRIMARY KEY,
  sumber     TEXT NOT NULL,                 -- peralatan | tiang | konstruksi
  pola       TEXT NOT NULL,                 -- regex (tidak peka huruf besar/kecil)
  simbol     TEXT NOT NULL REFERENCES simbol(kode) ON DELETE CASCADE,
  prioritas  INTEGER NOT NULL DEFAULT 50,
  UNIQUE (sumber, pola)
);

-- ===== Data pengguna (siap offline: UUID dari klien, version, updated_at, soft delete) =====
CREATE TABLE IF NOT EXISTS proyek (
  id           UUID PRIMARY KEY,
  kode_project TEXT NOT NULL UNIQUE,        -- kode acak untuk link/membuka project
  nomor        TEXT,
  nama         TEXT NOT NULL,
  jenis        TEXT NOT NULL,
  lokasi       TEXT,
  tarif        TEXT,
  daya         INTEGER,
  status       TEXT NOT NULL DEFAULT 'Draft',
  jalur        TEXT,
  extra        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- meta gambar, penyeberangan, posisi kotak, opsi RAB, edit harga
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS proyek_cari_idx ON proyek (lower(nama), lower(nomor));

CREATE TABLE IF NOT EXISTS titik_tagging (
  id                 UUID PRIMARY KEY,
  proyek_id          UUID NOT NULL REFERENCES proyek(id) ON DELETE CASCADE,
  urutan             INTEGER NOT NULL,
  lat                DOUBLE PRECISION NOT NULL,
  lng                DOUBLE PRECISION NOT NULL,
  nomor_tiang        TEXT,
  jenis_tiang        TEXT,
  jenis_peralatan    TEXT,
  jenis_konduktor    TEXT,
  panjang_konduktor  NUMERIC(10,2),         -- null = pakai jarak dari peta
  konstruksi_baru    TEXT,
  kode_manual        BOOLEAN NOT NULL DEFAULT false,
  konstruksi_lama    TEXT,
  konstruksi_bongkar TEXT,
  kondisi            peran_konstruksi NOT NULL DEFAULT 'baru',
  tinggi_lintasan    TEXT,
  sudut              SMALLINT,
  version            INTEGER NOT NULL DEFAULT 1,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted            BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS titik_proyek_idx ON titik_tagging (proyek_id, urutan);

CREATE TABLE IF NOT EXISTS foto (
  id         UUID PRIMARY KEY,
  proyek_id  UUID NOT NULL REFERENCES proyek(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted    BOOLEAN NOT NULL DEFAULT false
);
