/**
 * scripts/migrate_v1_4.mjs
 * Migration DB cho Bản Cập Nhật SuMi Family v1.4 — « Đạo Áp Cửu Châu & Đại Thám Hiểm »:
 * 1. public.weekly_leaderboard_runs (khóa phát quà 19:00 Chủ Nhật Top 10 Lực Chiến)
 * 2. public.daily_shop_rotations & public.daily_shop_purchases (Shop Ngày chung toàn server)
 * 3. public.parties, public.party_members, public.party_invites (Tổ Đội tối đa 3 người)
 * 4. public.spirit_vein_sessions & public.spirit_vein_fatigue (Chiếm Đoạt Linh Mạch Khung Giờ Vàng)
 * 5. public.explorer_loadouts, public.explorer_expeditions, public.explorer_map_drops, public.explorer_ui_selections
 * 6. public.clan_ui_selections (trạng thái chọn Dropdown /giatoc Component V2)
 * 7. public.user_pets.status ('ready' | 'exploring' | 'injured')
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

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
  console.log('[migrate_v1_4] Connected to Postgres/Supabase.');

  try {
    await client.query('BEGIN');

    // 1. Weekly Leaderboard Runs (19:00 Sunday UTC+7)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_runs (
        week_key varchar(20) PRIMARY KEY,
        distributed_at timestamptz NOT NULL DEFAULT now(),
        top_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
        announcement_text text NOT NULL DEFAULT ''
      );
    `);
    console.log('[migrate_v1_4] Ensured public.weekly_leaderboard_runs.');

    // 2. Daily Shop Rotations & Purchases
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.daily_shop_rotations (
        date_key varchar(10) PRIMARY KEY,
        slots jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS public.daily_shop_purchases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        date_key varchar(10) NOT NULL REFERENCES public.daily_shop_rotations(date_key) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        slot_index int NOT NULL CHECK (slot_index >= 1 AND slot_index <= 20),
        bought_count int NOT NULL DEFAULT 0 CHECK (bought_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (date_key, user_id, slot_index)
      );
    `);
    console.log('[migrate_v1_4] Ensured public.daily_shop_rotations & daily_shop_purchases.');

    // 3. Party System (Max 3 members)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.parties (
        party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        leader_id varchar NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS public.party_members (
        party_id uuid NOT NULL REFERENCES public.parties(party_id) ON DELETE CASCADE,
        user_id varchar NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
        joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (party_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS public.party_invites (
        invite_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        party_id uuid NOT NULL REFERENCES public.parties(party_id) ON DELETE CASCADE,
        inviter_id varchar NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        invitee_id varchar NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
      );
      CREATE INDEX IF NOT EXISTS idx_party_invites_invitee_pending
        ON public.party_invites (invitee_id, status)
        WHERE status = 'pending';
    `);
    console.log('[migrate_v1_4] Ensured public.parties, party_members, party_invites.');

    // 4. Spirit Vein Conquest Sessions & Fatigue
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.spirit_vein_sessions (
        session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slot_key varchar(32) NOT NULL UNIQUE,
        hour_key varchar(20),
        tier_group varchar(8) NOT NULL CHECK (tier_group IN ('low', 'high')),
        tier_code varchar(4) NOT NULL,
        boss_id varchar(32),
        boss_name text NOT NULL,
        boss_power bigint NOT NULL,
        lt_per_min int NOT NULL,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        holder_party_id uuid,
        holder_leader_id varchar,
        holder_clan_id varchar,
        holder_member_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        holder_snapshot jsonb,
        captured_at timestamptz,
        last_settled_at timestamptz,
        status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
        total_lt_paid bigint NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE public.spirit_vein_sessions
        ADD COLUMN IF NOT EXISTS hour_key varchar(20),
        ADD COLUMN IF NOT EXISTS boss_id varchar(32),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
      CREATE INDEX IF NOT EXISTS idx_spirit_vein_hour_status
        ON public.spirit_vein_sessions (hour_key, status);

      CREATE TABLE IF NOT EXISTS public.spirit_vein_fatigue (
        user_id varchar PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
        consecutive_wins int NOT NULL DEFAULT 0 CHECK (consecutive_wins >= 0),
        last_slot_hour varchar(20),
        last_hour_key varchar(20),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE public.spirit_vein_fatigue
        ADD COLUMN IF NOT EXISTS last_hour_key varchar(20);
    `);
    console.log('[migrate_v1_4] Ensured public.spirit_vein_sessions & spirit_vein_fatigue.');

    // 5. Explorer Loadouts, Expeditions, Map Drops & UI Selections
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.explorer_loadouts (
        user_id varchar PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
        pet_id uuid,
        weapon_id varchar(64),
        gem_id varchar(64),
        soul_id varchar(64),
        domain_id varchar(80),
        sense_id varchar(80),
        realm_id varchar(80),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.explorer_expeditions (
        expedition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        map_id varchar(40) NOT NULL,
        duration_hours int NOT NULL CHECK (duration_hours IN (2, 3, 6, 12)),
        effective_seconds int NOT NULL CHECK (effective_seconds > 0),
        food_item_id varchar(40),
        pet_id uuid NOT NULL,
        pet_type varchar(64) NOT NULL,
        pet_name text NOT NULL DEFAULT '',
        pet_is_unique boolean NOT NULL DEFAULT false,
        is_main_pet boolean NOT NULL DEFAULT false,
        locked_equip_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        locked_domain_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        pet_power bigint NOT NULL DEFAULT 0,
        map_power bigint NOT NULL DEFAULT 10000,
        started_at timestamptz NOT NULL DEFAULT now(),
        ends_at timestamptz NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed')),
        outcome_json jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE public.explorer_expeditions
        ADD COLUMN IF NOT EXISTS pet_name text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS pet_is_unique boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
      CREATE UNIQUE INDEX IF NOT EXISTS uq_explorer_active_per_user
        ON public.explorer_expeditions (user_id)
        WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS public.explorer_map_drops (
        drop_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        map_id varchar(40) NOT NULL,
        min_duration_hours int NOT NULL CHECK (min_duration_hours IN (2, 3, 6, 12)),
        item_id varchar(64) NOT NULL,
        item_type varchar(16) NOT NULL,
        enchant_grade varchar(4) NOT NULL DEFAULT 'D',
        dropped_by_user_id varchar NOT NULL,
        claimed_by_user_id varchar,
        status varchar(16) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed')),
        dropped_at timestamptz NOT NULL DEFAULT now(),
        claimed_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS idx_explorer_drops_lookup
        ON public.explorer_map_drops (map_id, status, min_duration_hours, dropped_at);

      CREATE TABLE IF NOT EXISTS public.explorer_ui_selections (
        user_id varchar PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
        selected_duration int DEFAULT 2,
        selected_map_id varchar(40),
        selected_food_id varchar(40),
        draft_pet_id uuid,
        draft_weapon_id varchar(64),
        draft_gem_id varchar(64),
        draft_soul_id varchar(64),
        draft_domain_id varchar(80),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('[migrate_v1_4] Ensured explorer_* tables & indexes.');

    // 6. Clan Component V2 UI Selections
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.clan_ui_selections (
        user_id varchar PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
        view_mode varchar(24) NOT NULL DEFAULT 'overview',
        selected_target_id varchar(64),
        selected_slot_index int,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('[migrate_v1_4] Ensured public.clan_ui_selections.');

    // 7. user_pets.status column + ensure explorer pet_id columns are varchar(64) matching bigint pet_id cleanly
    await client.query(`
      ALTER TABLE public.user_pets
        ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'ready';
      UPDATE public.user_pets SET status = 'ready' WHERE status IS NULL;
      ALTER TABLE public.explorer_loadouts ALTER COLUMN pet_id TYPE varchar(64) USING pet_id::text;
      ALTER TABLE public.explorer_expeditions ALTER COLUMN pet_id TYPE varchar(64) USING pet_id::text;
      ALTER TABLE public.explorer_ui_selections ALTER COLUMN draft_pet_id TYPE varchar(64) USING draft_pet_id::text;
    `);
    console.log('[migrate_v1_4] Ensured public.user_pets.status & explorer pet_id varchar(64).');

    // Grant permissions for Supabase anon/authenticated/service_role if roles exist
    await client.query(`
      DO $$
      BEGIN
        GRANT ALL ON TABLE
          public.weekly_leaderboard_runs,
          public.daily_shop_rotations,
          public.daily_shop_purchases,
          public.parties,
          public.party_members,
          public.party_invites,
          public.spirit_vein_sessions,
          public.spirit_vein_fatigue,
          public.explorer_loadouts,
          public.explorer_expeditions,
          public.explorer_map_drops,
          public.explorer_ui_selections,
          public.clan_ui_selections
        TO postgres, service_role, authenticated, anon;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('[migrate_v1_4] ALL DONE cleanly!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate_v1_4] ROLLED BACK due to error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
