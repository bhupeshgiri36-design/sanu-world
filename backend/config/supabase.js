import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Lazy initialization pattern so AI Studio doesn't crash if env vars are missing
let supabaseInstance = null;

export function getSupabase() {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase URL or Key is missing. Using in-memory fallback for AI Studio compatibility.");
      return null;
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}
