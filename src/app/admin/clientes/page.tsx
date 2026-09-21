import Link from 'next/link';

import ActionButton from '@/components/ActionButton';
import { ButtonLink, inputClass } from '@/components/ui';
import { redeemAction, stampAction } from '@/app/admin/actions';
import { getSettings } from '@/lib/data';
import { formatPhone, toWhatsappNumber } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatLongDate } from '@/lib/time';
import type { Customer } from '@/types/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Clientes' };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const settings = await getSettings();
  const search = (q ?? '').trim();

  let query = supabaseAdmin()
    .from('customers')
    .select('*')
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (search) {
    // Busca por nombre o por telefono. El `%` va escapado por PostgREST.
    const digits = search.replace(/\D/g, '');
    query = query.or(
      digits.length >= 4
        ? `name.ilike.%${search}%,phone.ilike.%${digits}%`
        : `name.ilike.%${search}%`,
    );
  }

  const { data } = await query;
  const customers = (data ?? []) as Customer[];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="mt-1 text-sm text-ink-400">
            {customers.length} {customers.length === 1 ? 'persona' : 'personas'}
            {search ? ` que coinciden con "${search}"` : ''}
          </p>
        </div>

        <ButtonLink href="/admin/clientes/nuevo">Nueva tarjeta</ButtonLink>
      </div>

      <form className="mt-5" action="/admin/clientes">
        <input
          name="q"
          defaultValue={search}
          className={inputClass}
          placeholder="Buscar por nombre o telefono"
          type="search"
        />
      </form>

      <section className="mt-6 space-y-3">
        {customers.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-semibold">
              {search ? 'Nadie con ese nombre o telefono' : 'Todavia no hay clientes'}
            </p>
            <p className="mt-1 text-sm text-ink-400">
              Cada persona que reserva se da de alta sola. Tambien puedes crear su
              tarjeta a mano.
            </p>
          </div>
        ) : null}

        {customers.map((customer) => {
          const complete = customer.stamps >= settings.loyalty_goal;

          return (
            <article key={customer.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <a
                    href={`https://wa.me/${toWhatsappNumber(customer.phone)}`}
                    className="text-sm text-copper-300 hover:text-copper-400"
                  >
                    {formatPhone(customer.phone)}
                  </a>
                  <p className="mt-1 text-sm text-ink-400">
                    {customer.visits} {customer.visits === 1 ? 'visita' : 'visitas'}
                    {customer.last_visit_at
                      ? ` · ultima el ${formatLongDate(customer.last_visit_at, settings.timezone)}`
                      : ''}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className={`font-semibold ${complete ? 'text-copper-300' : 'text-ink-100'}`}
                  >
                    {Math.min(customer.stamps, settings.loyalty_goal)}/{settings.loyalty_goal}
                  </p>
                  <Link
                    href={`/tarjeta/${customer.loyalty_code}`}
                    className="font-mono text-xs text-ink-400 hover:text-ink-100"
                  >
                    {customer.loyalty_code}
                  </Link>
                </div>
              </div>

              {complete ? (
                <p className="mt-3 rounded-lg bg-copper-500/10 px-3 py-2 text-sm text-copper-300">
                  Tarjeta completa: le toca {settings.loyalty_reward.toLowerCase()}.
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-ink-800 pt-4">
                <ActionButton
                  label="Poner sello"
                  action={stampAction.bind(null, customer.id)}
                />
                {complete ? (
                  <ActionButton
                    variant="primary"
                    label={`Canjear ${settings.loyalty_reward.toLowerCase()}`}
                    action={redeemAction.bind(null, customer.id)}
                    confirm="¿Canjear el premio?"
                  />
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
