import type { Metadata } from 'next';

import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { destino } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold">Panel de la peluqueria</h1>
      <p className="mt-2 text-sm text-ink-400">
        Entra con el correo que diste de alta en Supabase.
      </p>

      <div className="mt-8">
        <LoginForm destino={destino ?? '/admin'} />
      </div>
    </main>
  );
}
