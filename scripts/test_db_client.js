import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/.env' });

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase.from('users').select('*').limit(5);
  console.log('Result:', { data, error });
}

test();
