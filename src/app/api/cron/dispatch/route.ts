import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { dispatchDue } from '@/lib/messaging/outbox';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyCustomer } from '@/lib/push';
import { getSettings } from '@/lib/data';
import { formatTime } from '@/lib/time';
import type { AppointmentDetail } from '@/types/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Motor de la automatizacion. Vercel Cron lo llama cada 15 minutos
 * (ver vercel.json). Hace dos cosas:
 *
 *  1. Saca de la bandeja los WhatsApp que ya tocaban.
 *  2. Manda el push de "tu cita es en 2 horas" a quien lo activo.
 *
 * Protegido con CRON_SECRET: sin el, cualquiera podria dispararlo en bucle.
 */
export async function GET(request: Request) {
  const secret = env.cronSecret;
  if (secret) {
    const header = request.headers.get('authorization');
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const report = await dispatchDue();
  const pushed = await pushUpcomingReminders();

  return NextResponse.json({ ok: true, whatsapp: report, push: pushed });
}

/** Push al cliente ~2 h antes, una sola vez por cita. */
async function pushUpcomingReminders(): Promise<number> {
  const settings = await getSettings();
  const now = Date.now();
  const from = new Date(now + 105 * 60_000).toISOString();
  const to = new Date(now + 135 * 60_000).toISOString();

  const { data } = await supabaseAdmin()
    .from('appointments')
    .select(
      `*,
       service:services (id, name, duration_min, price_cents),
       staff:staff (id, name),
       customer:customers (id, name, phone, loyalty_code, stamps)`,
    )
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', from)
    .lt('starts_at', to);

  let sent = 0;
  for (const appointment of (data ?? []) as AppointmentDetail[]) {
    if (!appointment.customer) continue;
    const result = await notifyCustomer(appointment.customer.id, {
      title: `Tu cita en ${settings.business_name} es hoy`,
      body: `${appointment.service?.name ?? 'Tu servicio'} a las ${formatTime(
        appointment.starts_at,
        settings.timezone,
      )}.`,
      url: `/cita/${appointment.code}`,
      tag: `reminder-${appointment.id}`,
    });
    sent += result.sent;
  }

  return sent;
}
