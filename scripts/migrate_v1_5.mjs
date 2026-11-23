/**
 * scripts/migrate_v1_5.mjs
 * Migration DB cho Big Update Ver 1.5 (an toàn chạy trước Nhịp 2):
 * 1. public.users.gacha_pity JSONB DEFAULT '{"pet":0,"equipment":0,"domain":0}'::jsonb
 * 2. public.user_frames (user_id, frame_id, purchased_at) + migrate từ frame_unlock_token & avatar_frame cũ
 * 3. public.daily_activity_stats (date_key, user_id, chat_exp, chat_count, voice_exp, voice_minutes, updated_at)
 * 4. public.daily_activity_settlements (date_key, winners_json, settled_at)
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
  console.log('[migrate_v1_5] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');

    // 1. users.gacha_pity
    await client.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS gacha_pity jsonb NOT NULL DEFAULT '{"pet":0,"equipment":0,"domain":0}'::jsonb;
      UPDATE public.users
        SET gacha_pity = '{"pet":0,"equipment":0,"domain":0}'::jsonb
        WHERE gacha_pity IS NULL;
    `);
    console.log('[migrate_v1_5] Ensured public.users.gacha_pity.');

    // 2. public.user_frames + index
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_frames (
        user_id text NOT NULL,
        frame_id text NOT NULL,
        purchased_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, frame_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_frames_user_id ON public.user_frames (user_id);
    `);
    console.log('[migrate_v1_5] Ensured public.user_frames.');

    // 3. Migrate existing frame_unlock_token / custom avatar_frame owners -> frame_royal_legacy + 4 legacy frames
    const { rowCount: migratedCount } = await client.query(`
      WITH legacy_owners AS (
        SELECT DISTINCT user_id
        FROM public.user_inventory
        WHERE item_id = 'frame_unlock_token' AND quantity > 0
        UNION
        SELECT DISTINCT user_id
        FROM public.users
        WHERE COALESCE(avatar_frame, 'default') NOT IN ('', 'default')
      ),
      grant_frames AS (
        SELECT unnest(ARRAY[
          'frame_royal_legacy',
          'jade_lotus',
          'amethyst_celestial',
          'crimson_phoenix',
          'frost_crystal'
        ]) AS frame_id
      )
      INSERT INTO public.user_frames (user_id, frame_id)
      SELECT o.user_id, g.frame_id
      FROM legacy_owners o
      CROSS JOIN grant_frames g
      ON CONFLICT (user_id, frame_id) DO NOTHING;
    `);
    console.log(`[migrate_v1_5] Migrated legacy frame owners (${migratedCount || 0} frame grants inserted).`);

    // 4. public.daily_activity_stats
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.daily_activity_stats (
        date_key text NOT NULL,
        user_id text NOT NULL,
        chat_exp bigint NOT NULL DEFAULT 0,
        chat_count integer NOT NULL DEFAULT 0,
        voice_exp bigint NOT NULL DEFAULT 0,
        voice_minutes integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (date_key, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_activity_chat ON public.daily_activity_stats (date_key, chat_exp DESC);
      CREATE INDEX IF NOT EXISTS idx_daily_activity_voice ON public.daily_activity_stats (date_key, voice_exp DESC);
    `);
    console.log('[migrate_v1_5] Ensured public.daily_activity_stats.');

    // 5. public.daily_activity_settlements
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.daily_activity_settlements (
        date_key text PRIMARY KEY,
        winners_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        settled_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('[migrate_v1_5] Ensured public.daily_activity_settlements.');

    await client.query('COMMIT');

    // Quick read-back verification
    const verify = await client.query(`
      SELECT
        (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='gacha_pity') AS has_pity,
        (SELECT count(*) FROM public.user_frames) AS total_user_frames,
        (SELECT to_regclass('public.daily_activity_stats')::text) AS stats_tbl,
        (SELECT to_regclass('public.daily_activity_settlements')::text) AS settle_tbl;
    `);
    console.log('[migrate_v1_5] Verification:', verify.rows[0]);
    console.log('[migrate_v1_5] ALL DONE cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate_v1_5] ROLLED BACK due to error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
