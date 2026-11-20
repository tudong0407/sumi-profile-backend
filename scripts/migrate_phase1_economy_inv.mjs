/**
 * scripts/migrate_phase1_economy_inv.mjs
 * Tạo bảng user_inventory (vé gacha, đá nâng sao, nhẫn, thẻ đổi tên, background đã mở khóa)
 * và thêm cột marry_ring_id vào bảng users. Bảo toàn 100% dữ liệu Tiểu thư Fuyumi (757091869183311872).
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function resolveConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_PASSWORD && process.env.SUPABASE_PROJECT_REF) {
    return `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`;
  }
  const credPath = path.join(PROJECT_ROOT, 'supabase_credentials.json');
  if (fs.existsSync(credPath)) {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    if (creds.password && creds.projectId) {
      return `postgresql://postgres:${encodeURIComponent(creds.password)}@db.${creds.projectId}.supabase.co:5432/postgres`;
    }
  }
  throw new Error('Missing DATABASE_URL / SUPABASE_DB_PASSWORD or local supabase_credentials.json');
}

const { Client } = pg;

const SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS marry_ring_id VARCHAR(50) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS user_inventory (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    item_id VARCHAR(80) NOT NULL,
    item_category VARCHAR(30) DEFAULT 'consumable',
    quantity INT DEFAULT 1 CHECK (quantity >= 0),
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
`;

async function main() {
  const connStr = resolveConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'marry_ring_id';
    `);
    const tbl = await client.query(`
      SELECT to_regclass('public.user_inventory') AS tbl;
    `);
    console.log('MIGRATE_PHASE1_OK:', {
      marry_ring_id: check.rows.length > 0,
      user_inventory: tbl.rows[0]?.tbl,
    });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('MIGRATE_PHASE1_ERR:', err);
  process.exit(1);
});
