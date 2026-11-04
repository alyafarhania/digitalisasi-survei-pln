import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pool, q } from './db.js'
import { SIMBOL, ATURAN, ikonSvg } from '../../shared/symbols.js'

export async function migrate() {
  await q(readFileSync(fileURLToPath(new URL('../sql/schema.sql', import.meta.url)), 'utf8'))
  try { await q('CREATE EXTENSION IF NOT EXISTS pg_trgm'); await q('CREATE INDEX IF NOT EXISTS material_trgm ON material USING gin (nama gin_trgm_ops)') } catch { /* opsional */ }
  // simbol + aturan: satu sumber dengan shared/symbols.js
  for (const [i, [kode, nama, geo]] of SIMBOL.entries()) {
    await q(`INSERT INTO simbol (kode,nama,geometri,urut,ikon_baru,ikon_eksisting,ikon_bongkar) VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (kode) DO UPDATE SET nama=$2, geometri=$3, urut=$4, ikon_baru=$5, ikon_eksisting=$6, ikon_bongkar=$7`,
      [kode, nama, geo, i + 1, ikonSvg(kode, 'baru'), ikonSvg(kode, 'eksisting'), ikonSvg(kode, 'bongkar')])
  }
  for (const [sumber, pola, simbol, prioritas] of ATURAN)
    await q(`INSERT INTO aturan_simbol (sumber,pola,simbol,prioritas) VALUES ($1,$2,$3,$4)
             ON CONFLICT (sumber,pola) DO UPDATE SET simbol=$3, prioritas=$4`, [sumber, pola, simbol, prioritas])
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await migrate(); console.log('Migrasi selesai.'); await pool.end() }
