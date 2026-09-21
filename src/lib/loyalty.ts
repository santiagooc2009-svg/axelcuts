import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/data';
import { queueMessage } from '@/lib/messaging/outbox';
import { notifyCustomer } from '@/lib/push';
import { env } from '@/lib/env';
import type { Customer } from '@/types/db';

export type LoyaltyState = {
  customer: Customer;
  goal: number;
  reward: string;
  /** Sellos dentro de la tarjeta en curso (0..goal). */
  progress: number;
  rewardReady: boolean;
};

export function loyaltyUrl(code: string): string {
  return `${env.siteUrl}/tarjeta/${code}`;
}

export async function getLoyaltyState(customer: Customer): Promise<LoyaltyState> {
  const settings = await getSettings();
  return {
    customer,
    goal: settings.loyalty_goal,
    reward: settings.loyalty_reward,
    progress: Math.min(customer.stamps, settings.loyalty_goal),
    rewardReady: customer.stamps >= settings.loyalty_goal,
  };
}

/**
 * Suma un sello. Se llama cuando una cita pasa a 'completed', no cuando se
 * reserva: se premia la visita real, no la intencion.
 *
 * El indice unico sobre (appointment_id) para eventos de tipo 'stamp' hace
 * que marcar dos veces la misma cita no regale dos sellos.
 */
export async function addStamp(
  customerId: string,
  appointmentId: string | null,
  note?: string,
): Promise<LoyaltyState | null> {
  const db = supabaseAdmin();
  const settings = await getSettings();

  const { data: customer, error } = await db
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error || !customer) return null;

  const current = customer as Customer;
  const balance = current.stamps + 1;

  const { error: eventError } = await db.from('loyalty_events').insert({
    customer_id: customerId,
    appointment_id: appointmentId,
    type: 'stamp',
    delta: 1,
    balance_after: balance,
    note: note ?? null,
  });

  // Duplicado: esta cita ya habia sellado. Devolvemos el estado tal cual.
  if (eventError?.code === '23505') return getLoyaltyState(current);
  if (eventError) throw new Error(`No se pudo registrar el sello: ${eventError.message}`);

  const { data: updated } = await db
    .from('customers')
    .update({
      stamps: balance,
      visits: current.visits + 1,
      last_visit_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single();

  const next = (updated ?? { ...current, stamps: balance }) as Customer;
  const justCompleted = balance >= settings.loyalty_goal && current.stamps < settings.loyalty_goal;

  if (next.whatsapp_opt_in) {
    await queueMessage({
      kind: justCompleted ? 'loyalty_reward_ready' : 'loyalty_stamp',
      toPhone: next.phone,
      customerId: next.id,
      context: {
        settings,
        customerName: next.name,
        stamps: balance,
        goal: settings.loyalty_goal,
        reward: settings.loyalty_reward,
        loyaltyUrl: loyaltyUrl(next.loyalty_code),
      },
    });
  }

  if (justCompleted) {
    await notifyCustomer(next.id, {
      title: `Completaste tu tarjeta de ${settings.business_name}`,
      body: `Tu proxima visita lleva ${settings.loyalty_reward}.`,
      url: `/tarjeta/${next.loyalty_code}`,
      tag: `loyalty-${next.id}`,
    });
  }

  return getLoyaltyState(next);
}

/** Canjea el premio: descuenta la tarjeta completa y deja el excedente. */
export async function redeemReward(customerId: string): Promise<LoyaltyState | null> {
  const db = supabaseAdmin();
  const settings = await getSettings();

  const { data: customer } = await db
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (!customer) return null;
  const current = customer as Customer;

  if (current.stamps < settings.loyalty_goal) {
    throw new Error(
      `La tarjeta todavia no esta completa (${current.stamps}/${settings.loyalty_goal}).`,
    );
  }

  const balance = current.stamps - settings.loyalty_goal;

  await db.from('loyalty_events').insert({
    customer_id: customerId,
    type: 'redeem',
    delta: -settings.loyalty_goal,
    balance_after: balance,
    note: settings.loyalty_reward,
  });

  const { data: updated } = await db
    .from('customers')
    .update({ stamps: balance, rewards_redeemed: current.rewards_redeemed + 1 })
    .eq('id', customerId)
    .select()
    .single();

  return getLoyaltyState((updated ?? { ...current, stamps: balance }) as Customer);
}

/** Correccion manual desde el panel (se equivoco, vino sin cita, etc.). */
export async function adjustStamps(
  customerId: string,
  delta: number,
  note?: string,
): Promise<LoyaltyState | null> {
  const db = supabaseAdmin();

  const { data: customer } = await db
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (!customer) return null;
  const current = customer as Customer;
  const balance = Math.max(current.stamps + delta, 0);

  await db.from('loyalty_events').insert({
    customer_id: customerId,
    type: 'adjust',
    delta,
    balance_after: balance,
    note: note ?? null,
  });

  const { data: updated } = await db
    .from('customers')
    .update({ stamps: balance })
    .eq('id', customerId)
    .select()
    .single();

  return getLoyaltyState((updated ?? { ...current, stamps: balance }) as Customer);
}
