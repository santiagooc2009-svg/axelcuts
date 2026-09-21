import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/data';
import { uniqueCode } from '@/lib/codes';
import { normalizePhone } from '@/lib/phone';
import { getDayAvailability } from '@/lib/availability';
import { dateISO, formatDateTime } from '@/lib/time';
import { dropPendingMessages, queueMessage } from '@/lib/messaging/outbox';
import { notifyAdmins } from '@/lib/push';
import { loyaltyUrl } from '@/lib/loyalty';
import type {
  Appointment,
  AppointmentDetail,
  Customer,
  Service,
  Settings,
} from '@/types/db';

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'taken' | 'closed' | 'not_found' | 'too_late',
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export function appointmentUrl(code: string): string {
  return `${env.siteUrl}/cita/${code}`;
}

/** Encuentra al cliente por telefono o lo da de alta con su tarjeta. */
export async function findOrCreateCustomer(
  rawPhone: string,
  name: string,
): Promise<Customer> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new BookingError('El telefono no parece valido.', 'invalid');

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    const current = existing as Customer;
    // Si escribio su nombre distinto esta vez, nos quedamos con el nuevo.
    if (name && name !== current.name) {
      const { data: renamed } = await db
        .from('customers')
        .update({ name })
        .eq('id', current.id)
        .select()
        .single();
      return (renamed ?? current) as Customer;
    }
    return current;
  }

  const code = await uniqueCode(async (candidate) => {
    const { data } = await db
      .from('customers')
      .select('id')
      .eq('loyalty_code', candidate)
      .maybeSingle();
    return Boolean(data);
  });

  const { data, error } = await db
    .from('customers')
    .insert({ phone, name, loyalty_code: code })
    .select()
    .single();

  if (error || !data) {
    throw new BookingError(`No se pudo registrar al cliente: ${error?.message}`, 'invalid');
  }
  return data as Customer;
}

export type CreateBookingInput = {
  serviceId: string;
  staffId?: string | null;
  /** Instante UTC en ISO, tal como lo devolvio /api/availability. */
  startsAt: string;
  name: string;
  phone: string;
  notes?: string;
  source?: string;
};

/**
 * Crea la cita. Dos defensas contra el doble booking:
 *
 *  1. Se vuelve a calcular la disponibilidad en el servidor. El cliente pudo
 *     tener la pantalla abierta media hora.
 *  2. La restriccion de exclusion en Postgres. Si dos personas confirman el
 *     mismo hueco en el mismo segundo, la base deja pasar una sola.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<{ appointment: Appointment; customer: Customer; service: Service; settings: Settings }> {
  const db = supabaseAdmin();
  const settings = await getSettings();

  const { data: serviceRow } = await db
    .from('services')
    .select('*')
    .eq('id', input.serviceId)
    .eq('active', true)
    .maybeSingle();

  if (!serviceRow) throw new BookingError('Ese servicio ya no esta disponible.', 'not_found');
  const service = serviceRow as Service;

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new BookingError('La hora seleccionada no es valida.', 'invalid');
  }

  const day = dateISO(startsAt, settings.timezone);
  const availability = await getDayAvailability(day, service, input.staffId ?? null);
  const slot = availability.slots.find((s) => s.startsAt === startsAt.toISOString());

  if (!slot) {
    throw new BookingError(
      'Ese horario ya no esta libre. Elige otro, por favor.',
      'taken',
    );
  }

  // Si el cliente no eligio barbero, tomamos el primero libre a esa hora.
  const staffId = input.staffId ?? slot.staffIds[0] ?? null;
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

  const customer = await findOrCreateCustomer(input.phone, input.name.trim());

  const code = await uniqueCode(async (candidate) => {
    const { data } = await db
      .from('appointments')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    return Boolean(data);
  });

  const { data, error } = await db
    .from('appointments')
    .insert({
      code,
      customer_id: customer.id,
      service_id: service.id,
      staff_id: staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: settings.auto_confirm ? 'confirmed' : 'pending',
      price_cents: service.price_cents,
      notes: input.notes?.trim() || null,
      source: input.source ?? 'web',
    })
    .select()
    .single();

  if (error) {
    // 23P01 = exclusion_violation: alguien gano la carrera por el hueco.
    if (error.code === '23P01') {
      throw new BookingError(
        'Alguien acaba de apartar ese horario. Elige otro, por favor.',
        'taken',
      );
    }
    throw new BookingError(`No se pudo crear la cita: ${error.message}`, 'invalid');
  }

  const appointment = data as Appointment;

  await scheduleAppointmentMessages(appointment, customer, service, settings);

  await notifyAdmins({
    title: 'Nueva cita',
    body: `${customer.name} — ${service.name}, ${formatDateTime(appointment.starts_at, settings.timezone)}`,
    url: '/admin',
    tag: `appt-${appointment.id}`,
  });

  return { appointment, customer, service, settings };
}

/** Confirmacion inmediata + recordatorios programados. */
async function scheduleAppointmentMessages(
  appointment: Appointment,
  customer: Customer,
  service: Service,
  settings: Settings,
): Promise<void> {
  if (!customer.whatsapp_opt_in) return;

  const staffName = await staffNameOf(appointment.staff_id);
  const base = {
    settings,
    customerName: customer.name,
    serviceName: service.name,
    staffName,
    startsAt: appointment.starts_at,
    appointmentUrl: appointmentUrl(appointment.code),
    loyaltyUrl: loyaltyUrl(customer.loyalty_code),
  };

  await queueMessage({
    kind: 'booking_confirmed',
    toPhone: customer.phone,
    customerId: customer.id,
    appointmentId: appointment.id,
    context: base,
  });

  const start = new Date(appointment.starts_at).getTime();
  for (const hours of settings.reminder_hours) {
    const when = new Date(start - hours * 60 * 60 * 1000);
    // Si la cita es para dentro de una hora, el recordatorio de 24 h no tiene
    // sentido: ya paso su momento.
    if (when.getTime() <= Date.now()) continue;

    await queueMessage({
      kind: hours >= 12 ? 'reminder_24h' : 'reminder_2h',
      toPhone: customer.phone,
      customerId: customer.id,
      appointmentId: appointment.id,
      scheduledFor: when,
      context: base,
    });
  }
}

