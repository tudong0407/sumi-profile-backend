import pg from 'pg';
import 'dotenv/config';

const password = process.env.SUPABASE_DB_PASSWORD || '';
const projectRef = process.env.SUPABASE_PROJECT_REF || '';
const connectionString =
  process.env.DATABASE_URL ||
  (password && projectRef
    ? `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`
    : '');
if (!connectionString) {
  throw new Error('Missing DATABASE_URL or SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF in environment.');
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  const itemsCount = await client.query('SELECT count(*) FROM pet_items;');
  console.log('Total pet_items count:', itemsCount.rows[0].count);
  
  const itemsBreakdown = await client.query('SELECT item_type, rarity, count(*) FROM pet_items GROUP BY item_type, rarity ORDER BY item_type, rarity;');
  console.log('pet_items breakdown:\n', itemsBreakdown.rows);

  const viewRows = await client.query('SELECT * FROM v_user_equipped_items WHERE user_id = $1;', ['757091869183311872']);
  console.log('Fuyumi equipped items from view:\n', viewRows.rows);

  const viewDef = await client.query("SELECT pg_get_viewdef('v_user_equipped_items', true);");
  console.log('View definition:\n', viewDef.rows[0].pg_get_viewdef);

  await client.end();
}
run().catch(console.error);
