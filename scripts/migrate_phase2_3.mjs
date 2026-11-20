/**
 * scripts/migrate_phase2_3.mjs
 * Tạo 3 bảng phục vụ Phase 2 & Phase 3:
 * - shop_selections (lưu lựa chọn xem trước trong /shop)
 * - marry_proposals (lời cầu hôn /marry có thời hạn & nút Đồng Ý / Từ Chối)
 * - clan_join_requests (đơn xin gia nhập Gia Tộc /giatoc)
 * Đồng thời cập nhật marry_ring_id = 'ring_mythic' cho Tiểu thư Fuyumi nếu đang kết hôn mà chưa có ring_id.
 * Bảo toàn 100% dữ liệu hiện có.
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
CREATE TABLE IF NOT EXISTS shop_selections (
    user_id VARCHAR(32) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marry_proposals (
    id BIGSERIAL PRIMARY KEY,
    proposer_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    proposer_name VARCHAR(100) NOT NULL,
    target_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_name VARCHAR(100) NOT NULL,
    ring_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marry_proposals_target_status ON marry_proposals(target_id, status);
CREATE INDEX IF NOT EXISTS idx_marry_proposals_proposer_status ON marry_proposals(proposer_id, status);

CREATE TABLE IF NOT EXISTS clan_join_requests (
    id BIGSERIAL PRIMARY KEY,
    clan_id VARCHAR(50) NOT NULL REFERENCES clans(clan_id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clan_join_requests_clan_status ON clan_join_requests(clan_id, status);

UPDATE users
SET marry_ring_id = 'ring_mythic'
WHERE user_id = '757091869183311872'
  AND marry_user_id IS NOT NULL
  AND marry_ring_id IS NULL;
`;

async function main() {
  const connStr = resolveConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
    const tbls = await client.query(`
      SELECT
        to_regclass('public.shop_selections') AS shop_selections,
        to_regclass('public.marry_proposals') AS marry_proposals,
        to_regclass('public.clan_join_requests') AS clan_join_requests;
    `);
    const fu = await client.query(`
      SELECT user_id, marry_user_id, marry_ring_id, marry_date, clan_id
      FROM users WHERE user_id = '757091869183311872';
    `);
    console.log('MIGRATE_PHASE2_3_OK:', {
      tables: tbls.rows[0],
      fuyumi: fu.rows[0],
    });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('MIGRATE_PHASE2_3_ERR:', err);
  process.exit(1);
});
