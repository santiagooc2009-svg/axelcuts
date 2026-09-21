import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  BusinessHour,
  Service,
  Settings,
  Staff,
  TimeOff,
} from '@/types/db';

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    throw new Error(
      `No se pudieron leer los ajustes del negocio: ${error?.message ?? 'fila vacia'}. ` +
        '¿Ya corriste supabase/schema.sql?',
    );
  }
  return data as Settings;
}

export async function getServices(onlyActive = true): Promise<Service[]> {
  let query = supabaseAdmin().from('services').select('*').order('sort_order');
  if (onlyActive) query = query.eq('active', true);

  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron leer los servicios: ${error.message}`);
  return (data ?? []) as Service[];
}

export async function getStaff(onlyActive = true): Promise<Staff[]> {
  let query = supabaseAdmin().from('staff').select('*').order('sort_order');
  if (onlyActive) query = query.eq('active', true);

  const { data, error } = await query;
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);
  return (data ?? []) as Staff[];
}

export async function getBusinessHours(): Promise<BusinessHour[]> {
  const { data, error } = await supabaseAdmin()
    .from('business_hours')
    .select('*')
    .order('weekday')
    .order('open_time');

  if (error) throw new Error(`No se pudo leer el horario: ${error.message}`);
  return (data ?? []) as BusinessHour[];
}

export async function getTimeOffBetween(
  fromISO: string,
  toISO: string,
): Promise<TimeOff[]> {
  const { data, error } = await supabaseAdmin()
    .from('time_off')
    .select('*')
    .lt('starts_at', toISO)
    .gt('ends_at', fromISO);

  if (error) throw new Error(`No se pudieron leer los bloqueos: ${error.message}`);
  return (data ?? []) as TimeOff[];
}

/** Que barberos pueden dar cada servicio. Servicio sin filas = todos. */
export async function getStaffServiceMap(): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabaseAdmin()
    .from('staff_services')
    .select('staff_id, service_id');

  if (error) {
    throw new Error(`No se pudo leer la asignacion de servicios: ${error.message}`);
  }

  const map = new Map<string, Set<string>>();
  for (const row of (data ?? []) as { staff_id: string; service_id: string }[]) {
    const set = map.get(row.service_id) ?? new Set<string>();
    set.add(row.staff_id);
    map.set(row.service_id, set);
  }
  return map;
}
