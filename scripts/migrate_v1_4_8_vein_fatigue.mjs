/**
 * scripts/migrate_v1_4_8_vein_fatigue.mjs
 * Migration DB cho hệ thống Mệt Mỏi Linh Mạch giảm -10% mỗi giờ:
 * - public.spirit_vein_fatigue.fatigue_pct (0..75%)
 * - public.spirit_vein_fatigue.fatigue_updated_at (mốc tính thời gian hồi phục -10%/giờ)
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
  console.log('[migrate_v1_4_8] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE public.spirit_vein_fatigue
        ADD COLUMN IF NOT EXISTS fatigue_pct int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS fatigue_updated_at timestamptz;
      UPDATE public.spirit_vein_fatigue
        SET fatigue_pct = LEAST(75, GREATEST(0, COALESCE(consecutive_wins, 0) * 25)),
            fatigue_updated_at = COALESCE(fatigue_updated_at, updated_at, now())
        WHERE fatigue_updated_at IS NULL;
    `);
    console.log('[migrate_v1_4_8] Ensured public.spirit_vein_fatigue (fatigue_pct, fatigue_updated_at).');

    await client.query('COMMIT');
    console.log('[migrate_v1_4_8] ALL DONE cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate_v1_4_8] ROLLED BACK due to error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
