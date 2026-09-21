import Link from 'next/link';
import type { Metadata } from 'next';

import InstallPrompt from '@/components/InstallPrompt';
import SignOutButton from '@/components/SignOutButton';
import { currentAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s · Panel' },
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: '/admin', label: 'Agenda' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/mensajes', label: 'Mensajes' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();

  // El login usa este mismo layout; ahi no hay sesion todavia.
  if (!admin) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-ink-800 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-300 hover:bg-ink-850 hover:text-ink-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <InstallPrompt />
        {children}
      </main>
    </div>
  );
}
