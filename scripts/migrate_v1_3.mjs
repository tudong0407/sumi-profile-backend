/**
 * scripts/migrate_v1_3.mjs
 * Migration DB & Catalog Sync cho Bản Cập Nhật Đại Đạo v1.3:
 * 1. Đồng bộ toàn bộ 165 Pháp Bảo vào public.pet_items & 91 Linh Thú vào public.pets.
 * 2. Tạo bảng public.user_domains (Linh Vực • Thần Thức • Thần Cảnh) + Global Unique Index.
 * 3. Tạo bảng public.user_farm_plots (4-6 ô Nông Trại Thời Gian Thực).
 * 4. Bổ sung user_pets.is_unique + Global Unique Index cho 10 Pet Thần Thoại Độc Nhất.
 * 5. Mở rộng users (farm_slots_unlocked, farm_essence) & user_quests (5 Nhiệm Vụ Ngày + thưởng lẻ).
 * 6. Cấp & trang bị sẵn Bộ Linh Vực Độc Tôn Tối Thượng cho Tiểu thư Fuyumi (757091869183311872).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';
import {
  EQUIPMENT_CATALOG,
  PET_CATALOG,
  MYTHIC_UNIQUE_PET_TYPES,
  FUYUMI_USER_ID,
} from '../src/data/catalog.js';

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
  console.log('[migrate_v1_3] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');

    // 1. Upsert all 165 equipment items -> public.pet_items
    for (const it of EQUIPMENT_CATALOG) {
      const safeIcon = it.item_type === 'weapon' ? '⚔️' : it.item_type === 'gem' ? '💎' : '🦊';
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
          drop_rate = EXCLUDED.drop_rate`,
        [
          it.item_id,
          it.item_name,
          it.item_type,
          it.rarity,
          it.element,
          Number(it.bonus_atk) || 0,
          Number(it.bonus_def) || 0,
          Number(it.bonus_spd) || 0,
          Number(it.bonus_hp) || 0,
          Number(it.bonus_crit) || 0,
          it.hax_skill || null,
          it.hax_description || '',
          Number(it.drop_rate) || 0,
          safeIcon,
        ],
      );
    }
    console.log(`[migrate_v1_3] Synced ${EQUIPMENT_CATALOG.length} items into public.pet_items.`);

    // 2. Upsert all 91 pets -> public.pets
    for (const p of PET_CATALOG) {
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
          prompt_ai = COALESCE(EXCLUDED.prompt_ai, public.pets.prompt_ai)`,
        [
          p.pet_type,
          p.pet_name,
          p.element,
          p.rarity,
          Number(p.base_atk) || 100,
          Number(p.base_def) || 100,
          Number(p.base_spd) || 100,
          p.hax_skill || 'Thú Hồn',
          p.hax_description || '',
          p.pet_type === 'cuu_vi_hong_ho' ? '🦊' : '🐾',
          p.visual_prompt || null,
        ],
      );
    }
    console.log(`[migrate_v1_3] Synced ${PET_CATALOG.length} pets into public.pets.`);

    // 3. Create public.user_domains + indexes
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_domains (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        entity_kind varchar(16) NOT NULL CHECK (entity_kind IN ('domain', 'sense', 'realm')),
        entity_id varchar(80) NOT NULL,
        quantity int NOT NULL DEFAULT 1 CHECK (quantity >= 1),
        is_equipped boolean NOT NULL DEFAULT false,
        is_unique boolean NOT NULL DEFAULT false,
        source varchar(32) NOT NULL DEFAULT 'gacha',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, entity_kind, entity_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_domains_unique_global
        ON public.user_domains (entity_kind, entity_id)
        WHERE is_unique = true;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_domains_equipped_slot
        ON public.user_domains (user_id, entity_kind)
        WHERE is_equipped = true;
    `);
    console.log('[migrate_v1_3] Ensured public.user_domains & indexes.');

    // 4. Create public.user_farm_plots
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_farm_plots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        slot_index int NOT NULL CHECK (slot_index >= 1 AND slot_index <= 6),
        plot_type varchar(16) NOT NULL CHECK (plot_type IN ('linh_dien', 'linh_cac')),
        seed_id varchar(64),
        status varchar(16) NOT NULL DEFAULT 'empty' CHECK (status IN ('empty', 'growing', 'ready', 'wilted')),
        planted_at timestamptz,
        last_cared_at timestamptz,
        care_count int NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, slot_index)
      );
    `);
    console.log('[migrate_v1_3] Ensured public.user_farm_plots.');

    // 5. user_pets.is_unique + global unique index
    await client.query(`
      ALTER TABLE public.user_pets
        ADD COLUMN IF NOT EXISTS is_unique boolean NOT NULL DEFAULT false;
    `);
    const uniquePetArr = Array.from(MYTHIC_UNIQUE_PET_TYPES);
    if (uniquePetArr.length > 0) {
      await client.query(
        `UPDATE public.user_pets SET is_unique = true WHERE pet_type = ANY($1) AND is_unique = false`,
        [uniquePetArr],
      );
    }
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_pets_unique_global
        ON public.user_pets (pet_type)
        WHERE is_unique = true;
    `);
    console.log('[migrate_v1_3] Ensured public.user_pets.is_unique & global unique index.');

    // 6. users farm columns
    await client.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS farm_slots_unlocked int NOT NULL DEFAULT 4,
        ADD COLUMN IF NOT EXISTS farm_essence int NOT NULL DEFAULT 0;
    `);
    console.log('[migrate_v1_3] Ensured users.farm_slots_unlocked & farm_essence.');

    // 7. user_quests 5 Daily Quests columns (keep existing job_date / jobs_today intact)
    await client.query(`
      ALTER TABLE public.user_quests
        ADD COLUMN IF NOT EXISTS wins_today int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS farm_or_mg_today int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS daily_claimed_q1 boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS daily_claimed_q2 boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS daily_claimed_q3 boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS daily_claimed_q4 boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS daily_claimed_q5 boolean NOT NULL DEFAULT false;
    `);
    console.log('[migrate_v1_3] Ensured user_quests 5 Daily Quest columns.');

    // 8. Seed Fuyumi's Supreme Domain Loadout
    const fuyumiCheck = await client.query('SELECT user_id FROM public.users WHERE user_id = $1', [FUYUMI_USER_ID]);
    if (fuyumiCheck.rows.length > 0) {
      const supremeSet = [
        ['domain', 'domain_fuyumi_cuu_vi_hong_mong'],
        ['sense', 'sense_fuyumi_thai_thuong_hong_ho'],
        ['realm', 'realm_fuyumi_van_co_tuyet_diet'],
      ];
      for (const [kind, entityId] of supremeSet) {
        await client.query(
          `UPDATE public.user_domains SET is_equipped = false WHERE user_id = $1 AND entity_kind = $2 AND entity_id <> $3`,
          [FUYUMI_USER_ID, kind, entityId],
        );
        await client.query(
          `INSERT INTO public.user_domains (user_id, entity_kind, entity_id, quantity, is_equipped, is_unique, source)
           VALUES ($1, $2, $3, 1, true, true, 'supreme_exclusive')
           ON CONFLICT (user_id, entity_kind, entity_id) DO UPDATE SET
             is_equipped = true,
             is_unique = true,
             updated_at = now()`,
          [FUYUMI_USER_ID, kind, entityId],
        );
      }
      console.log(`[migrate_v1_3] Seeded & equipped Fuyumi (${FUYUMI_USER_ID}) Supreme Domain set.`);
    }

    await client.query('COMMIT');
    console.log('[migrate_v1_3] ALL DONE cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate_v1_3] ROLLED BACK due to error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
