/**
 * scripts/migrate_v1_1.mjs
 * Migration chính thức Update v1.1 (idempotent, bảo toàn 100% dữ liệu hiện có):
 * 1. users.highest_level_claimed + backfill level hiện tại (chống cày lại thưởng Level-Up LT bằng /doiqua)
 * 2. user_quests: pvp_reward_date/today, pve_free_date/today, tower_reset_buy_date/today
 * 3. user_roles, user_pet_items, user_pets: source ('gacha'|'shop'|'gift'|'starter') & paid_price (chống exploit Gacha -> Dismantle)
 * 4. Đồng bộ 41 Linh Thú (pets) & 65 Pháp Bảo (pet_items) từ catalog.js để khóa ngoại (FK) luôn hợp lệ.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PET_CATALOG, EQUIPMENT_CATALOG } from '../src/data/catalog.js';

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
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS highest_level_claimed INTEGER NOT NULL DEFAULT 1;

UPDATE users
  SET highest_level_claimed = GREATEST(
    COALESCE(highest_level_claimed, 1),
    COALESCE(highest_rewarded_level, 1),
    COALESCE(level, 1)
  );

ALTER TABLE user_quests
  ADD COLUMN IF NOT EXISTS pvp_reward_date VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pvp_rewards_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pve_free_date VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pve_free_rewards_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tower_reset_buy_date VARCHAR(10),
  ADD COLUMN IF NOT EXISTS tower_reset_buys_today INT NOT NULL DEFAULT 0;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'gacha',
  ADD COLUMN IF NOT EXISTS paid_price INT NOT NULL DEFAULT 0;

ALTER TABLE user_pet_items
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'gacha',
  ADD COLUMN IF NOT EXISTS paid_price INT NOT NULL DEFAULT 0;

ALTER TABLE user_pets
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'gacha',
  ADD COLUMN IF NOT EXISTS paid_price INT NOT NULL DEFAULT 0;

-- Đánh dấu starter pet hiện tại (chỉ những starter đang có paid_price = 0)
UPDATE user_pets
  SET source = 'starter'
  WHERE pet_type = 'hoa_thach_nham_nham'
    AND paid_price = 0
    AND source = 'gacha';
`;

async function main() {
  const connStr = resolveConnectionString();
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(DDL_SQL);

    for (const p of PET_CATALOG) {
      await client.query(
        `INSERT INTO pets (pet_type, pet_name, element, rarity, base_atk, base_def, base_spd, hax_skill, hax_description, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (pet_type) DO UPDATE SET
           pet_name = EXCLUDED.pet_name,
           element = EXCLUDED.element,
           rarity = EXCLUDED.rarity,
           base_atk = EXCLUDED.base_atk,
           base_def = EXCLUDED.base_def,
           base_spd = EXCLUDED.base_spd,
           hax_skill = EXCLUDED.hax_skill,
           hax_description = EXCLUDED.hax_description`,
        [
          p.pet_type,
          p.pet_name,
          p.element,
          p.rarity,
          p.base_atk,
          p.base_def,
          p.base_spd,
          p.hax_skill,
          p.hax_description,
          p.is_exclusive_fuyumi ? '🦊' : '🐾',
        ]
      );
    }

    for (const it of EQUIPMENT_CATALOG) {
      const shortIcon = it.item_type === 'weapon' ? '⚔️' : it.item_type === 'gem' ? '💎' : '👻';
      await client.query(
        `INSERT INTO pet_items (item_id, item_name, item_type, rarity, element, bonus_atk, bonus_def, bonus_spd, bonus_hp, bonus_crit, hax_skill, hax_description, drop_rate, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
          it.bonus_atk,
          it.bonus_def,
          it.bonus_spd,
          it.bonus_hp,
          it.bonus_crit,
          it.hax_skill,
          it.hax_description,
          it.drop_rate,
          shortIcon,
        ]
      );
    }

    await client.query('COMMIT');

    const verify = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM pets) AS pets_count,
        (SELECT COUNT(*) FROM pet_items) AS pet_items_count,
        (SELECT COUNT(*) FROM users WHERE highest_level_claimed >= level) AS users_claimed_synced,
        (SELECT COUNT(*) FROM users) AS total_users;
    `);
    console.log('MIGRATE_V1_1_OK:', verify.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('MIGRATE_V1_1_ERR:', err);
  process.exit(1);
});
