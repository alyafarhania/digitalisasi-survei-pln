-- Tahap 2 (backend): pengguna + RBAC, audit project, metadata foto. Aman dijalankan berulang.
-- Docker menjalankan berkas di db/init hanya saat volume masih kosong; untuk database yang sudah ada jalankan manual:
--   docker compose exec -T db psql -U pln -d pln -f - < db/init/002_auth_audit.sql

-- ===== Pengguna (peran: admin | perencana | surveyor | manajer) =====
CREATE TABLE IF NOT EXISTS pengguna (
  id            TEXT PRIMARY KEY,                       -- mis. 'u-admin' (mock) atau uuid
  email         TEXT NOT NULL UNIQUE,
  nama          TEXT NOT NULL,
  peran         TEXT NOT NULL CHECK (peran IN ('admin','perencana','surveyor','manajer')),
  password_hash TEXT NOT NULL,                          -- argon2id / bcrypt, JANGAN simpan sandi polos
  aktif         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS pengguna_email_lower ON pengguna (lower(email));

-- ===== Jejak pembuat / finalisasi / pengubah terakhir pada project =====
-- Disimpan sebagai snapshot {id, name, role} agar riwayat tetap terbaca walau pengguna dihapus/diganti nama.
ALTER TABLE proyek ADD COLUMN IF NOT EXISTS created_by      JSONB;
ALTER TABLE proyek ADD COLUMN IF NOT EXISTS finalized_by    JSONB;
ALTER TABLE proyek ADD COLUMN IF NOT EXISTS finalized_at    TIMESTAMPTZ;
ALTER TABLE proyek ADD COLUMN IF NOT EXISTS last_edited_by  JSONB;
ALTER TABLE proyek ADD COLUMN IF NOT EXISTS last_edited_at  TIMESTAMPTZ;
ALTER TABLE proyek DROP CONSTRAINT IF EXISTS proyek_status_chk;
ALTER TABLE proyek ADD CONSTRAINT proyek_status_chk CHECK (status IN ('Draft','Selesai'));
CREATE INDEX IF NOT EXISTS proyek_status_idx   ON proyek (status) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS proyek_updated_idx  ON proyek (updated_at DESC) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS proyek_creator_idx  ON proyek ((created_by->>'id')) WHERE NOT deleted;

-- ===== Audit: append-only. Aksi: created | copied | finalized | reopened | deleted =====
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY,
  proyek_id   UUID NOT NULL REFERENCES proyek(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('created','copied','finalized','reopened','deleted')),
  actor_id    TEXT NOT NULL,
  actor_name  TEXT NOT NULL,
  actor_role  TEXT NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);
CREATE INDEX IF NOT EXISTS audit_proyek_idx ON audit_log (proyek_id, at);
-- Larang ubah/hapus baris audit dari aplikasi (hanya INSERT)
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log bersifat append-only'; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW WHEN (current_setting('app.allow_audit_purge', true) IS DISTINCT FROM 'on') EXECUTE FUNCTION audit_log_immutable();

-- ===== Foto: metadata pengunggah =====
ALTER TABLE foto ADD COLUMN IF NOT EXISTS name       TEXT;
ALTER TABLE foto ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE foto ADD COLUMN IF NOT EXISTS created_by JSONB;
CREATE INDEX IF NOT EXISTS foto_proyek_idx ON foto (proyek_id, created_at) WHERE NOT deleted;
