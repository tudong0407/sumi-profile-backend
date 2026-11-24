/**
 * scripts/migrate_v1_6_1.mjs
 * Migration DB cho SuMi Family Ver 1.6.1 — Hệ Thống Lò Luyện Đan (/luyendan):
 * 1. public.user_alchemy_profiles (Cấp lò 1..5, Lò #2, tổng mẻ thành công, giới hạn 5 mẻ/ngày)
 * 2. public.user_alchemy_furnaces (Trạng thái 2 lò song song, hẹn giờ chín/cháy/nổ & DM nhắc)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
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
    if (creds.projectId && creds.password) {
      return `postgresql://postgres:${encodeURIComponent(creds.password)}@db.${creds.projectId}.supabase.co:5432/postgres`;
    }
  }
  throw new Error('Missing DATABASE_URL / SUPABASE_DB_PASSWORD or local supabase_credentials.json');
}

async function run() {
  const connStr = resolveConnectionString();
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[migrate_v1_6_1] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_alchemy_profiles (
        user_id TEXT PRIMARY KEY,
        furnace_level INTEGER NOT NULL DEFAULT 1,
        slot2_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
        total_batches_completed INTEGER NOT NULL DEFAULT 0,
        daily_date TEXT NOT NULL DEFAULT '',
        batches_today INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_alchemy_furnaces (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        slot_index SMALLINT NOT NULL CHECK (slot_index IN (1, 2)),
        status TEXT NOT NULL DEFAULT 'idle',
        recipe_id TEXT,
        started_at TIMESTAMPTZ,
        ready_at TIMESTAMPTZ,
        burn_at TIMESTAMPTZ,
        repair_until TIMESTAMPTZ,
        dm_ready_sent BOOLEAN NOT NULL DEFAULT FALSE,
        dm_warn10_sent BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, slot_index)
      );
      CREATE INDEX IF NOT EXISTS idx_user_alchemy_furnaces_brewing
        ON public.user_alchemy_furnaces (status, ready_at, burn_at)
        WHERE status = 'brewing';
    `);

    await client.query('COMMIT');
    console.log('[migrate_v1_6_1] Both alchemy tables and index created/verified cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[migrate_v1_6_1] FAILED:', err);
  process.exit(1);
});
