import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;
let initialized = false;

/**
 * Returns a shared Supabase client, or null if Supabase isn't configured.
 * When null, roomService and adminController fall back to their in-memory
 * implementations — this is what lets the app run locally without a DB.
 */
export function getSupabase() {
  if (!initialized) {
    initialized = true;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (url && key) {
      supabaseClient = createClient(url, key);
      console.log('Supabase client initialized.');
    } else {
      console.warn(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — running in in-memory mode. ' +
        'Rooms and admin data will NOT persist across server restarts.'
      );
    }
  }
  return supabaseClient;
}