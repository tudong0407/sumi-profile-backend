/**
 * scripts/migrate_v1_6_3_farm_8_slots.mjs
 * Mở rộng CHECK constraint của public.user_farm_plots từ slot_index <= 6 lên <= 8.
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

function resolveConnectionCandidates() {
  if (process.env.DATABASE_URL) return [process.env.DATABASE_URL];
  if (process.env.SUPABASE_DB_PASSWORD && process.env.SUPABASE_PROJECT_REF) {
    const pw = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD);
    const ref = process.env.SUPABASE_PROJECT_REF;
    return [
      `postgresql://postgres.${ref}:${pw}@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`,
    ];
  }
  const credPath = path.join(PROJECT_ROOT, 'supabase_credentials.json');
  if (fs.existsSync(credPath)) {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    if (creds.projectId && creds.password) {
      const pw = encodeURIComponent(creds.password);
      const ref = creds.projectId;
      return [
        `postgresql://postgres.${ref}:${pw}@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`,
        `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`,
      ];
    }
  }
  throw new Error('Missing DATABASE_URL / SUPABASE_DB_PASSWORD or local supabase_credentials.json');
}

async function connectWithFallback() {
  let lastErr;
  for (const connStr of resolveConnectionCandidates()) {
    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      await client.end().catch(() => {});
    }
  }
  throw lastErr;
}

async function run() {
  const client = await connectWithFallback();
  console.log('[migrate_v1_6_3_farm_8_slots] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');
    const { rows: constraints } = await client.query(`
      SELECT c.conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'user_farm_plots'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%slot_index%';
    `);

    for (const c of constraints) {
      console.log(`  Dropping old constraint: ${c.conname} (${c.def})`);
      await client.query(`ALTER TABLE public.user_farm_plots DROP CONSTRAINT IF EXISTS "${c.conname}";`);
    }

    await client.query(`
      ALTER TABLE public.user_farm_plots
      ADD CONSTRAINT user_farm_plots_slot_index_check CHECK (slot_index >= 1 AND slot_index <= 8);
    `);

    await client.query('COMMIT');
    console.log('[migrate_v1_6_3_farm_8_slots] Updated slot_index CHECK constraint to (1..8) cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[migrate_v1_6_3_farm_8_slots] FAILED:', err);
  process.exit(1);
});
