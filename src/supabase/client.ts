// Supabase client: the one connection between the browser app and the
// backend (Postgres + Auth). Created only when the VITE_ env vars are
// set; otherwise the app shows the setup card instead of crashing.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Captured at import time, before the auth client processes the URL: an
// invite / password-recovery email lands back on the app with
// #access_token=...&type=invite (or type=recovery). The store reads this
// flag after the session is established and shows the set-password
// screen. Reading it later would be too late: the hash is cleaned up
// once the session is handled.
export const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string)
  : null;

/** Current session JWT, for authenticated server-function calls. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Remove the auth hash from the URL without reloading the page. */
export function clearAuthHash(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
