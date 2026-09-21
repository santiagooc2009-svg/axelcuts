'use server';

import { revalidatePath } from 'next/cache';

import {
  BookingError,
  cancelAppointment,
  completeAppointment,
  createWalkIn,
  findOrCreateCustomer,
  markNoShow,
} from '@/lib/bookings';
import { adjustStamps, loyaltyUrl, redeemReward } from '@/lib/loyalty';
import { markSent } from '@/lib/messaging/outbox';
import { currentAdmin } from '@/lib/supabase/server';

/**
 * Toda accion del panel pasa por aqui. Las Server Actions son endpoints
 * publicos disfrazados de funcion, asi que cada una revalida la sesion: el
 * middleware protege la navegacion, no la invocacion directa.
 */
async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new Error('Tu sesion expiro. Vuelve a entrar.');
  return admin;
}

export type ActionResult = {
  ok: boolean;
  message?: string;
  /** Link listo para compartir (tarjeta recien creada, por ejemplo). */
  link?: string;
  waLink?: string;
};

function fail(cause: unknown): ActionResult {
  if (cause instanceof BookingError || cause instanceof Error) {
    return { ok: false, message: cause.message };
  }
  return { ok: false, message: 'Algo salio mal.' };
}

export async function completeAction(code: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await completeAppointment(code);
    revalidatePath('/admin');
    revalidatePath('/admin/clientes');
    return { ok: true, message: 'Cita cerrada y sello agregado.' };
  } catch (cause) {
    return fail(cause);
  }
}

export async function cancelAction(code: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await cancelAppointment(code, 'shop');
    revalidatePath('/admin');
    return { ok: true, message: 'Cita cancelada. Se le avisa al cliente.' };
  } catch (cause) {
    return fail(cause);
  }
}

export async function noShowAction(code: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await markNoShow(code);
    revalidatePath('/admin');
    return { ok: true, message: 'Marcada como "no llego".' };
  } catch (cause) {
    return fail(cause);
  }
}

export async function walkInAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const date = String(formData.get('date') ?? '');
    const time = String(formData.get('time') ?? '');
    const { zonedToUtc } = await import('@/lib/time');
    const { getSettings } = await import('@/lib/data');
    const settings = await getSettings();

    if (!date || !time) return { ok: false, message: 'Falta la fecha o la hora.' };

    const appointment = await createWalkIn({
      serviceId: String(formData.get('serviceId') ?? ''),
      staffId: (formData.get('staffId') as string) || null,
      startsAt: zonedToUtc(date, time, settings.timezone).toISOString(),
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      notes: (formData.get('notes') as string) || undefined,
    });

    revalidatePath('/admin');
    return { ok: true, message: `Cita apartada (${appointment.code}).` };
  } catch (cause) {
    return fail(cause);
  }
}

/**
 * Alta de tarjeta digital sin cita de por medio: nombre y telefono, y sale
 * el link para mandarselo. Es el caso comun del mostrador — alguien que ya
 * esta parado ahi y quiere su tarjeta.
 */
export async function createCardAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const name = String(formData.get('name') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const initialStamps = Number(formData.get('stamps') ?? 0);

    if (name.length < 2) return { ok: false, message: 'Escribe el nombre del cliente.' };
    if (phone.length < 8) return { ok: false, message: 'Escribe el telefono.' };

    const customer = await findOrCreateCustomer(phone, name);

    if (Number.isFinite(initialStamps) && initialStamps > 0) {
      await adjustStamps(customer.id, initialStamps, 'sellos al dar de alta la tarjeta');
    }

    const link = loyaltyUrl(customer.loyalty_code);
    const { toWhatsappNumber } = await import('@/lib/phone');
    const { getSettings } = await import('@/lib/data');
    const settings = await getSettings();

    const text =
      `Hola ${name.split(' ')[0]}, esta es tu tarjeta de fidelidad de ` +
      `${settings.business_name}. Juntas ${settings.loyalty_goal} visitas y la ` +
      `siguiente lleva ${settings.loyalty_reward.toLowerCase()}.\n\n${link}`;

    revalidatePath('/admin/clientes');

    return {
      ok: true,
      message: `Tarjeta lista para ${name}.`,
      link,
      waLink: `https://wa.me/${toWhatsappNumber(customer.phone)}?text=${encodeURIComponent(text)}`,
    };
  } catch (cause) {
    return fail(cause);
  }
}

export async function stampAction(customerId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { addStamp } = await import('@/lib/loyalty');
    const state = await addStamp(customerId, null, 'sello manual desde el panel');
    revalidatePath('/admin/clientes');

    if (!state) return { ok: false, message: 'No encontramos a ese cliente.' };
    return {
      ok: true,
      message: state.rewardReady
        ? '¡Tarjeta completa! Ya puede canjear su premio.'
        : `Sello agregado (${state.progress}/${state.goal}).`,
    };
  } catch (cause) {
    return fail(cause);
  }
}

export async function redeemAction(customerId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await redeemReward(customerId);
    revalidatePath('/admin/clientes');
    return { ok: true, message: 'Premio canjeado. La tarjeta vuelve a empezar.' };
  } catch (cause) {
    return fail(cause);
  }
}

export async function markSentAction(messageId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await markSent(messageId);
    revalidatePath('/admin/mensajes');
    return { ok: true };
  } catch (cause) {
    return fail(cause);
  }
}
