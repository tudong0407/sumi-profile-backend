import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const password = 'TXU4k3VtkkFMAKl7';
const projectRef = 'lfvtysacdoadtvskqgkt';

const configs = [
  {
    name: 'Pooler (ap-southeast-1)',
    connectionString: `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
  },
  {
    name: 'Direct Host',
    connectionString: `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`
  }
];

async function main() {
  const sql = fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/schema.sql', 'utf8');
  console.log(`Read schema.sql: ${sql.length} bytes`);

  for (const cfg of configs) {
    console.log(`\nTrying ${cfg.name}...`);
    const client = new Client({
      connectionString: cfg.connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`Connected successfully via ${cfg.name}!`);
      
      console.log('Executing schema.sql...');
      await client.query(sql);
      console.log('Schema executed successfully!');

      // Verify users table
      const res = await client.query('SELECT user_id, username, level, roles_unlocked FROM users;');
      console.log('Initial users count:', res.rows.length);
      console.log('User rows:', res.rows);

      // Verify pets table
      const petRes = await client.query('SELECT count(*) FROM pets;');
      console.log('Pets count:', petRes.rows[0].count);

      await client.end();
      return;
    } catch (err) {
      console.error(`Failed with ${cfg.name}:`, err.message);
      try { await client.end(); } catch (e) {}
    }
  }
}

main().catch(console.error);
