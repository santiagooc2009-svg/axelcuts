'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { normalizePhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentAdmin } from '@/lib/supabase/server';
import { zonedToUtc } from '@/lib/time';
import { getSettings } from '@/lib/data';
import type { ActionResult } from '@/app/admin/actions';

/**
 * Acciones de configuracion del negocio: servicios, equipo, horario y
 * ajustes. Separadas de actions.ts (que es la operacion del dia a dia)
 * porque se tocan poco y cambian datos que afectan a toda la agenda.
 */

async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new Error('Tu sesion expiro. Vuelve a entrar.');
  return admin;
}

function fail(cause: unknown): ActionResult {
  if (cause instanceof z.ZodError) {
    return { ok: false, message: cause.issues[0]?.message ?? 'Datos invalidos.' };
  }
  if (cause instanceof Error) return { ok: false, message: cause.message };
  return { ok: false, message: 'Algo salio mal.' };
}

/** Los horarios y precios cambian lo que ve todo el mundo. */
function revalidateEverything() {
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del servicio.').max(60),
  description: z.string().trim().max(200).optional(),
  duration_min: z.coerce
    .number()
    .int()
    .min(5, 'La duracion minima es 5 minutos.')
    .max(480, 'La duracion maxima es 8 horas.'),
  price_pesos: z.coerce.number().min(0, 'El precio no puede ser negativo.').max(100000),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveServiceAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = String(formData.get('id') ?? '').trim();
    const parsed = serviceSchema.parse({
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      duration_min: formData.get('duration_min'),
      price_pesos: formData.get('price_pesos'),
      sort_order: formData.get('sort_order') || 0,
    });

    const row = {
      name: parsed.name,
      description: parsed.description ?? null,
      duration_min: parsed.duration_min,
      // En la UI se escriben pesos; en la base viven centavos para no
      // arrastrar errores de redondeo.
      price_cents: Math.round(parsed.price_pesos * 100),
      sort_order: parsed.sort_order,
    };

    const db = supabaseAdmin();
    const { error } = id
      ? await db.from('services').update(row).eq('id', id)
      : await db.from('services').insert(row);

    if (error) throw new Error(`No se pudo guardar el servicio: ${error.message}`);

    revalidateEverything();
    return { ok: true, message: id ? 'Servicio actualizado.' : `"${parsed.name}" agregado.` };
  } catch (cause) {
    return fail(cause);
  }
}

export async function toggleServiceAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin()
      .from('services')
      .update({ active })
      .eq('id', id);

    if (error) throw new Error(error.message);

    revalidateEverything();
    return {
      ok: true,
      message: active
        ? 'Servicio visible otra vez.'
        : 'Servicio oculto. Las citas que ya existen no se tocan.',
    };
  } catch (cause) {
    return fail(cause);
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin().from('services').delete().eq('id', id);

    if (error) {
      // 23503 = la llave foranea lo impide: hay citas apuntando al servicio.
      // Borrarlo dejaria el historial sin nombre, asi que se ofrece ocultarlo.
      if (error.code === '23503') {
        return {
          ok: false,
          message:
            'Este servicio ya tiene citas en el historial, por eso no se puede borrar. ' +
            'Ocultalo y deja de ofrecerse sin perder el registro.',
        };
      }
      throw new Error(error.message);
    }

    revalidateEverything();
    return { ok: true, message: 'Servicio eliminado.' };
  } catch (cause) {
    return fail(cause);
  }
}

// ---------------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------------

const staffSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre.').max(60),
  bio: z.string().trim().max(200).optional(),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveStaffAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = String(formData.get('id') ?? '').trim();
    const parsed = staffSchema.parse({
      name: formData.get('name'),
      bio: formData.get('bio') || undefined,
      sort_order: formData.get('sort_order') || 0,
    });

    const row = {
      name: parsed.name,
      bio: parsed.bio ?? null,
      sort_order: parsed.sort_order,
    };

    const db = supabaseAdmin();
    const { error } = id
      ? await db.from('staff').update(row).eq('id', id)
      : await db.from('staff').insert(row);

    if (error) throw new Error(`No se pudo guardar: ${error.message}`);

    revalidateEverything();
    return { ok: true, message: id ? 'Datos actualizados.' : `${parsed.name} agregado al equipo.` };
  } catch (cause) {
    return fail(cause);
  }
}

