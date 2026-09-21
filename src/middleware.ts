import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Puerta del panel. Refresca la sesion de Supabase en cada request y manda
 * al login a quien no traiga una valida.
 *
 * Lee las variables directo de process.env (y no de @/lib/env) porque el
 * middleware corre en el runtime Edge, donde no vive el codigo de servidor.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin configuracion no hay a quien preguntarle: mejor mandar al login que
  // abrir el panel de par en par.
  if (!url || !key) {
    return redirectToLogin(request);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirectToLogin(request);

  return response;
}

function redirectToLogin(request: NextRequest) {
  const login = new URL('/admin/login', request.url);
  login.searchParams.set('destino', request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Todo /admin salvo el propio login.
  matcher: ['/admin/((?!login).*)', '/admin'],
};
