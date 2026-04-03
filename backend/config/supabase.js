import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder-key';

// Service role client — bypasses RLS, used on backend only
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create a client with a user's JWT for RLS-aware queries
export function createSupabaseClient(accessToken) {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || 'placeholder-key', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
