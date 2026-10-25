import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function clearStoredAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(authStorageKey);
    window.sessionStorage.removeItem(authStorageKey);
  } catch {
    // El estado en memoria también se limpia desde AuthContext.
  }
}
