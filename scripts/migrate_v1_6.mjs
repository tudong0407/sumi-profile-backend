/**
 * scripts/migrate_v1_6.mjs
 * Migration DB cho SuMi Family Ver 1.6:
 * 1. public.shop_message_selections (fix lỗi mua nhầm Viền/Ảnh Nền khi mở nhiều preview)
 * 2. public.user_luck_buffs (3 lọ Luck Potion theo lượt)
 * 3. public.user_stone_stalls (Sạp Đá Phiên Cá Nhân Đổ Thạch)
 * 4. public.user_stone_rewards (pending_supreme_picks & thống kê Đổ Thạch)
 * 5. public.user_daily_fortunes (Gieo Quẻ Đầu Ngày /gieoque)
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
  console.log('[migrate_v1_6] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.shop_message_selections (
        user_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        category TEXT NOT NULL,
        item_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, message_id)
      );
      CREATE INDEX IF NOT EXISTS idx_shop_msg_sel_created
        ON public.shop_message_selections (created_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_luck_buffs (
        user_id TEXT PRIMARY KEY,
        potion_id TEXT NOT NULL,
        luck_bonus_pct INTEGER NOT NULL DEFAULT 0,
        remaining_charges INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_stone_stalls (
        user_id TEXT NOT NULL,
        tier_key TEXT NOT NULL,
        stones_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, tier_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_stone_rewards (
        user_id TEXT PRIMARY KEY,
        pending_supreme_picks INTEGER NOT NULL DEFAULT 0,
        total_cuts INTEGER NOT NULL DEFAULT 0,
        total_supreme_hits INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_daily_fortunes (
        user_id TEXT PRIMARY KEY,
        fortune_date TEXT NOT NULL,
        tier_key TEXT NOT NULL,
        poem_idx INTEGER NOT NULL DEFAULT 0,
        exp_pct INTEGER NOT NULL DEFAULT 0,
        lt_pct INTEGER NOT NULL DEFAULT 0,
        luck_pct INTEGER NOT NULL DEFAULT 0,
        rerolled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('[migrate_v1_6] All 5 tables created/verified cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[migrate_v1_6] FAILED:', err);
  process.exit(1);
});
