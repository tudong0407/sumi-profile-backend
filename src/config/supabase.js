import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[Supabase] Initialized client successfully for:', supabaseUrl);
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err.message);
    supabase = null;
  }
} else {
  console.log('[Supabase] No valid credentials provided. Running in standalone / mock fallback mode.');
}

export default supabase;
