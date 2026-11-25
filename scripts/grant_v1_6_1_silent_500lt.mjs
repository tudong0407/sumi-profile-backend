/**
 * scripts/grant_v1_6_1_silent_500lt.mjs
 * Cộng ngầm +500 LT cho toàn bộ tài khoản đã xác nhận v1.6.1 (last_seen_update_version = '1.6.1').
 * Idempotent 100% qua bảng public.v1_6_1_silent_500lt_grants.
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
  throw new Error('Missing DATABASE_URL or local supabase_credentials.json');
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
  console.log('[grant_v1_6_1_silent_500lt] Connected to Postgres/Supabase.');
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.v1_6_1_silent_500lt_grants (
        user_id TEXT PRIMARY KEY,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: candidates } = await client.query(`
      SELECT u.user_id, u.username, u.linh_thach
      FROM public.users u
      WHERE u.last_seen_update_version = '1.6.1'
        AND NOT EXISTS (
          SELECT 1 FROM public.v1_6_1_silent_500lt_grants g WHERE g.user_id = u.user_id
        );
    `);

    for (const u of candidates) {
      await client.query(
        `UPDATE public.users SET linh_thach = COALESCE(linh_thach, 0) + 500, updated_at = NOW() WHERE user_id = $1`,
        [u.user_id],
      );
      await client.query(
        `INSERT INTO public.v1_6_1_silent_500lt_grants (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [u.user_id],
      );
    }

    await client.query('COMMIT');
    console.log(`[grant_v1_6_1_silent_500lt] Granted +500 LT to ${candidates.length} user(s):`,
      candidates.map((c) => `${c.username || c.user_id} (${c.user_id})`).join(', ') || 'none');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[grant_v1_6_1_silent_500lt] FAILED:', err);
  process.exit(1);
});
