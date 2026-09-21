import { NextResponse } from 'next/server';
import { z } from 'zod';

import { BookingError, appointmentUrl, createBooking } from '@/lib/bookings';
import { normalizePhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  startsAt: z.string().min(10),
  name: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  phone: z.string().trim().min(8, 'Escribe tu telefono').max(20),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos invalidos' },
      { status: 400 },
    );
  }

  if (!normalizePhone(parsed.data.phone)) {
    return NextResponse.json(
      { error: 'El telefono no parece valido. Escribe los 10 digitos.' },
      { status: 400 },
    );
  }

  try {
    const { appointment } = await createBooking(parsed.data);
    return NextResponse.json(
      {
        code: appointment.code,
        startsAt: appointment.starts_at,
        url: appointmentUrl(appointment.code),
      },
      { status: 201 },
    );
  } catch (cause) {
    if (cause instanceof BookingError) {
      const status = cause.code === 'taken' ? 409 : cause.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ error: cause.message, code: cause.code }, { status });
    }
    console.error('[bookings] fallo inesperado', cause);
    return NextResponse.json(
      { error: 'No pudimos guardar tu cita. Intenta de nuevo.' },
      { status: 500 },
    );
  }
}
