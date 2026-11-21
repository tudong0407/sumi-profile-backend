/**
 * scripts/migrate_phase4.mjs
 * Tạo 2 bảng mới phục vụ Phase 4+:
 * - user_quests: theo dõi 3 nhiệm vụ ngày & tiến độ Tháp Thí Luyện / Boss PvE (/nhiemvu)
 * - gift_logs: nhật ký chuyển khoản Linh Thạch & tặng vật phẩm chống farm clone (/tangqua)
 * Hoàn toàn idempotent (CREATE TABLE IF NOT EXISTS), bảo toàn 100% dữ liệu cũ.
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
CREATE TABLE IF NOT EXISTS user_quests (
    user_id VARCHAR(32) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    quest_date VARCHAR(10),
    daily_claimed_at TIMESTAMPTZ,
    chat_exp_today INT DEFAULT 0,
    battles_today INT DEFAULT 0,
    tower_floor INT DEFAULT 0,
    tower_attempts_date VARCHAR(10),
    tower_attempts_today INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gift_logs (
    id BIGSERIAL PRIMARY KEY,
    sender_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    gift_type VARCHAR(40) NOT NULL,
    amount INT NOT NULL,
    tax_amount INT DEFAULT 0,
    gift_date VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_logs_sender_date ON gift_logs(sender_id, gift_date);
`;

async function main() {
  const connStr = resolveConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
    const tbls = await client.query(`
      SELECT
        to_regclass('public.user_quests') AS user_quests,
        to_regclass('public.gift_logs') AS gift_logs;
    `);
    console.log('MIGRATE_PHASE4_OK:', tbls.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('MIGRATE_PHASE4_ERR:', err);
  process.exit(1);
});
