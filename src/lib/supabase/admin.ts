import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

let cached: SupabaseClient | null = null;

/**
 * Cliente con service-role: salta RLS y por eso vive unicamente en el
 * servidor. Todas las lecturas/escrituras de la app pasan por aqui, porque
 * las tablas no tienen ni una politica publica.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
