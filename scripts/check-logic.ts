/**
 * Verificaciones de la logica que no toca la base de datos: telefonos, zona
 * horaria y calculo de huecos.
 *
 *   npm run check
 *
 * No es un framework de tests: es un script que corre en segundos y avisa si
 * algo de lo delicado se rompio.
 */
import { normalizePhone, formatPhone, toWhatsappNumber } from '../src/lib/phone.ts';
import {
  zonedToUtc, dateISO, weekdayOf, formatTime, formatDateTime,
  addDaysISO, diffDaysISO, hhmmToMinutes, minutesToHHMM,
} from '../src/lib/time.ts';
import { computeSlots } from '../src/lib/slots.ts';

let fails = 0;

function eq(label: string, got: unknown, want: unknown) {
  const ok = String(got) === String(want);
  if (!ok) fails += 1;
  console.log(`${ok ? '  ok  ' : 'FALLA '} ${label}${ok ? '' : `\n         obtuve: ${got}\n         esperaba: ${want}`}`);
}

const TZ = 'America/Mexico_City';
const h = (time: string) => hhmmToMinutes(time);

// ---------------------------------------------------------------------------
console.log('\nTelefonos');
eq('10 digitos', normalizePhone('5512345678'), '+525512345678');
eq('con espacios', normalizePhone('55 1234 5678'), '+525512345678');
eq('con lada del pais', normalizePhone('+52 55 1234 5678'), '+525512345678');
eq('formato viejo 521', normalizePhone('5215512345678'), '+525512345678');
eq('parentesis y guiones', normalizePhone('(55) 1234-5678'), '+525512345678');
eq('texto invalido', normalizePhone('abc'), 'null');
eq('demasiado corto', normalizePhone('12345'), 'null');
eq('formato para mostrar', formatPhone('+525512345678'), '55 1234 5678');
eq('formato para wa.me', toWhatsappNumber('+525512345678'), '525512345678');

// ---------------------------------------------------------------------------
console.log('\nZona horaria');
const d = zonedToUtc('2026-03-10', '16:30', TZ);
eq('16:30 local -> UTC', d.toISOString(), '2026-03-10T22:30:00.000Z');
eq('UTC -> hora local', formatTime(d, TZ), '16:30');
eq('UTC -> fecha local', dateISO(d, TZ), '2026-03-10');
eq('medianoche local -> UTC', zonedToUtc('2026-03-10', '00:00', TZ).toISOString(), '2026-03-10T06:00:00.000Z');
eq('madrugada UTC es el dia previo aca', dateISO(new Date('2026-03-10T02:00:00Z'), TZ), '2026-03-09');
eq('texto del WhatsApp', formatDateTime(d, TZ), 'Martes 10 de marzo de 2026, 16:30');

console.log('\nCalendario');
eq('10/03/2026 es martes', weekdayOf('2026-03-10'), 2);
eq('sumar dias cruzando mes', addDaysISO('2026-03-30', 5), '2026-04-04');
eq('restar dias cruzando ano', addDaysISO('2026-01-02', -5), '2025-12-28');
eq('diferencia de dias', diffDaysISO('2026-03-10', '2026-03-13'), 3);
eq('minutos -> HH:mm', minutesToHHMM(615), '10:15');

// ---------------------------------------------------------------------------
console.log('\nHuecos de la agenda');
const dia = [{ staffId: null, open: h('10:00'), close: h('14:00') }];

{
  const slots = computeSlots({
    staffIds: ['axel'], windows: dia, blocks: [],
    durationMin: 60, stepMin: 30, earliestMin: 0,
  });
  eq('dia vacio, cortes de 60 min cada 30', slots.length, 7);
  eq('primer hueco', minutesToHHMM(slots[0].start), '10:00');
  eq('ultimo hueco cabe completo antes de cerrar', minutesToHHMM(slots.at(-1)!.start), '13:00');
}

