/**
 * scripts/migrate_v1_4_7.mjs
 * Migration DB cho Bản Cập Nhật SuMi Family v1.4.7:
 * 1. public.users.autosell_config (Cấu hình tự động bán khi /roll theo phẩm chất + giữ món mới)
 * 2. public.user_quests.daily_quest_ids & daily_progress (Nhiệm Vụ Ngày xoay vòng 10 hoạt động)
 * 3. public.battle_logs (Lưu Nhật Ký Trận Đấu Web tương tác 48 giờ / 2 ngày cho Battle 1v1, Tháp & Linh Mạch)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
  console.log('[migrate_v1_4_7] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');

    // 1. public.users.autosell_config
    await client.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS autosell_config JSONB NOT NULL DEFAULT '{"common":false,"rare":false,"epic":false,"keep_new":false}'::jsonb;
      UPDATE public.users
        SET autosell_config = '{"common":false,"rare":false,"epic":false,"keep_new":false}'::jsonb
        WHERE autosell_config IS NULL;
    `);
    console.log('[migrate_v1_4_7] Ensured public.users.autosell_config.');

    // 2. public.user_quests.daily_quest_ids & daily_progress
    await client.query(`
      ALTER TABLE public.user_quests
        ADD COLUMN IF NOT EXISTS daily_quest_ids JSONB,
        ADD COLUMN IF NOT EXISTS daily_progress JSONB NOT NULL DEFAULT '{}'::jsonb;
      UPDATE public.user_quests
        SET daily_progress = '{}'::jsonb
        WHERE daily_progress IS NULL;
    `);
    console.log('[migrate_v1_4_7] Ensured public.user_quests.daily_quest_ids & daily_progress.');

    // 3. public.battle_logs (48h TTL Web Battle Logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.battle_logs (
        battle_id TEXT PRIMARY KEY,
        battle_kind TEXT NOT NULL DEFAULT '1v1',
        channel_id TEXT,
        participant_ids TEXT[] NOT NULL DEFAULT '{}',
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours')
      );
      CREATE INDEX IF NOT EXISTS idx_battle_logs_expires_at
        ON public.battle_logs (expires_at);
      CREATE INDEX IF NOT EXISTS idx_battle_logs_participants
        ON public.battle_logs USING GIN (participant_ids);
    `);
    console.log('[migrate_v1_4_7] Ensured public.battle_logs & indexes.');

    // Grant permissions for Supabase roles if present
    await client.query(`
      DO $$
      BEGIN
        GRANT ALL ON TABLE public.battle_logs
          TO postgres, service_role, authenticated, anon;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('[migrate_v1_4_7] Migration committed. Verifying columns & table...');

    const checkCols = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'users' AND column_name = 'autosell_config')
          OR (table_name = 'user_quests' AND column_name IN ('daily_quest_ids', 'daily_progress'))
          OR (table_name = 'battle_logs')
        )
      ORDER BY table_name, column_name;
    `);
    console.table(checkCols.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate_v1_4_7] ROLLED BACK due to error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
