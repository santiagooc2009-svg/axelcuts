'use client';

import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

/** Cliente del navegador: solo para login/logout del panel. */
export function supabaseBrowser() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