{
  // Un corte de 45 min no debe ofrecerse a las 13:30 si se cierra a las 14.
  const slots = computeSlots({
    staffIds: ['axel'], windows: dia, blocks: [],
    durationMin: 45, stepMin: 30, earliestMin: 0,
  });
  eq('el servicio cabe entero antes de cerrar', minutesToHHMM(slots.at(-1)!.start), '13:00');
}

{
  // Cita de 11:00 a 12:00: debe tapar 10:30 (que terminaria 11:30) y 11:30.
  const slots = computeSlots({
    staffIds: ['axel'], windows: dia,
    blocks: [{ staffId: 'axel', start: h('11:00'), end: h('12:00') }],
    durationMin: 60, stepMin: 30, earliestMin: 0,
  });
  const horas = slots.map((s) => minutesToHHMM(s.start)).join(' ');
  eq('una cita tapa los huecos que se le encinan', horas, '10:00 12:00 12:30 13:00');
}

{
  // Dos barberos: la cita de uno no debe quitarle el hueco al otro.
  const slots = computeSlots({
    staffIds: ['axel', 'mario'], windows: dia,
    blocks: [{ staffId: 'axel', start: h('11:00'), end: h('12:00') }],
    durationMin: 60, stepMin: 60, earliestMin: 0,
  });
  const once = slots.find((s) => s.start === h('11:00'));
  eq('a las 11 solo queda el otro barbero', once?.staffIds.join(','), 'mario');
  const diez = slots.find((s) => s.start === h('10:00'));
  eq('a las 10 estan los dos', diez?.staffIds.join(','), 'axel,mario');
}

{
  // Bloqueo general (staffId null): cierra para todos.
  const slots = computeSlots({
    staffIds: ['axel', 'mario'], windows: dia,
    blocks: [{ staffId: null, start: h('10:00'), end: h('12:00') }],
    durationMin: 60, stepMin: 60, earliestMin: 0,
  });
  eq('un bloqueo general cierra para todos', slots.map((s) => minutesToHHMM(s.start)).join(' '), '12:00 13:00');
}

{
  // Anticipacion minima: son las 10:00 y se piden 60 min de aviso.
  const slots = computeSlots({
    staffIds: ['axel'], windows: dia, blocks: [],
    durationMin: 60, stepMin: 30, earliestMin: h('11:00'),
  });
  eq('respeta la anticipacion minima', minutesToHHMM(slots[0].start), '11:00');
}

{
  // Horario partido: cierra a comer de 14 a 16.
  const partido = [
    { staffId: null, open: h('10:00'), close: h('14:00') },
    { staffId: null, open: h('16:00'), close: h('20:00') },
  ];
  const slots = computeSlots({
    staffIds: ['axel'], windows: partido, blocks: [],
    durationMin: 60, stepMin: 60, earliestMin: 0,
  });
  eq('no ofrece huecos en la hora de comida', slots.map((s) => minutesToHHMM(s.start)).join(' '), '10:00 11:00 12:00 13:00 16:00 17:00 18:00 19:00');
}

{
  // Horario propio del barbero gana sobre el general.
  const mezcla = [
    { staffId: null, open: h('10:00'), close: h('20:00') },
    { staffId: 'mario', open: h('16:00'), close: h('18:00') },
  ];
  const slots = computeSlots({
    staffIds: ['mario'], windows: mezcla, blocks: [],
    durationMin: 60, stepMin: 60, earliestMin: 0,
  });
  eq('el horario propio manda', slots.map((s) => minutesToHHMM(s.start)).join(' '), '16:00 17:00');
}

{
  // Un bloqueo que viene del dia anterior (minutos negativos).
  const slots = computeSlots({
    staffIds: ['axel'], windows: dia,
    blocks: [{ staffId: 'axel', start: -120, end: h('11:00') }],
    durationMin: 60, stepMin: 60, earliestMin: 0,
  });
  eq('bloqueo que viene de ayer se come la manana', slots.map((s) => minutesToHHMM(s.start)).join(' '), '11:00 12:00 13:00');
}

// ---------------------------------------------------------------------------
console.log(fails === 0 ? '\nTodo bien.\n' : `\n${fails} verificaciones fallaron.\n`);
process.exit(fails === 0 ? 0 : 1);
