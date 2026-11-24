/**
 * scripts/migrate_farm_reminders.mjs
 * Bổ sung cột theo dõi DM nhắc tưới nước & cảnh báo sắp héo (1h / 30p / 15p) cho public.user_farm_plots.
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
  console.log('[migrate_farm_reminders] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE public.user_farm_plots
        ADD COLUMN IF NOT EXISTS dm_care_notified boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS dm_wilt_stage int NOT NULL DEFAULT 0;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_farm_plots_growing
        ON public.user_farm_plots (status)
        WHERE status = 'growing';
    `);
    await client.query('COMMIT');
    console.log('[migrate_farm_reminders] Added dm_care_notified, dm_wilt_stage & idx_user_farm_plots_growing.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[migrate_farm_reminders] Failed:', err);
  process.exit(1);
});
