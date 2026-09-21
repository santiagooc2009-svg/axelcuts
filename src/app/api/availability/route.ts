import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDayAvailability } from '@/lib/availability';
import { getServices, getSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha invalida'),
  serviceId: z.string().uuid('Servicio invalido'),
  staffId: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    date: url.searchParams.get('date') ?? '',
    serviceId: url.searchParams.get('serviceId') ?? '',
    staffId: url.searchParams.get('staffId') || null,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Parametros invalidos' },
      { status: 400 },
    );
  }

  const services = await getServices();
  const service = services.find((s) => s.id === parsed.data.serviceId);
  if (!service) {
    return NextResponse.json({ error: 'Ese servicio no existe' }, { status: 404 });
  }

  const [availability, settings] = await Promise.all([
    getDayAvailability(parsed.data.date, service, parsed.data.staffId ?? null),
    getSettings(),
  ]);

  return NextResponse.json({
    ...availability,
    timezone: settings.timezone,
    durationMin: service.duration_min,
  });
}
