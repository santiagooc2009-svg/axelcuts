import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import CancelButton from '@/components/CancelButton';
import { Money, StatusPill } from '@/components/ui';
import { getAppointmentByCode } from '@/lib/bookings';
import { getSettings } from '@/lib/data';
import { formatLongDate, formatTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tu cita',
  robots: { index: false, follow: false },
};

export default async function CitaPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const { code } = await params;
  const { nueva } = await searchParams;

  const [appointment, settings] = await Promise.all([
    getAppointmentByCode(code),
    getSettings(),
  ]);

  if (!appointment) notFound();

  const tz = settings.timezone;
  const isLive = appointment.status === 'pending' || appointment.status === 'confirmed';
  const hoursLeft = (new Date(appointment.starts_at).getTime() - Date.now()) / 3_600_000;
  const canCancel = isLive && hoursLeft >= settings.cancel_window_hours;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Link href="/" className="text-sm text-ink-400 hover:text-ink-100">
        ← {settings.business_name}
      </Link>

      {nueva === '1' ? (
        <p className="mt-6 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-sm text-success-500">
          Listo, tu lugar quedo apartado. Te mandamos la confirmacion por WhatsApp.
        </p>
      ) : null}

      <div className="card mt-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-400">Tu cita</p>
            <h1 className="mt-1 text-2xl font-bold">{appointment.service?.name}</h1>
          </div>
          <StatusPill status={appointment.status} />
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Dia</dt>
            <dd className="text-right font-medium">
              {formatLongDate(appointment.starts_at, tz)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Hora</dt>
            <dd className="font-medium">
              {formatTime(appointment.starts_at, tz)} – {formatTime(appointment.ends_at, tz)}
            </dd>
          </div>
          {appointment.staff ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Con</dt>
              <dd className="font-medium">{appointment.staff.name}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Precio</dt>
            <dd className="font-medium">
              <Money cents={appointment.price_cents} />
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Codigo</dt>
            <dd className="font-mono font-medium">{appointment.code}</dd>
          </div>
        </dl>

        {settings.address ? (
          <p className="mt-6 border-t border-ink-800 pt-4 text-sm text-ink-300">
            {settings.address}
          </p>
        ) : null}
      </div>

      {isLive ? (
        <div className="mt-6 space-y-3">
          {canCancel ? (
            <CancelButton code={appointment.code} />
          ) : (
            <p className="text-sm text-ink-400">
              Faltan menos de {settings.cancel_window_hours} horas para tu cita. Si ya no
              puedes venir, escribenos por WhatsApp y lo resolvemos.
            </p>
          )}

          {settings.phone ? (
            <a
              href={`https://wa.me/${settings.phone.replace(/\D/g, '')}`}
              className="block text-sm text-copper-300 hover:text-copper-400"
            >
              Escribir a la barberia por WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      {appointment.customer ? (
        <p className="mt-8 text-sm text-ink-400">
          Tu tarjeta de fidelidad:{' '}
          <Link
            href={`/tarjeta/${appointment.customer.loyalty_code}`}
            className="text-copper-300 hover:text-copper-400"
          >
            ver sellos
          </Link>
        </p>
      ) : null}
    </main>
  );
}
