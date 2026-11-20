import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { FUYUMI_USER_ID, PET_CATALOG, STARTER_PET, MYTHIC_UNIQUE_ITEM_IDS } from '../src/data/catalog.js';

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

async function main() {
  const client = new pg.Client({
    connectionString: resolveConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[Migrate] Connected to Supabase PostgreSQL.');

  try {
    await client.query('BEGIN');

    // 1. Add EXP tracking columns & clean defaults on public.users
    await client.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS last_chat_exp_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS voice_joined_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS total_voice_minutes INT DEFAULT 0;
      ALTER TABLE public.users ALTER COLUMN linh_thach SET DEFAULT 0;
      ALTER TABLE public.users ALTER COLUMN custom_title SET DEFAULT 'Tân Thủ Nhập Đạo';
    `);
    console.log('[Migrate] 1. Added EXP tracking columns on public.users.');

    // 2. Sync all 21 pets into 4 canonical tiers (5 Phàm / 5 Linh / 4 Tiên / 6 Thần Thoại + Cửu Vĩ Hồng Hồ)
    for (const pet of PET_CATALOG) {
      await client.query(
        `INSERT INTO public.pets (pet_type, pet_name, element, rarity, base_atk, base_def, base_spd, hax_skill, hax_description, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
          pet.base_atk,
          pet.base_def,
          pet.base_spd,
          pet.hax_skill,
          pet.hax_description,
          pet.icon,
        ]
      );
    }
    console.log('[Migrate] 2. Synced 21 pets into 4 canonical tiers.');

    // 3. Enforce Unique Server-Wide Ownership for the 9 Mythic Equipment Items (1%)
    const mythicListSql = [...MYTHIC_UNIQUE_ITEM_IDS].map((id) => `'${id}'`).join(', ');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mythic_owner
      ON public.user_pet_items (item_id)
      WHERE item_id IN (${mythicListSql});
    `);
    console.log('[Migrate] 3. Enforced partial unique index idx_unique_mythic_owner for 9 Mythic items.');

    // 4. Reset ALL non-Fuyumi members cleanly to Lv.1 beginner state + Starter Pet (Hóa Thạch Nham Nham Thú)
    await client.query(`DELETE FROM public.user_pet_items WHERE user_id <> $1`, [FUYUMI_USER_ID]);
    await client.query(`DELETE FROM public.user_roles WHERE user_id <> $1`, [FUYUMI_USER_ID]);
    await client.query(`DELETE FROM public.user_pets WHERE user_id <> $1`, [FUYUMI_USER_ID]);

    const { rows: resetUsers } = await client.query(
      `UPDATE public.users
       SET level = 1,
           exp = 0,
           linh_thach = 0,
           max_role_slots = 1,
           clan_id = NULL,
           streak = 0,
           custom_title = 'Tân Thủ Nhập Đạo',
           bio = 'Một vị tu sĩ mới bước vào tiên giới SuMi Family',
           avatar_frame = 'default',
           last_chat_exp_at = NULL,
           voice_joined_at = NULL,
           total_voice_minutes = 0,
           updated_at = NOW()
       WHERE user_id <> $1
       RETURNING user_id, username`,
      [FUYUMI_USER_ID]
    );

    // Delete non-Fuyumi mock clans (e.g. ho_ly_mon)
    await client.query(`DELETE FROM public.clans WHERE clan_id <> 'thien_ho_than_toc'`);

    // Grant default Phàm Phẩm starter pet (Hóa Thạch Nham Nham Thú) to every reset member
    for (const u of resetUsers) {
      await client.query(
        `INSERT INTO public.user_pets (
           user_id, pet_name, pet_type, pet_rarity, element, hax_skill, hax_description,
           level, exp, star, atk, def, spd, power_score, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 0, 1, $8, $9, $10, $11, TRUE)`,
        [
          u.user_id,
          STARTER_PET.pet_name,
          STARTER_PET.pet_type,
          STARTER_PET.rarity,
          STARTER_PET.element,
          STARTER_PET.hax_skill,
          STARTER_PET.hax_description,
          STARTER_PET.base_atk,
          STARTER_PET.base_def,
          STARTER_PET.base_spd,
          STARTER_PET.base_power,
        ]
      );
    }
    console.log(`[Migrate] 4. Reset ${resetUsers.length} non-Fuyumi user(s) to Lv.1 + Starter Pet (${STARTER_PET.pet_name}).`);

    await client.query('COMMIT');

    // 5. Post-migration verification snapshot
    const usersSnap = await client.query('SELECT user_id, username, level, exp, linh_thach, max_role_slots, clan_id FROM public.users ORDER BY level DESC');
    const petsSnap = await client.query('SELECT rarity, COUNT(*)::int AS cnt FROM public.pets GROUP BY rarity ORDER BY rarity');
    const userPetsSnap = await client.query('SELECT user_id, pet_type, pet_name, pet_rarity, level, star, atk, def, spd, power_score, is_active FROM public.user_pets ORDER BY level DESC');
    const userItemsSnap = await client.query('SELECT user_id, item_id, slot FROM public.user_pet_items ORDER BY user_id, slot');

    console.log('\n=== POST-MIGRATION SNAPSHOT ===');
    console.log('USERS:', JSON.stringify(usersSnap.rows, null, 2));
    console.log('PET TIER COUNTS:', JSON.stringify(petsSnap.rows, null, 2));
    console.log('USER_PETS:', JSON.stringify(userPetsSnap.rows, null, 2));
    console.log('USER_PET_ITEMS:', JSON.stringify(userItemsSnap.rows, null, 2));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migrate] Rolled back due to error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