export async function toggleStaffAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin().from('staff').update({ active }).eq('id', id);
    if (error) throw new Error(error.message);

    revalidateEverything();
    return {
      ok: true,
      message: active
        ? 'Vuelve a aparecer en la agenda.'
        : 'Ya no se le pueden agendar citas nuevas.',
    };
  } catch (cause) {
    return fail(cause);
  }
}

/**
 * Que servicios da cada quien. Sin ninguna fila para un servicio, lo dan
 * todos: es lo comun en una peluqueria chica y evita obligar a configurar
 * una matriz completa antes de poder trabajar.
 */
export async function setStaffServicesAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const staffId = String(formData.get('staffId') ?? '').trim();
    if (!staffId) return { ok: false, message: 'Falta el barbero.' };

    const serviceIds = formData.getAll('serviceIds').map(String).filter(Boolean);
    const db = supabaseAdmin();

    await db.from('staff_services').delete().eq('staff_id', staffId);

    if (serviceIds.length > 0) {
      const { error } = await db
        .from('staff_services')
        .insert(serviceIds.map((service_id) => ({ staff_id: staffId, service_id })));

      if (error) throw new Error(error.message);
    }

    revalidateEverything();
    return {
      ok: true,
      message:
        serviceIds.length === 0
          ? 'Sin restriccion: puede dar cualquier servicio.'
          : `Asignados ${serviceIds.length} servicios.`,
    };
  } catch (cause) {
    return fail(cause);
  }
}

// ---------------------------------------------------------------------------
// Horario
// ---------------------------------------------------------------------------

const hourSchema = z
  .object({
    staffId: z.string().uuid().nullable(),
    weekday: z.coerce.number().int().min(0).max(6),
    open_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de apertura invalida.'),
    close_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de cierre invalida.'),
  })
  .refine((v) => v.close_time > v.open_time, {
    message: 'La hora de cierre tiene que ser despues de la de apertura.',
  });

export async function addHoursAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = hourSchema.parse({
      staffId: (formData.get('staffId') as string) || null,
      weekday: formData.get('weekday'),
      open_time: formData.get('open_time'),
      close_time: formData.get('close_time'),
    });

    const { error } = await supabaseAdmin().from('business_hours').insert({
      staff_id: parsed.staffId,
      weekday: parsed.weekday,
      open_time: parsed.open_time,
      close_time: parsed.close_time,
    });

    if (error) throw new Error(`No se pudo guardar el horario: ${error.message}`);

    revalidateEverything();
    return { ok: true, message: 'Horario agregado.' };
  } catch (cause) {
    return fail(cause);
  }
}

export async function deleteHoursAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin().from('business_hours').delete().eq('id', id);
    if (error) throw new Error(error.message);

    revalidateEverything();
    return { ok: true, message: 'Horario eliminado.' };
  } catch (cause) {
    return fail(cause);
  }
}

// ---------------------------------------------------------------------------
// Bloqueos (vacaciones, festivos, huecos personales)
// ---------------------------------------------------------------------------

export async function addTimeOffAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const settings = await getSettings();

    const staffId = (formData.get('staffId') as string) || null;
    const fromDate = String(formData.get('from_date') ?? '');
    const toDate = String(formData.get('to_date') ?? '');
    const allDay = formData.get('all_day') === 'on';
    const fromTime = allDay ? '00:00' : String(formData.get('from_time') ?? '');
    const toTime = allDay ? '00:00' : String(formData.get('to_time') ?? '');
    const reason = String(formData.get('reason') ?? '').trim();

    if (!fromDate || !toDate) return { ok: false, message: 'Falta la fecha.' };
    if (!allDay && (!fromTime || !toTime)) {
      return { ok: false, message: 'Falta la hora. O marca "todo el dia".' };
    }

    const starts = zonedToUtc(fromDate, fromTime, settings.timezone);
    // "Todo el dia" cierra hasta la medianoche del dia siguiente al ultimo.
    const ends = allDay
      ? zonedToUtc(addOneDay(toDate), '00:00', settings.timezone)
      : zonedToUtc(toDate, toTime, settings.timezone);

    if (ends <= starts) {
      return { ok: false, message: 'El final del bloqueo tiene que ser despues del inicio.' };
    }

    const { error } = await supabaseAdmin().from('time_off').insert({
      staff_id: staffId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      reason: reason || null,
    });

    if (error) throw new Error(`No se pudo guardar el bloqueo: ${error.message}`);

    revalidateEverything();
    return {
      ok: true,
      message: 'Bloqueo guardado. Esas horas dejan de ofrecerse.',
    };
  } catch (cause) {
    return fail(cause);
  }
}

