import Link from 'next/link';
import type { Metadata } from 'next';

import BookingFlow from '@/components/BookingFlow';
import { getServices, getSettings, getStaff } from '@/lib/data';
import { todayISO } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reservar',
  description: 'Aparta tu corte en menos de un minuto.',
};

export default async function ReservarPage() {
  const [settings, services, staff] = await Promise.all([
    getSettings(),
    getServices(),
    getStaff(),
  ]);

  if (services.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Agenda no disponible</h1>
        <p className="mt-3 text-ink-300">
          Todavia no hay servicios cargados. Vuelve en un rato.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-ink-400 hover:text-ink-100">
        ← {settings.business_name}
      </Link>

      <h1 className="mt-6 text-3xl font-bold">Reservar</h1>
      <p className="mt-2 text-ink-300">
        Te confirmamos por WhatsApp en cuanto termines.
      </p>

      <div className="mt-10">
        <BookingFlow
          services={services}
          staff={staff}
          todayISO={todayISO(settings.timezone)}
          horizonDays={settings.max_horizon_days}
        />
      </div>
    </main>
  );
}
