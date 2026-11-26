/**
 * scripts/migrate_v1_7.mjs
 * Migration DB cho SuMi Family Ver 1.7 (Mặc định --dry-run an toàn; chỉ ghi DB khi truyền --apply):
 * 1. Bổ sung cột Ver 1.7 trên public.users, public.user_pets, public.user_pet_items, public.user_farm_plots, public.user_alchemy_furnaces
 * 2. Tạo partial unique index uq_user_pet_items_unique_item trên user_pet_items(item_id) WHERE is_unique = TRUE
 * 3. Tạo bảng public.special_shop_purchases (Shop Đặc Biệt Chủ Nhật)
 * 4. Upsert đủ 151 Linh Thú vào public.pets & 264 Pháp Bảo vào public.pet_items
 * 5. Cấp bù 1 Mảnh Tinh Hoa Hỗn Độn (chaos_essence_shard) cho user F152 (1311778045991850019), idempotent 100%
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import 'dotenv/config';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  MYTHIC_UNIQUE_ITEM_IDS,
} from '../src/data/catalog.js';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

export const F152_RETROACTIVE_USER_ID = '1311778045991850019';
export const F152_RETROACTIVE_GRANT_ITEM = 'chaos_essence_shard';
export const F152_RETROACTIVE_GRANT_QTY = 1;

export function buildV17DdlStatements() {
  const uniqueIdsSql = [...MYTHIC_UNIQUE_ITEM_IDS]
    .map((id) => `'${String(id).replace(/'/g, "''")}'`)
    .join(', ');

  return [
    `ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS red_gold_crystals INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS weekly_tt_converted INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS weekly_tt_week_key TEXT,
      ADD COLUMN IF NOT EXISTS farm_auto_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS farm_growth_med_active BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS farm_yield_starch_active BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS abs_enchant_charm_runs INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pending_mythic_selectors INTEGER NOT NULL DEFAULT 0;`,

    `ALTER TABLE public.user_pets
      ADD COLUMN IF NOT EXISTS is_evolved BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS evolved_at TIMESTAMPTZ;`,

    `ALTER TABLE public.user_pet_items
      ADD COLUMN IF NOT EXISTS is_unique BOOLEAN NOT NULL DEFAULT FALSE;`,

    uniqueIdsSql
      ? `UPDATE public.user_pet_items SET is_unique = TRUE WHERE item_id IN (${uniqueIdsSql}) AND is_unique IS DISTINCT FROM TRUE;`
      : null,

    `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_pet_items_unique_item
      ON public.user_pet_items (item_id)
      WHERE is_unique = TRUE;`,

    `ALTER TABLE public.user_farm_plots
      ADD COLUMN IF NOT EXISTS protected_this_cycle BOOLEAN NOT NULL DEFAULT FALSE;`,

    `ALTER TABLE public.user_alchemy_furnaces
      ADD COLUMN IF NOT EXISTS protected_this_cycle BOOLEAN NOT NULL DEFAULT FALSE;`,

    `CREATE TABLE IF NOT EXISTS public.special_shop_purchases (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      week_key TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, item_id, week_key)
    );`,

    `CREATE TABLE IF NOT EXISTS public.v17_migration_markers (
      marker_key TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      note TEXT
    );`,
  ].filter(Boolean);
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
  const ddlStatements = buildV17DdlStatements();

  if (!isApply) {
    return {
      mode: 'dry-run',
      ddl_count: ddlStatements.length,
      pets_upsert_count: PET_CATALOG.length,
      items_upsert_count: EQUIPMENT_CATALOG.length,
      retroactive_grant: {
        user_id: F152_RETROACTIVE_USER_ID,
        item_id: F152_RETROACTIVE_GRANT_ITEM,
        quantity: F152_RETROACTIVE_GRANT_QTY,
      },
      ddlStatements,
    };
  }

  const client = await connectWithFallback();
  try {
    await client.query('BEGIN');
    for (const sql of ddlStatements) {
      await client.query(sql);
    }

    for (const item of EQUIPMENT_CATALOG) {
      await client.query(
        `INSERT INTO public.pet_items (
          item_id, item_name, item_type, rarity, element,
          bonus_atk, bonus_def, bonus_spd, bonus_hp, bonus_crit,
          hax_skill, hax_description, drop_rate, icon
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (item_id) DO UPDATE SET
          item_name = EXCLUDED.item_name,
          item_type = EXCLUDED.item_type,
          rarity = EXCLUDED.rarity,
          element = EXCLUDED.element,
          bonus_atk = EXCLUDED.bonus_atk,
          bonus_def = EXCLUDED.bonus_def,
          bonus_spd = EXCLUDED.bonus_spd,
          bonus_hp = EXCLUDED.bonus_hp,
          bonus_crit = EXCLUDED.bonus_crit,
          hax_skill = EXCLUDED.hax_skill,
          hax_description = EXCLUDED.hax_description,
          drop_rate = EXCLUDED.drop_rate,
          icon = EXCLUDED.icon`,
        [
          item.item_id,
          item.item_name,
          item.item_type,
          item.rarity,
          item.element,
          Number(item.bonus_atk || 0),
          Number(item.bonus_def || 0),
          Number(item.bonus_spd || 0),
          Number(item.bonus_hp || 0),
          Number(item.bonus_crit || 0),
          item.hax_skill || null,
          item.hax_description || null,
          Number(item.drop_rate || 0),
          item.icon || '',
        ],
      );
    }

    for (const pet of PET_CATALOG) {
      await client.query(
        `INSERT INTO public.pets (
          pet_type, pet_name, element, rarity,
          base_atk, base_def, base_spd,
          hax_skill, hax_description, icon, prompt_ai
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (pet_type) DO UPDATE SET
          pet_name = EXCLUDED.pet_name,
          element = EXCLUDED.element,
          rarity = EXCLUDED.rarity,
          base_atk = EXCLUDED.base_atk,
          base_def = EXCLUDED.base_def,
          base_spd = EXCLUDED.base_spd,
          hax_skill = EXCLUDED.hax_skill,
          hax_description = EXCLUDED.hax_description,
          icon = EXCLUDED.icon`,
        [
          pet.pet_type,
          pet.pet_name,
          pet.element,
          pet.rarity,
          Number(pet.base_atk || 100),
          Number(pet.base_def || 100),
          Number(pet.base_spd || 100),
          pet.hax_skill || null,
          pet.hax_description || null,
          pet.icon || '',
          null,
        ],
      );
    }

    // Cấp bù F152 (+1 Mảnh Tinh Hoa Hỗn Độn, idempotent bằng marker)
    const markerRes = await client.query(
      `INSERT INTO public.v17_migration_markers (marker_key, note)
       VALUES ($1, $2)
       ON CONFLICT (marker_key) DO NOTHING
       RETURNING marker_key`,
      [`f152_chaos_shard_${F152_RETROACTIVE_USER_ID}`, 'Retroactive F100 tower milestone +1 chaos_essence_shard'],
    );
    let retroactiveApplied = false;
    if (markerRes.rowCount > 0) {
      await client.query(
        `INSERT INTO public.user_inventory (user_id, item_id, item_category, quantity, updated_at)
         VALUES ($1, $2, 'consumable', $3, NOW())
         ON CONFLICT (user_id, item_id) DO UPDATE SET
           quantity = public.user_inventory.quantity + EXCLUDED.quantity,
           updated_at = NOW()`,
        [F152_RETROACTIVE_USER_ID, F152_RETROACTIVE_GRANT_ITEM, F152_RETROACTIVE_GRANT_QTY],
      );
      retroactiveApplied = true;
    }

    await client.query('COMMIT');
    return {
      mode: 'apply',
      ddl_count: ddlStatements.length,
      pets_upsert_count: PET_CATALOG.length,
      items_upsert_count: EQUIPMENT_CATALOG.length,
      retroactive_applied: retroactiveApplied,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isCli) {
  runMigration(process.argv.slice(2))
    .then((res) => {
      console.log('[migrate_v1_7]', res.mode.toUpperCase(), {
        ddl_count: res.ddl_count,
        pets_upsert_count: res.pets_upsert_count,
        items_upsert_count: res.items_upsert_count,
        retroactive_grant: res.retroactive_grant || res.retroactive_applied,
      });
    })
    .catch((err) => {
      console.error('[migrate_v1_7] FAILED:', err);
      process.exit(1);
    });
}