async function staffNameOf(staffId: string | null): Promise<string | null> {
  if (!staffId) return null;
  const { data } = await supabaseAdmin()
    .from('staff')
    .select('name')
    .eq('id', staffId)
    .maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

export async function getAppointmentByCode(code: string): Promise<AppointmentDetail | null> {
  const { data } = await supabaseAdmin()
    .from('appointments')
    .select(
      `*,
       service:services (id, name, duration_min, price_cents),
       staff:staff (id, name),
       customer:customers (id, name, phone, loyalty_code, stamps)`,
    )
    .eq('code', code.toUpperCase())
    .maybeSingle();

  return (data as AppointmentDetail | null) ?? null;
}

/**
 * Cancelacion. El cliente solo puede cancelar hasta N horas antes
 * (`cancel_window_hours`); el panel puede siempre.
 */
export async function cancelAppointment(
  code: string,
  by: 'customer' | 'shop',
): Promise<AppointmentDetail> {
  const settings = await getSettings();
  const appointment = await getAppointmentByCode(code);

  if (!appointment) throw new BookingError('No encontramos esa cita.', 'not_found');
  if (appointment.status === 'cancelled') return appointment;
  if (appointment.status === 'completed') {
    throw new BookingError('Esa cita ya se atendio.', 'invalid');
  }

  if (by === 'customer') {
    const hoursLeft =
      (new Date(appointment.starts_at).getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < settings.cancel_window_hours) {
      throw new BookingError(
        `Para cancelar con menos de ${settings.cancel_window_hours} horas de anticipacion, ` +
          'hablanos directo por WhatsApp.',
        'too_late',
      );
    }
  }

  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: by,
    })
    .eq('id', appointment.id)
    .select()
    .single();

  if (error) throw new BookingError(`No se pudo cancelar: ${error.message}`, 'invalid');

  // Los recordatorios de una cita muerta no deben salir.
  await dropPendingMessages(appointment.id);

  if (appointment.customer) {
    await queueMessage({
      kind: by === 'shop' ? 'cancelled_by_shop' : 'cancelled_by_customer',
      toPhone: appointment.customer.phone,
      customerId: appointment.customer.id,
      context: {
        settings,
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name,
        startsAt: appointment.starts_at,
      },
    });
  }

  if (by === 'customer') {
    await notifyAdmins({
      title: 'Cita cancelada',
      body: `${appointment.customer?.name ?? 'Un cliente'} cancelo su cita del ${formatDateTime(
        appointment.starts_at,
        settings.timezone,
      )}.`,
      url: '/admin',
      tag: `cancel-${appointment.id}`,
    });
  }

  return { ...appointment, ...(data as Appointment) };
}

