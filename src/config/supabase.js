import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://lfvtysacdoadtvskqgkt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdnR5c2FjZG9hZHR2c2txZ2t0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTA4Nzc1NiwiZXhwIjoyMTEwNjYzNzU2fQ.an706_l9ItnKr10NjXq6i6X3jb2UP7Y7nISXX-_dH9k';

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
