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

const SQL = `
ALTER TABLE public.user_pets
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1);

ALTER TABLE public.user_pet_items
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1);

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
    upi.enchant_pity,
    upi.quantity
  FROM public.user_pet_items upi
  JOIN public.pet_items pi ON upi.item_id::text = pi.item_id::text;
`;

async function main() {
  const client = new Client({ connectionString: resolveConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
    const res = await client.query(`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('user_pets', 'user_pet_items')
        AND column_name = 'quantity'
      ORDER BY table_name;
    `);
    console.log('[Migrate v1.2 Stack Qty] Columns verified:', JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[Migrate v1.2 Stack Qty] FAILED:', err);
  process.exit(1);
});
