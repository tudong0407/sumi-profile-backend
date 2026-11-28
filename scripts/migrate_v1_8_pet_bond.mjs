/**
 * scripts/migrate_v1_8_pet_bond.mjs
 * Migration DB cho SuMi Family Ver 1.8B (Mặc định --dry-run; truyền --apply để ghi DB):
 *   1. Bổ sung các cột Thiện Cảm / Chat AI / Tự Thu Hoạch / Viền Chân Thần trên public.user_pets
 *   2. Bổ sung cột pet_auto_rolled_cycle trên public.user_farm_plots (chỉ roll 1 lần / vụ chín)
 *   3. Tạo bảng public.pet_chat_history (lưu trượt tối đa 5 cặp = 10 câu gần nhất mỗi Pet)
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

export function buildV18PetBondDdlStatements() {
  return [
    `ALTER TABLE public.user_pets
      ADD COLUMN IF NOT EXISTS affection_points INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS affection_tier SMALLINT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS daily_interact_date TEXT,
      ADD COLUMN IF NOT EXISTS daily_interact_count SMALLINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_gift_pts_date TEXT,
      ADD COLUMN IF NOT EXISTS daily_gift_pts_used INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_companion_reward_date TEXT,
      ADD COLUMN IF NOT EXISTS daily_ai_chat_date TEXT,
      ADD COLUMN IF NOT EXISTS daily_ai_chat_count SMALLINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bond_frame_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_interacted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS daily_combat_bond_date TEXT,
      ADD COLUMN IF NOT EXISTS daily_battle_bond_pts SMALLINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS daily_tower_vein_bond_pts SMALLINT NOT NULL DEFAULT 0;`,

    `ALTER TABLE public.user_farm_plots
      ADD COLUMN IF NOT EXISTS pet_auto_rolled_cycle TEXT;`,

    `CREATE TABLE IF NOT EXISTS public.pet_chat_history (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      pet_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'model')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_pet_chat_history_user_pet
      ON public.pet_chat_history (user_id, pet_id, created_at DESC);`,
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
  const ddlStatements = buildV18PetBondDdlStatements();
  const client = await connectWithFallback();

  try {
    if (!isApply) {
      return {
        mode: 'dry-run',
        ddl_count: ddlStatements.length,
        ddl_preview: ddlStatements,
      };
    }

    for (const sql of ddlStatements) {
      await client.query(sql);
    }

    const verify = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_pets'
        AND column_name IN ('affection_points', 'affection_tier', 'bond_frame_unlocked', 'daily_ai_chat_count')
      ORDER BY column_name;
    `);
    const chatTbl = await client.query(`SELECT to_regclass('public.pet_chat_history') AS tbl;`);

    return {
      mode: 'apply',
      ddl_count: ddlStatements.length,
      pet_columns_verified: verify.rows.map((r) => r.column_name),
      chat_table_verified: Boolean(chatTbl.rows?.[0]?.tbl),
    };
  } finally {
    await client.end().catch(() => {});
  }
}

const isCli = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isCli) {
  runMigration(process.argv.slice(2))
    .then((res) => {
      console.log('[migrate_v1_8_pet_bond] OK:', JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error('[migrate_v1_8_pet_bond] FAILED:', err);
      process.exit(1);
    });
}
