import 'server-only';

import webpush from 'web-push';

import { env, pushEnabled } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { PushSubscriptionRow } from '@/types/db';

let configured = false;

function configure(): boolean {
  if (!pushEnabled()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      env.vapidSubject,
      env.vapidPublicKey as string,
      env.vapidPrivateKey as string,
    );
    configured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Manda una notificacion a un grupo de suscripciones y limpia las muertas.
 * Un 404/410 del servicio de push significa que el navegador ya tiro la
 * suscripcion: borrarla evita acumular basura y reintentos inutiles.
 */
async function sendTo(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!configure() || subscriptions.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        sent += 1;
      } catch (cause) {
        const status = (cause as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.id);
      }
    }),
  );

  if (dead.length > 0) {
    await supabaseAdmin().from('push_subscriptions').delete().in('id', dead);
  }

  return { sent, removed: dead.length };
}

/** Avisa al telefono del barbero (todas las sesiones de admin). */
export async function notifyAdmins(payload: PushPayload) {
  const { data } = await supabaseAdmin()
    .from('push_subscriptions')
    .select('*')
    .eq('role', 'admin');

  return sendTo((data ?? []) as PushSubscriptionRow[], payload);
}

/** Avisa a un cliente concreto, si dejo activadas las notificaciones. */
export async function notifyCustomer(customerId: string, payload: PushPayload) {
  const { data } = await supabaseAdmin()
    .from('push_subscriptions')
    .select('*')
    .eq('role', 'customer')
    .eq('customer_id', customerId);

  return sendTo((data ?? []) as PushSubscriptionRow[], payload);
}

export { pushEnabled };
