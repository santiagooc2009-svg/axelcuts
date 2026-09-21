import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Todo se guarda en UTC (timestamptz) y se muestra en la zona del negocio.
 * Estas funciones son el unico puente entre las dos; no hay `new Date(string)`
 * suelto en el resto del codigo.
 */

export const WEEKDAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
] as const;

/** 'yyyy-MM-dd' + 'HH:mm' en la zona del negocio → instante UTC. */
export function zonedToUtc(dateISO: string, time: string, timezone: string): Date {
  return fromZonedTime(`${dateISO}T${time.slice(0, 5)}:00`, timezone);
}

/** 'yyyy-MM-dd' del dia en curso segun el negocio, no segun el servidor. */
export function todayISO(timezone: string, now = new Date()): string {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

export function dateISO(instant: Date | string, timezone: string): string {
  return formatInTimeZone(instant, timezone, 'yyyy-MM-dd');
}

/**
 * 0 = domingo, como `business_hours.weekday`. Una fecha de calendario ya
 * trae su dia de la semana, asi que aqui no hace falta la zona horaria.
 */
export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatTime(instant: Date | string, timezone: string): string {
  return formatInTimeZone(instant, timezone, 'HH:mm');
}

export function formatLongDate(instant: Date | string, timezone: string): string {
  const d = formatInTimeZone(instant, timezone, 'yyyy-MM-dd');
  const [y, m, day] = d.split('-').map(Number);
  const weekday = WEEKDAY_NAMES[weekdayOf(d)];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${weekday} ${day} de ${months[m - 1]} de ${y}`;
}

/** 'Martes 4 de marzo, 16:30' — lo que va en el WhatsApp. */
export function formatDateTime(instant: Date | string, timezone: string): string {
  return `${formatLongDate(instant, timezone)}, ${formatTime(instant, timezone)}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Diferencia en dias entre dos fechas locales 'yyyy-MM-dd'. */
export function diffDaysISO(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
