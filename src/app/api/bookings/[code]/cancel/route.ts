import { NextResponse } from 'next/server';

import { BookingError, cancelAppointment } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  try {
    const appointment = await cancelAppointment(code, 'customer');
    return NextResponse.json({ status: appointment.status });
  } catch (cause) {
    if (cause instanceof BookingError) {
      const status = cause.code === 'not_found' ? 404 : cause.code === 'too_late' ? 409 : 400;
      return NextResponse.json({ error: cause.message }, { status });
    }
    console.error('[cancel] fallo inesperado', cause);
    return NextResponse.json({ error: 'No pudimos cancelar la cita.' }, { status: 500 });
  }
}
