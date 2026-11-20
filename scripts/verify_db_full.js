import pg from 'pg';
import 'dotenv/config';
const { Client } = pg;

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

async function verify() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');

  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Public tables created:', tablesRes.rows.map(r => r.table_name));

  const userRes = await client.query('SELECT user_id, username, level, exp, linh_thach, max_role_slots FROM users;');
  console.log('Users in DB:', userRes.rows);

  const rolesRes = await client.query('SELECT role_name, role_perk, equipped_slot FROM user_roles WHERE user_id = $1 ORDER BY equipped_slot;', ['757091869183311872']);
  console.log('Fuyumi 5 Equipped Roles:', rolesRes.rows);

  const petRes = await client.query('SELECT pet_name, pet_rarity, element, level, star, power_score FROM user_pets WHERE user_id = $1;', ['757091869183311872']);
  console.log('Fuyumi Pet:', petRes.rows);

  const allPets = await client.query('SELECT count(*) FROM pets;');
  console.log('Total Pet catalog count:', allPets.rows[0].count);

  await client.end();
}

verify().catch(console.error);