/** Citas de un dia para el panel, ya con servicio/barbero/cliente. */
export async function getAppointmentsForRange(
  fromISO: string,
  toISO: string,
): Promise<AppointmentDetail[]> {
  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .select(
      `*,
       service:services (id, name, duration_min, price_cents),
       staff:staff (id, name),
       customer:customers (id, name, phone, loyalty_code, stamps)`,
    )
    .gte('starts_at', fromISO)
    .lt('starts_at', toISO)
    .order('starts_at');

  if (error) throw new Error(`No se pudo leer la agenda: ${error.message}`);
  return (data ?? []) as AppointmentDetail[];
}

/**
 * Marca la cita como atendida y sella la tarjeta del cliente. Es el gesto
 * que hace el recepcionista cuando la persona ya se fue: una sola accion
 * cierra la cita, suma la visita y dispara el WhatsApp de fidelidad.
 */
export async function completeAppointment(code: string): Promise<AppointmentDetail> {
  const { addStamp } = await import('@/lib/loyalty');
  const appointment = await getAppointmentByCode(code);

  if (!appointment) throw new BookingError('No encontramos esa cita.', 'not_found');
  if (appointment.status === 'cancelled') {
    throw new BookingError('Esa cita estaba cancelada.', 'invalid');
  }

  if (appointment.status !== 'completed') {
    const { error } = await supabaseAdmin()
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointment.id);

    if (error) throw new BookingError(`No se pudo cerrar la cita: ${error.message}`, 'invalid');
    await dropPendingMessages(appointment.id, 'cita ya atendida');
  }

  await addStamp(appointment.customer_id, appointment.id);

  return { ...appointment, status: 'completed' };
}

/** El cliente no llego. No sella tarjeta, pero deja el registro. */
export async function markNoShow(code: string): Promise<void> {
  const appointment = await getAppointmentByCode(code);
  if (!appointment) throw new BookingError('No encontramos esa cita.', 'not_found');

  await supabaseAdmin()
    .from('appointments')
    .update({ status: 'no_show' })
    .eq('id', appointment.id);

  await dropPendingMessages(appointment.id, 'el cliente no llego');
}

/**
 * Cita capturada desde el mostrador. A diferencia de la reserva publica, no
 * exige que el hueco este en la lista de disponibles: si el dueno decide
 * meter a alguien entre dos cortes, es su negocio. Lo unico que sigue
 * protegido es el encimado con otra cita del mismo barbero, que lo bloquea
 * la base de datos.
 */
export async function createWalkIn(input: {
  serviceId: string;
  staffId?: string | null;
  startsAt: string;
  name: string;
  phone: string;
  notes?: string;
}): Promise<Appointment> {
  const db = supabaseAdmin();
  const settings = await getSettings();

  const { data: serviceRow } = await db
    .from('services')
    .select('*')
    .eq('id', input.serviceId)
    .maybeSingle();

  if (!serviceRow) throw new BookingError('Ese servicio no existe.', 'not_found');
  const service = serviceRow as Service;

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new BookingError('La fecha y hora no son validas.', 'invalid');
  }

  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);
  const customer = await findOrCreateCustomer(input.phone, input.name.trim());

  const code = await uniqueCode(async (candidate) => {
    const { data } = await db
      .from('appointments')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    return Boolean(data);
  });

  const { data, error } = await db
    .from('appointments')
    .insert({
      code,
      customer_id: customer.id,
      service_id: service.id,
      staff_id: input.staffId ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'confirmed',
      price_cents: service.price_cents,
      notes: input.notes?.trim() || null,
      source: 'mostrador',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23P01') {
      throw new BookingError(
        'Ese barbero ya tiene una cita encimada a esa hora.',
        'taken',
      );
    }
    throw new BookingError(`No se pudo crear la cita: ${error.message}`, 'invalid');
  }

  const appointment = data as Appointment;
  await scheduleAppointmentMessages(appointment, customer, service, settings);

  return appointment;
}