export async function deleteTimeOffAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin().from('time_off').delete().eq('id', id);
    if (error) throw new Error(error.message);

    revalidateEverything();
    return { ok: true, message: 'Bloqueo eliminado.' };
  } catch (cause) {
    return fail(cause);
  }
}

function addOneDay(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Ajustes del negocio
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  business_name: z.string().trim().min(2, 'Escribe el nombre del negocio.').max(60),
  timezone: z.string().trim().min(3).max(60),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(200).optional(),
  slot_minutes: z.coerce.number().int().min(5).max(60),
  min_lead_minutes: z.coerce.number().int().min(0).max(10080),
  max_horizon_days: z.coerce.number().int().min(1).max(365),
  cancel_window_hours: z.coerce.number().int().min(0).max(168),
  auto_confirm: z.boolean(),
  loyalty_goal: z.coerce
    .number()
    .int()
    .min(1, 'La tarjeta necesita al menos un sello.')
    .max(30),
  loyalty_reward: z.string().trim().min(2, 'Escribe cual es el premio.').max(60),
  reminder_hours: z.array(z.number().int().min(1).max(168)),
});

export async function saveSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    // "24, 2" o "24 2" → [24, 2], ordenado de mayor a menor y sin repetidos.
    const reminders = [
      ...new Set(
        String(formData.get('reminder_hours') ?? '')
          .split(/[^\d]+/)
          .filter(Boolean)
          .map(Number)
          .filter((n) => n >= 1 && n <= 168),
      ),
    ].sort((a, b) => b - a);

    const parsed = settingsSchema.parse({
      business_name: formData.get('business_name'),
      timezone: formData.get('timezone'),
      phone: formData.get('phone') || undefined,
      address: formData.get('address') || undefined,
      slot_minutes: formData.get('slot_minutes'),
      min_lead_minutes: formData.get('min_lead_minutes'),
      max_horizon_days: formData.get('max_horizon_days'),
      cancel_window_hours: formData.get('cancel_window_hours'),
      auto_confirm: formData.get('auto_confirm') === 'on',
      loyalty_goal: formData.get('loyalty_goal'),
      loyalty_reward: formData.get('loyalty_reward'),
      reminder_hours: reminders,
    });

    // Una zona horaria mal escrita rompe TODA la agenda, asi que se valida
    // contra el propio motor de fechas antes de guardarla.
    try {
      new Intl.DateTimeFormat('es-MX', { timeZone: parsed.timezone }).format(new Date());
    } catch {
      return {
        ok: false,
        message: `"${parsed.timezone}" no es una zona horaria valida. Ej. America/Mexico_City.`,
      };
    }

    const phone = parsed.phone ? normalizePhone(parsed.phone) : null;
    if (parsed.phone && !phone) {
      return { ok: false, message: 'El telefono del negocio no parece valido.' };
    }

    const { error } = await supabaseAdmin()
      .from('settings')
      .update({
        business_name: parsed.business_name,
        timezone: parsed.timezone,
        phone,
        address: parsed.address ?? null,
        slot_minutes: parsed.slot_minutes,
        min_lead_minutes: parsed.min_lead_minutes,
        max_horizon_days: parsed.max_horizon_days,
        cancel_window_hours: parsed.cancel_window_hours,
        auto_confirm: parsed.auto_confirm,
        loyalty_goal: parsed.loyalty_goal,
        loyalty_reward: parsed.loyalty_reward,
        reminder_hours: parsed.reminder_hours.length > 0 ? parsed.reminder_hours : [24, 2],
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) throw new Error(`No se pudieron guardar los ajustes: ${error.message}`);

    revalidateEverything();
    return { ok: true, message: 'Ajustes guardados.' };
  } catch (cause) {
    return fail(cause);
  }
}
