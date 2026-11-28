/**
 * scripts/migrate_v1_7_1_mini.mjs
 * Migration DB cho SuMi Family Ver 1.7.1 Mini (Mặc định --dry-run; truyền --apply để ghi DB):
 * 1. Thêm cột incense_date & incense_luck_pct trên public.users (/thaplinhhuong)
 * 2. Tạo bảng public.tea_sessions & public.user_tea_daily (/thuongtra)
 * 3. Vá triệt để lỗi Linh Thú bị kẹt status = 'exploring' khi không có chuyến explorer_expeditions active
 *    (bao gồm TAGxSabito 1035807938331291738 — pet_id 3282, 3283, 3395)
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

export function buildV171MiniDdlStatements() {
  return [
    `ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS incense_date TEXT,
      ADD COLUMN IF NOT EXISTS incense_luck_pct INTEGER NOT NULL DEFAULT 0;`,

    `CREATE TABLE IF NOT EXISTS public.tea_sessions (
      id BIGSERIAL PRIMARY KEY,
      session_key TEXT NOT NULL UNIQUE,
      host_user_id TEXT NOT NULL,
      host_brew_lt INTEGER NOT NULL DEFAULT 0,
      host_luck_pct INTEGER NOT NULL DEFAULT 0,
      max_guests INTEGER NOT NULL DEFAULT 2,
      expires_at TIMESTAMPTZ NOT NULL,
      guests_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_tea_sessions_host_created
      ON public.tea_sessions (host_user_id, created_at DESC);`,

    `CREATE TABLE IF NOT EXISTS public.user_tea_daily (
      user_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      brew_count INTEGER NOT NULL DEFAULT 0,
      guest_join_count INTEGER NOT NULL DEFAULT 0,
      total_lt_earned INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, date_key)
    );`,
  ];
}

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

export async function runMigration(argv = process.argv.slice(2)) {
  const isApply = argv.includes('--apply');
  const ddlStatements = buildV171MiniDdlStatements();
  const client = await connectWithFallback();

  try {
    const orphanRes = await client.query(`
      SELECT p.pet_id, p.user_id, p.pet_type, p.status
      FROM public.user_pets p
      WHERE p.status = 'exploring'
        AND NOT EXISTS (
          SELECT 1
          FROM public.explorer_expeditions e
          WHERE e.status = 'active'
            AND e.user_id = p.user_id
            AND e.pet_id::text = p.pet_id::text
        )
      ORDER BY p.user_id, p.pet_id;
    `);

    if (!isApply) {
      return {
        mode: 'dry-run',
        ddl_count: ddlStatements.length,
        orphan_exploring_pets_found: orphanRes.rowCount,
        orphan_samples: orphanRes.rows.slice(0, 15),
      };
    }

    await client.query('BEGIN');
    for (const sql of ddlStatements) {
      await client.query(sql);
    }

    const fixRes = await client.query(`
      UPDATE public.user_pets p
      SET status = 'ready'
      WHERE p.status = 'exploring'
        AND NOT EXISTS (
          SELECT 1
          FROM public.explorer_expeditions e
          WHERE e.status = 'active'
            AND e.user_id = p.user_id
            AND e.pet_id::text = p.pet_id::text
        )
      RETURNING p.pet_id, p.user_id, p.pet_type;
    `);
    await client.query('COMMIT');

    return {
      mode: 'apply',
      ddl_count: ddlStatements.length,
      orphan_exploring_pets_fixed: fixRes.rowCount,
      fixed_rows: fixRes.rows,
    };
  } catch (err) {
    if (isApply) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runMigration()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    });
}