/**
 * Mover una cita de hora. Se reusa la misma cita (mismo codigo y mismo link
 * que el cliente ya tiene) en vez de cancelar y crear otra, para que el
 * mensaje que recibio siga sirviendo.
 *
 * Los recordatorios viejos se descartan y se vuelven a programar sobre la
 * hora nueva; si no, llegaria un "tu cita es manana" con la hora vieja.
 */
export async function rescheduleAppointment(
  code: string,
  newStartsAt: string,
  newStaffId?: string | null,
): Promise<AppointmentDetail> {
  const db = supabaseAdmin();
  const settings = await getSettings();
  const appointment = await getAppointmentByCode(code);

  if (!appointment) throw new BookingError('No encontramos esa cita.', 'not_found');
  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    throw new BookingError('Esa cita ya esta cerrada. Crea una nueva.', 'invalid');
  }

  const startsAt = new Date(newStartsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new BookingError('La fecha y hora no son validas.', 'invalid');
  }

  const duration = appointment.service?.duration_min ?? 30;
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const staffId = newStaffId === undefined ? appointment.staff_id : newStaffId;

  const { error } = await db
    .from('appointments')
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      staff_id: staffId,
    })
    .eq('id', appointment.id);

  if (error) {
    if (error.code === '23P01') {
      throw new BookingError(
        'A esa hora ya hay otra cita encimada del mismo barbero.',
        'taken',
      );
    }
    throw new BookingError(`No se pudo mover la cita: ${error.message}`, 'invalid');
  }

  await dropPendingMessages(appointment.id, 'la cita se movio de hora');

  if (appointment.customer) {
    const { data: customerRow } = await db
      .from('customers')
      .select('*')
      .eq('id', appointment.customer_id)
      .single();

    const { data: serviceRow } = await db
      .from('services')
      .select('*')
      .eq('id', appointment.service_id)
      .single();

    if (customerRow && serviceRow) {
      await scheduleAppointmentMessages(
        {
          ...(appointment as Appointment),
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          staff_id: staffId,
        },
        customerRow as Customer,
        serviceRow as Service,
        settings,
      );
    }
  }

  return { ...appointment, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() };
}

/** Historial de visitas de una persona, lo mas reciente primero. */
export async function getCustomerHistory(
  customerId: string,
  limit = 30,
): Promise<AppointmentDetail[]> {
  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .select(
      `*,
       service:services (id, name, duration_min, price_cents),
       staff:staff (id, name),
       customer:customers (id, name, phone, loyalty_code, stamps)`,
    )
    .eq('customer_id', customerId)
    .order('starts_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`No se pudo leer el historial: ${error.message}`);
  return (data ?? []) as AppointmentDetail[];
}

/**
 * Aprobar una cita que entro como "por confirmar" (cuando el negocio tiene
 * apagado el confirmado automatico). Manda el WhatsApp de confirmacion que
 * no salio al reservar y programa los recordatorios.
 */
export async function confirmAppointment(code: string): Promise<AppointmentDetail> {
  const db = supabaseAdmin();
  const settings = await getSettings();
  const appointment = await getAppointmentByCode(code);

  if (!appointment) throw new BookingError('No encontramos esa cita.', 'not_found');
  if (appointment.status !== 'pending') {
    throw new BookingError('Esa cita ya no esta pendiente de confirmar.', 'invalid');
  }

  const { error } = await db
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', appointment.id);

  if (error) throw new BookingError(`No se pudo confirmar: ${error.message}`, 'invalid');

  const [{ data: customerRow }, { data: serviceRow }] = await Promise.all([
    db.from('customers').select('*').eq('id', appointment.customer_id).single(),
    db.from('services').select('*').eq('id', appointment.service_id).single(),
  ]);

  if (customerRow && serviceRow) {
    // Sin confirmado automatico, al reservar no salio ningun mensaje: este es
    // el momento en que el cliente se entera de que su lugar es suyo.
    await scheduleAppointmentMessages(
      { ...(appointment as Appointment), status: 'confirmed' },
      customerRow as Customer,
      serviceRow as Service,
      settings,
    );
  }

  return { ...appointment, status: 'confirmed' };
}
