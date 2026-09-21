import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';

/**
 * Cliente ligado a la sesion del navegador. Se usa solo para saber quien es
 * el administrador que entro al panel; los datos siguen leyendose con
 * supabaseAdmin().
 */
export async function supabaseSession() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // En un Server Component las cookies son de solo lectura; el
          // middleware ya se encarga de refrescar la sesion.
        }
      },
    },
  });
}

export async function currentAdmin() {
  const supabase = await supabaseSession();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
