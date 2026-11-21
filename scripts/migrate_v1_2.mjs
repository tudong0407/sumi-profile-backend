/**
 * scripts/migrate_v1_2.mjs
 * Migration chính thức Update v1.2 (idempotent, bảo toàn 100% dữ liệu hiện có):
 * 1. public.user_pets & public.user_pet_items: enchant_grade ('D'|'C'|'B'|'A'|'S'), enchant_pity (INT)
 * 2. public.v_user_equipped_items: bổ sung enchant_grade, enchant_pity
 * 3. public.users: last_seen_update_version (DEFAULT '1.1' cho user cũ; user mới tạo ở 1.2)
 * 4. public.user_quests: Đá Khắc Ấn shop daily limit, Jobs (/job), Nhiệm Vụ Tuần (/nhiemvu)
 * 5. Backfill random D-A (40/32/20/8%) 1 lần cho Pet/Pháp Bảo cũ + set Fuyumi (757091869183311872) S-grade.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

dotenv.config();

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
    if (creds.password && creds.projectId) {
      return `postgresql://postgres:${encodeURIComponent(creds.password)}@db.${creds.projectId}.supabase.co:5432/postgres`;
    }
  }
  throw new Error('Missing DATABASE_URL / SUPABASE_DB_PASSWORD or local supabase_credentials.json');
}

const { Client } = pg;

const DDL_SQL = `
ALTER TABLE public.user_pets
  ADD COLUMN IF NOT EXISTS enchant_grade VARCHAR(2) NOT NULL DEFAULT 'D',
  ADD COLUMN IF NOT EXISTS enchant_pity INT NOT NULL DEFAULT 0;

ALTER TABLE public.user_pet_items
  ADD COLUMN IF NOT EXISTS enchant_grade VARCHAR(2) NOT NULL DEFAULT 'D',
  ADD COLUMN IF NOT EXISTS enchant_pity INT NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_update_version VARCHAR(16) NOT NULL DEFAULT '1.1';

UPDATE public.users
  SET last_seen_update_version = '1.1'
  WHERE last_seen_update_version IS NULL OR last_seen_update_version = '';

ALTER TABLE public.user_quests
  ADD COLUMN IF NOT EXISTS enchant_stone_buy_date VARCHAR(10),
  ADD COLUMN IF NOT EXISTS enchant_stone_buys_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_date VARCHAR(10),
  ADD COLUMN IF NOT EXISTS jobs_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_job_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_job_id VARCHAR(40),
  ADD COLUMN IF NOT EXISTS weekly_week_key VARCHAR(16),
  ADD COLUMN IF NOT EXISTS weekly_jobs_done INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_battle_wins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_exp_earned INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_claimed_jobs BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weekly_claimed_wins BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weekly_claimed_exp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weekly_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE VIEW public.v_user_equipped_items AS
  SELECT upi.id AS user_item_id,
    upi.user_id,
    upi.equipped_to_pet,
    upi.slot,
    pi.item_id,
    pi.item_name,
    pi.item_type,
    pi.rarity,
    pi.element,
    pi.bonus_atk,
    pi.bonus_def,
    pi.bonus_spd,
    pi.bonus_hp,
    pi.bonus_crit,
    pi.hax_skill,
    pi.hax_description,
    pi.icon,
    upi.enchant_grade,
    upi.enchant_pity
  FROM public.user_pet_items upi
  JOIN public.pet_items pi ON upi.item_id::text = pi.item_id::text;

UPDATE public.pet_items
  SET drop_rate = CASE
    WHEN rarity ILIKE '%Thần Thoại%' OR rarity ILIKE '%Than Thoai%' THEN 0.5
    WHEN rarity ILIKE '%Tiên Phẩm%' OR rarity ILIKE '%Tien Pham%' THEN 14.0
    WHEN rarity ILIKE '%Linh Phẩm%' OR rarity ILIKE '%Linh Pham%' THEN 25.0
    ELSE 60.5
  END;
`;

async function main() {
  const connStr = resolveConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');

    const preCols = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name IN ('user_pets', 'user_pet_items') AND column_name = 'enchant_grade')
          OR (table_name = 'users' AND column_name = 'last_seen_update_version'));
    `);
    const hadPetEnchant = preCols.rows.some((r) => r.table_name === 'user_pets');
    const hadItemEnchant = preCols.rows.some((r) => r.table_name === 'user_pet_items');

    await client.query(DDL_SQL);

    if (!hadPetEnchant) {
      await client.query(`
        UPDATE public.user_pets up
        SET enchant_grade = CASE
          WHEN rnd.r < 0.40 THEN 'D'
          WHEN rnd.r < 0.72 THEN 'C'
          WHEN rnd.r < 0.92 THEN 'B'
          ELSE 'A'
        END
        FROM (
          SELECT pet_id, random() AS r
          FROM public.user_pets
        ) rnd
        WHERE up.pet_id = rnd.pet_id;
      `);
    }

    if (!hadItemEnchant) {
      await client.query(`
        UPDATE public.user_pet_items upi
        SET enchant_grade = CASE
          WHEN rnd.r < 0.40 THEN 'D'
          WHEN rnd.r < 0.72 THEN 'C'
          WHEN rnd.r < 0.92 THEN 'B'
          ELSE 'A'
        END
        FROM (
          SELECT id, random() AS r
          FROM public.user_pet_items
        ) rnd
        WHERE upi.id = rnd.id;
      `);
    }

    // Luôn bảo toàn & nâng cấp S cho Cửu Vĩ Hồng Hồ + 3 Pháp Bảo Thần Thoại Độc Bản của Tiểu thư Fuyumi
    await client.query(`
      UPDATE public.user_pets
      SET enchant_grade = 'S', enchant_pity = 0
      WHERE user_id = '757091869183311872' AND pet_type = 'cuu_vi_hong_ho';

      UPDATE public.user_pet_items
      SET enchant_grade = 'S', enchant_pity = 0
      WHERE user_id = '757091869183311872'
        AND item_id IN ('weapon_mythic_1', 'weapon_mythic_2', 'weapon_mythic_3', 'gem_mythic_1', 'gem_mythic_2', 'gem_mythic_3', 'soul_mythic_1', 'soul_mythic_2', 'soul_mythic_3');
    `);

    await client.query('COMMIT');

    const verify = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.users WHERE last_seen_update_version = '1.1') AS users_at_1_1,
        (SELECT COUNT(*)::int FROM public.users) AS total_users,
        (SELECT json_object_agg(enchant_grade, cnt) FROM (SELECT enchant_grade, COUNT(*)::int AS cnt FROM public.user_pets GROUP BY enchant_grade) t) AS pet_grades,
        (SELECT json_object_agg(enchant_grade, cnt) FROM (SELECT enchant_grade, COUNT(*)::int AS cnt FROM public.user_pet_items GROUP BY enchant_grade) t2) AS item_grades,
        (SELECT enchant_grade FROM public.user_pets WHERE user_id = '757091869183311872' AND pet_type = 'cuu_vi_hong_ho' LIMIT 1) AS fuyumi_pet_grade,
        (SELECT array_agg(item_id || ':' || enchant_grade ORDER BY item_id) FROM public.user_pet_items WHERE user_id = '757091869183311872') AS fuyumi_item_grades;
    `);
    console.log('MIGRATE_V1_2_OK:', JSON.stringify(verify.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('MIGRATE_V1_2_ERR:', err);
  process.exit(1);
});
