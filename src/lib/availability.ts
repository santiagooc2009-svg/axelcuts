import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getBusinessHours,
  getSettings,
  getStaff,
  getStaffServiceMap,
  getTimeOffBetween,
} from '@/lib/data';
import {
  diffDaysISO,
  hhmmToMinutes,
  minutesToHHMM,
  todayISO,
  weekdayOf,
  zonedToUtc,
} from '@/lib/time';
import { computeSlots } from '@/lib/slots';
import type { Service, Settings } from '@/types/db';

export type Slot = {
  /** 'HH:mm' en la zona del negocio. */
  time: string;
  /** Instante exacto en UTC, que es lo que se manda al crear la cita. */
  startsAt: string;
  /** Barberos libres a esa hora, en orden de preferencia. */
  staffIds: string[];
};

export type DayAvailability = {
  date: string;
  open: boolean;
  /** Por que no hay huecos, cuando no los hay. */
  reason?: 'closed' | 'past' | 'too_far' | 'full';
  slots: Slot[];
};

type Busy = { staffId: string | null; start: number; end: number };

/**
 * Huecos reales de un dia para un servicio.
 *
 * La regla de oro: un hueco existe si CABE EL SERVICIO COMPLETO dentro de una
 * ventana de horario, sin encimarse con otra cita ni con un bloqueo. Por eso
 * se razona en minutos desde la medianoche local y se compara el rango
 * [inicio, inicio + duracion) y no solo la hora de inicio.
 */
export async function getDayAvailability(
  dateISO: string,
  service: Service,
  requestedStaffId?: string | null,
  now = new Date(),
): Promise<DayAvailability> {
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayISO(tz, now);

  const daysAhead = diffDaysISO(today, dateISO);
  if (daysAhead < 0) return { date: dateISO, open: false, reason: 'past', slots: [] };
  if (daysAhead > settings.max_horizon_days) {
    return { date: dateISO, open: false, reason: 'too_far', slots: [] };
  }

  const [hours, allStaff, staffServices] = await Promise.all([
    getBusinessHours(),
    getStaff(true),
    getStaffServiceMap(),
  ]);

  // Barberos que pueden dar este servicio. Sin asignacion explicita, todos.
  const allowed = staffServices.get(service.id);
  let candidates = allStaff.filter((s) => !allowed || allowed.has(s.id));
  if (requestedStaffId) {
    candidates = candidates.filter((s) => s.id === requestedStaffId);
  }
  if (candidates.length === 0) {
    return { date: dateISO, open: false, reason: 'closed', slots: [] };
  }

  const weekday = weekdayOf(dateISO);
  const dayStart = zonedToUtc(dateISO, '00:00', tz);
  const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000);

  const [busy, timeOff] = await Promise.all([
    loadBusy(dayStart, dayEnd, tz, dateISO),
    getTimeOffBetween(dayStart.toISOString(), dayEnd.toISOString()),
  ]);

  const blocks: Busy[] = [
    ...busy,
    ...timeOff.map((t) => ({
      staffId: t.staff_id,
      start: toLocalMinutes(t.starts_at, tz, dateISO),
      end: toLocalMinutes(t.ends_at, tz, dateISO),
    })),
  ];

  const step = settings.slot_minutes;
  const earliest =
    minutesSinceLocalMidnight(now, tz, dateISO) + settings.min_lead_minutes;

  // Ventanas de horario del dia: las propias del barbero o la general.
  const windows = hours
    .filter((h) => h.weekday === weekday)
    .filter((h) => h.staff_id === null || candidates.some((c) => c.id === h.staff_id))
    .map((h) => ({
      staffId: h.staff_id,
      open: hhmmToMinutes(h.open_time),
      close: hhmmToMinutes(h.close_time),
    }));

  const drafts = computeSlots({
    staffIds: candidates.map((c) => c.id),
    windows,
    blocks: blocks.map((b) => ({ staffId: b.staffId, start: b.start, end: b.end })),
    durationMin: service.duration_min,
    stepMin: step,
    earliestMin: earliest,
  });

  const slots: Slot[] = drafts.map((draft) => {
    const time = minutesToHHMM(draft.start);
    return {
      time,
      startsAt: zonedToUtc(dateISO, time, tz).toISOString(),
      staffIds: draft.staffIds,
    };
  });

  // computeSlots ya devuelve los huecos ordenados por hora.
  const hadWindows = windows.length > 0;

  return {
    date: dateISO,
    open: hadWindows,
    reason: !hadWindows ? 'closed' : slots.length === 0 ? 'full' : undefined,
    slots,
  };
}

/** Citas vivas que ocupan al barbero ese dia, en minutos locales. */
async function loadBusy(
  dayStart: Date,
  dayEnd: Date,
  timezone: string,
  dateISO: string,
): Promise<Busy[]> {
  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .select('staff_id, starts_at, ends_at, status')
    .in('status', ['pending', 'confirmed'])
    .lt('starts_at', dayEnd.toISOString())
    .gt('ends_at', dayStart.toISOString());

  if (error) throw new Error(`No se pudo leer la agenda del dia: ${error.message}`);

  return (data ?? []).map((row) => ({
    staffId: row.staff_id as string | null,
    start: toLocalMinutes(row.starts_at as string, timezone, dateISO),
    end: toLocalMinutes(row.ends_at as string, timezone, dateISO),
  }));
}

/**
 * Instante UTC → minutos desde la medianoche local del dia que se esta
 * calculando. Un bloqueo que empieza el dia anterior da un numero negativo, y
 * eso es justo lo que queremos: sigue comiendose las primeras horas.
 */
function toLocalMinutes(instant: string | Date, timezone: string, dateISO: string): number {
  const midnight = zonedToUtc(dateISO, '00:00', timezone).getTime();
  const t = typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  return Math.round((t - midnight) / 60_000);
}

function minutesSinceLocalMidnight(now: Date, timezone: string, dateISO: string): number {
  return toLocalMinutes(now, timezone, dateISO);
}
