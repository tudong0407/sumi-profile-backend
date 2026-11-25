/**
 * scripts/migrate_v1_6_3_loadouts.mjs
 * Migration DB cho SuMi Family Ver 1.6.3 — Hệ Thống 3 Loadout Tự Động Lưu (/inv):
 * 1. public.users.active_loadout_slot SMALLINT NOT NULL DEFAULT 1
 * 2. public.user_loadouts (user_id, slot_index 1..3, pet_id, pet_type, weapon_id, gem_id, soul_id, domain_id, sense_id, realm_id, is_initialized)
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
  console.log('[migrate_v1_6_3_loadouts] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS active_loadout_slot SMALLINT NOT NULL DEFAULT 1;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_loadouts (
        user_id TEXT NOT NULL,
        slot_index SMALLINT NOT NULL CHECK (slot_index IN (1, 2, 3)),
        pet_id TEXT,
        pet_type TEXT,
        weapon_id TEXT,
        gem_id TEXT,
        soul_id TEXT,
        domain_id TEXT,
        sense_id TEXT,
        realm_id TEXT,
        is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, slot_index)
      );
    `);
    await client.query('COMMIT');
    console.log('[migrate_v1_6_3_loadouts] Loadout column & table created/verified cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[migrate_v1_6_3_loadouts] FAILED:', err);
  process.exit(1);
});
