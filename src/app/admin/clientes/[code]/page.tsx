import Link from 'next/link';
import { notFound } from 'next/navigation';

import ActionButton from '@/components/ActionButton';
import AdminForm from '@/components/AdminForm';
import Collapsible from '@/components/Collapsible';
import { Field, Money, StatusPill, inputClass } from '@/components/ui';
import { updateCustomerAction } from '@/app/admin/actions';
import { redeemAction, stampAction } from '@/app/admin/actions';
import { getCustomerHistory } from '@/lib/bookings';
import { getSettings } from '@/lib/data';
import { formatPhone, toWhatsappNumber } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatDateTime, formatLongDate } from '@/lib/time';
import type { Customer, LoyaltyEvent } from '@/types/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Cliente' };

export default async function ClientePage({
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

  const [history, eventsResult] = await Promise.all([
    getCustomerHistory(customer.id),
    supabaseAdmin()
      .from('loyalty_events')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const events = (eventsResult.data ?? []) as LoyaltyEvent[];
  const complete = customer.stamps >= settings.loyalty_goal;
  const spent = history
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + a.price_cents, 0);

  return (
    <>
      <Link href="/admin/clientes" className="text-sm text-ink-400 hover:text-ink-100">
        ← Clientes
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <a
            href={`https://wa.me/${toWhatsappNumber(customer.phone)}`}
            className="text-copper-300 hover:text-copper-400"
          >
            {formatPhone(customer.phone)}
          </a>
        </div>

        <div className="text-right">
          <p className={`text-2xl font-bold ${complete ? 'text-copper-300' : ''}`}>
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

      {customer.notes ? (
        <p className="mt-4 rounded-lg bg-ink-850 px-4 py-3 text-sm text-ink-300">
          {customer.notes}
        </p>
      ) : null}

      {!customer.whatsapp_opt_in ? (
        <p className="mt-4 rounded-lg border border-ink-700 px-4 py-3 text-sm text-ink-400">
          Esta persona tiene los avisos por WhatsApp apagados. No se le manda nada.
        </p>
      ) : null}

      {complete ? (
        <p className="mt-4 rounded-lg bg-copper-500/10 px-4 py-3 text-sm text-copper-300">
          Tarjeta completa: le toca {settings.loyalty_reward.toLowerCase()}.
        </p>
      ) : null}

      {/* ---- Resumen ---- */}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Visitas', value: String(customer.visits) },
          { label: 'Premios canjeados', value: String(customer.rewards_redeemed) },
          {
            label: 'Gastado',
            value: new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
              minimumFractionDigits: 0,
            }).format(spent / 100),
          },
          {
            label: 'Cliente desde',
            value: formatLongDate(customer.created_at, settings.timezone).split(' de ').slice(1).join(' de '),
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="text-xs text-ink-400">{stat.label}</dt>
            <dd className="mt-1 font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {/* ---- Acciones de fidelidad ---- */}
      <div className="mt-6 flex flex-wrap items-start gap-2">
        <ActionButton label="Poner sello" action={stampAction.bind(null, customer.id)} />
        {complete ? (
          <ActionButton
            variant="primary"
            label={`Canjear ${settings.loyalty_reward.toLowerCase()}`}
            action={redeemAction.bind(null, customer.id)}
            confirm="¿Canjear el premio?"
          />
        ) : null}
      </div>

      {/* ---- Editar ---- */}
      <section className="mt-8 border-t border-ink-800 pt-6">
        <Collapsible label="Editar datos">
          <div className="max-w-lg">
            <AdminForm
              action={updateCustomerAction.bind(null, customer.id)}
              submitLabel="Guardar cambios"
            >
              <Field label="Nombre">
                <input name="name" className={inputClass} required defaultValue={customer.name} />
              </Field>

              <Field label="WhatsApp">
                <input
                  name="phone"
                  className={inputClass}
                  type="tel"
                  required
                  defaultValue={formatPhone(customer.phone)}
                />
              </Field>

              <Field label="Notas" hint="Solo las ves tu. Ej. como le gusta el corte.">
                <input
                  name="notes"
                  className={inputClass}
                  maxLength={200}
                  defaultValue={customer.notes ?? ''}
                />
              </Field>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="whatsapp_opt_in"
                  defaultChecked={customer.whatsapp_opt_in}
                  className="mt-0.5 size-4 accent-copper-500"
                />
                <span>
                  Mandarle avisos por WhatsApp
                  <span className="block text-ink-400">
                    Apagalo si pidio que no le escriban.
                  </span>
                </span>
              </label>
            </AdminForm>
          </div>
        </Collapsible>
      </section>

      {/* ---- Historial de citas ---- */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Historial</h2>

        <div className="mt-4 space-y-2">
          {history.map((appointment) => (
            <article
              key={appointment.id}
              className="card flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-medium">
                  {appointment.service?.name ?? 'Servicio'}
                  {appointment.staff ? ` · ${appointment.staff.name}` : ''}
                </p>
                <p className="text-sm text-ink-400">
                  {formatDateTime(appointment.starts_at, settings.timezone)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-400">
                  <Money cents={appointment.price_cents} />
                </span>
                <StatusPill status={appointment.status} />
              </div>
            </article>
          ))}

          {history.length === 0 ? (
            <p className="card p-6 text-center text-sm text-ink-400">
              Todavia no tiene citas registradas.
            </p>
          ) : null}
        </div>
      </section>

      {/* ---- Movimientos de la tarjeta ---- */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Movimientos de la tarjeta</h2>

        <ul className="mt-4 space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 pb-2 text-sm"
            >
              <span>
                {event.type === 'stamp'
                  ? 'Sello'
                  : event.type === 'redeem'
                    ? `Canje: ${event.note ?? 'premio'}`
                    : `Ajuste${event.note ? `: ${event.note}` : ''}`}
              </span>
              <span className="text-ink-400">
                {event.delta > 0 ? `+${event.delta}` : event.delta} → {event.balance_after}
                {' · '}
                {formatDateTime(event.created_at, settings.timezone)}
              </span>
            </li>
          ))}

          {events.length === 0 ? (
            <li className="text-sm text-ink-400">Sin movimientos todavia.</li>
          ) : null}
        </ul>
      </section>
    </>
  );
}
