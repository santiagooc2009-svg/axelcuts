import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import PushToggle from '@/components/PushToggle';
import { ButtonLink } from '@/components/ui';
import { getSettings } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatLongDate } from '@/lib/time';
import type { Customer } from '@/types/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tu tarjeta',
  robots: { index: false, follow: false },
};

export default async function TarjetaPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const settings = await getSettings();

  const { data } = await supabaseAdmin()
    .from('customers')
    .select('*')
    .eq('loyalty_code', code.toUpperCase())
    .maybeSingle();

  if (!data) notFound();
  const customer = data as Customer;

  const goal = settings.loyalty_goal;
  const progress = Math.min(customer.stamps, goal);
  const complete = customer.stamps >= goal;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Link href="/" className="text-sm text-ink-400 hover:text-ink-100">
        ← {settings.business_name}
      </Link>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-ink-800 bg-ink-850 px-6 py-5">
          <p className="text-xs font-semibold tracking-[0.18em] text-copper-400 uppercase">
            Tarjeta de fidelidad
          </p>
          <h1 className="mt-1.5 text-2xl font-bold">{customer.name}</h1>
          <p className="mt-0.5 font-mono text-sm text-ink-400">{customer.loyalty_code}</p>
        </div>

        <div className="px-6 py-8">
          {/* Sellos. Cada circulo es una visita atendida. */}
          <div className="grid grid-cols-4 gap-3" role="img"
               aria-label={`${progress} de ${goal} sellos completados`}>
            {Array.from({ length: goal }, (_, i) => {
              const filled = i < progress;
              return (
                <div
                  key={i}
                  aria-hidden="true"
                  className={`flex aspect-square items-center justify-center rounded-full border text-sm font-bold ${
                    filled
                      ? 'border-copper-400 bg-copper-500/20 text-copper-300'
                      : 'border-dashed border-ink-700 text-ink-600'
                  }`}
                >
                  {filled ? '✓' : i + 1}
                </div>
              );
            })}
          </div>

          <div className="mt-7 text-center">
            {complete ? (
              <>
                <p className="text-lg font-bold text-copper-300">
                  Tarjeta completa
                </p>
                <p className="mt-1 text-sm text-ink-300">
                  Tu proxima visita lleva {settings.loyalty_reward.toLowerCase()}. Muestra
                  esta pantalla al llegar.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold">
                  {progress} de {goal} sellos
                </p>
                <p className="mt-1 text-sm text-ink-300">
                  Te faltan {goal - progress} para tu{' '}
                  {settings.loyalty_reward.toLowerCase()}.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-ink-800 px-6 py-4 text-sm text-ink-400">
          <div className="flex justify-between gap-4">
            <span>Visitas</span>
            <span className="text-ink-300">{customer.visits}</span>
          </div>
          {customer.rewards_redeemed > 0 ? (
            <div className="mt-1.5 flex justify-between gap-4">
              <span>Premios canjeados</span>
              <span className="text-ink-300">{customer.rewards_redeemed}</span>
            </div>
          ) : null}
          {customer.last_visit_at ? (
            <div className="mt-1.5 flex justify-between gap-4">
              <span>Ultima visita</span>
              <span className="text-ink-300">
                {formatLongDate(customer.last_visit_at, settings.timezone)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <ButtonLink href="/reservar" className="w-full">
          Agendar otra visita
        </ButtonLink>
        <PushToggle role="customer" loyaltyCode={customer.loyalty_code} />
      </div>
    </main>
  );
}
