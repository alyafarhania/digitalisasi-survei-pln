import pg from 'pg'
pg.types.setTypeParser(1700, (v) => (v == null ? null : Number(v))) // NUMERIC -> number
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://pln:pln@localhost:5432/pln' })
export const q = (text, params) => pool.query(text, params)
