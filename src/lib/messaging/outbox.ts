import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { activeProvider } from '@/lib/messaging/providers';
import { renderMessage, type MessageKind, type TemplateContext } from '@/lib/messaging/templates';
import type { OutboxMessage } from '@/types/db';

export type QueueInput = {
  kind: MessageKind;
  toPhone: string;
  customerId?: string | null;
  appointmentId?: string | null;
  /** Cuando debe salir. Por omision, ya. */
  scheduledFor?: Date;
  context: TemplateContext;
};

/**
 * Deja un mensaje en la bandeja. No manda nada todavia: el envio lo hace
 * `dispatchDue()` desde el cron. Asi una reserva nunca se cae porque
 * WhatsApp tardo, y un recordatorio programado vive en la base y no en la
 * memoria del proceso.
 */
export async function queueMessage(input: QueueInput): Promise<OutboxMessage | null> {
  const body = renderMessage(input.kind, input.context);
  const scheduledFor = input.scheduledFor ?? new Date();

  const { data, error } = await supabaseAdmin()
    .from('message_outbox')
    .insert({
      kind: input.kind,
      to_phone: input.toPhone,
      customer_id: input.customerId ?? null,
      appointment_id: input.appointmentId ?? null,
      body,
      scheduled_for: scheduledFor.toISOString(),
      status: 'queued',
    })
    .select()
    .single();

  if (error) {
    // El indice unico (appointment_id, kind) rebota los duplicados: que el
    // cron corra dos veces no debe producir dos recordatorios.
    if (error.code === '23505') return null;
    throw new Error(`No se pudo encolar el mensaje: ${error.message}`);
  }

  return data as OutboxMessage;
}

/** Cancela avisos futuros de una cita (se cancelo o se movio). */
export async function dropPendingMessages(
  appointmentId: string,
  reason = 'cita cancelada',
): Promise<void> {
  await supabaseAdmin()
    .from('message_outbox')
    .update({ status: 'skipped', error: reason })
    .eq('appointment_id', appointmentId)
    .in('status', ['queued', 'ready']);
}

export type DispatchReport = {
  processed: number;
  sent: number;
  ready: number;
  failed: number;
};

/**
 * Procesa lo que ya toca mandar. Idempotente y acotado: toma como mucho
 * `limit` mensajes por corrida para no pasarse del tiempo de una funcion
 * serverless.
 */
export async function dispatchDue(limit = 25, now = new Date()): Promise<DispatchReport> {
  const provider = activeProvider();
  const db = supabaseAdmin();

  const { data, error } = await db
    .from('message_outbox')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for')
    .limit(limit);

  if (error) throw new Error(`No se pudo leer la bandeja: ${error.message}`);

  const pending = (data ?? []) as OutboxMessage[];
  const report: DispatchReport = { processed: 0, sent: 0, ready: 0, failed: 0 };

  for (const message of pending) {
    const result = await provider.send(message.to_phone, message.body);
    report.processed += 1;
    report[result.status === 'sent' ? 'sent' : result.status === 'ready' ? 'ready' : 'failed'] += 1;

    await db
      .from('message_outbox')
      .update({
        status: result.status,
        provider: result.provider,
        wa_link: result.waLink ?? message.wa_link,
        error: result.error ?? null,
        attempts: message.attempts + 1,
        sent_at: result.status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', message.id);
  }

  return report;
}

/** Mensajes que esperan un toque del dueno (modo wa.me). */
export async function pendingManualMessages(limit = 50): Promise<OutboxMessage[]> {
  const { data, error } = await supabaseAdmin()
    .from('message_outbox')
    .select('*')
    .in('status', ['ready', 'failed'])
    .order('scheduled_for', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`No se pudo leer la bandeja: ${error.message}`);
  return (data ?? []) as OutboxMessage[];
}

export async function markSent(id: string): Promise<void> {
  await supabaseAdmin()
    .from('message_outbox')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id);
}

export const messagingMode = () => ({
  provider: env.whatsappProvider,
  automatic: activeProvider().automatic,
});
