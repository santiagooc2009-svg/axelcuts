'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Field, Money, inputClass } from '@/components/ui';
import type { Service, Staff } from '@/types/db';

type Slot = { time: string; startsAt: string; staffIds: string[] };

type AvailabilityResponse = {
  date: string;
  open: boolean;
  reason?: 'closed' | 'past' | 'too_far' | 'full';
  slots: Slot[];
};

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const EMPTY_REASONS: Record<string, string> = {
  closed: 'Ese dia la barberia no abre.',
  past: 'Ese dia ya paso.',
  too_far: 'Todavia no abrimos la agenda tan lejos.',
  full: 'No queda ningun hueco ese dia. Prueba con otro.',
};

/** Fechas locales sin `new Date()` con hora: solo aritmetica de calendario. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function labelFor(iso: string, todayISO: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (iso === todayISO) return { top: 'Hoy', bottom: `${d} ${MONTHS[m - 1]}` };
  if (iso === addDays(todayISO, 1)) return { top: 'Manana', bottom: `${d} ${MONTHS[m - 1]}` };
  return { top: WEEKDAYS[weekday], bottom: `${d} ${MONTHS[m - 1]}` };
}

export default function BookingFlow({
  services,
  staff,
  todayISO,
  horizonDays,
}: {
  services: Service[];
  staff: Staff[];
  todayISO: string;
  horizonDays: number;
}) {
  const router = useRouter();

  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayISO);
  const [slot, setSlot] = useState<Slot | null>(null);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [serviceId, services],
  );

  const days = useMemo(
    () => Array.from({ length: Math.min(horizonDays, 21) }, (_, i) => addDays(todayISO, i)),
    [horizonDays, todayISO],
  );

  // Cada vez que cambia servicio, barbero o dia, la lista de horarios que
  // teniamos deja de ser verdad: se descarta antes de pedir la nueva.
  useEffect(() => {
    if (!serviceId) return;

    let cancelled = false;
    setLoadingSlots(true);
    setSlot(null);
    setAvailability(null);

    const params = new URLSearchParams({ date, serviceId });
    if (staffId) params.set('staffId', staffId);

    fetch(`/api/availability?${params}`)
      .then((res) => res.json())
      .then((data: AvailabilityResponse) => {
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos cargar los horarios. Revisa tu conexion.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, serviceId, staffId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!service || !slot) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          staffId,
          startsAt: slot.startsAt,
          name,
          phone,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'No pudimos guardar tu cita.');
        // El hueco se lo ganaron: recargamos horarios para no insistir.
        if (data.code === 'taken') setDate((d) => d);
        setSubmitting(false);
        return;
      }

      router.push(`/cita/${data.code}?nueva=1`);
    } catch {
      setError('No pudimos guardar tu cita. Intenta de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-10">
      {/* ---- 1. Servicio ---- */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          <span className="mr-2 text-copper-400">1.</span>Que te vas a hacer
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const selected = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                aria-pressed={selected}
                className={`card p-4 text-left transition-colors ${
                  selected ? 'border-copper-400' : 'hover:border-ink-600'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-sm text-copper-300">
                    <Money cents={s.price_cents} />
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-400">
                  {s.duration_min} min{s.description ? ` · ${s.description}` : ''}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---- 2. Barbero (solo si hay mas de uno) ---- */}
      {staff.length > 1 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold">
            <span className="mr-2 text-copper-400">2.</span>Con quien
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStaffId(null)}
              aria-pressed={staffId === null}
              className={`rounded-lg border px-4 py-2 text-sm ${
                staffId === null
                  ? 'border-copper-400 text-copper-300'
                  : 'border-ink-700 text-ink-300'
              }`}
            >
              Quien este libre
            </button>
            {staff.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setStaffId(member.id)}
                aria-pressed={staffId === member.id}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  staffId === member.id
                    ? 'border-copper-400 text-copper-300'
                    : 'border-ink-700 text-ink-300'
                }`}
              >
                {member.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- 3. Dia y hora ---- */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          <span className="mr-2 text-copper-400">{staff.length > 1 ? '3.' : '2.'}</span>
          Cuando
        </h2>

        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
          {days.map((day) => {
            const { top, bottom } = labelFor(day, todayISO);
            const selected = day === date;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setDate(day)}
                aria-pressed={selected}
                className={`min-w-[74px] shrink-0 rounded-lg border px-3 py-2.5 text-center ${
                  selected
                    ? 'border-copper-400 bg-copper-500/10'
                    : 'border-ink-700 hover:border-ink-600'
                }`}
              >
                <span className="block text-xs text-ink-400">{top}</span>
                <span className="block text-sm font-semibold">{bottom}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 min-h-[76px]" aria-live="polite">
          {loadingSlots ? (
            <p className="text-sm text-ink-400">Buscando horarios libres…</p>
          ) : availability && availability.slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {availability.slots.map((s) => {
                const selected = slot?.startsAt === s.startsAt;
                return (
                  <button
                    key={s.startsAt}
                    type="button"
                    onClick={() => setSlot(s)}
                    aria-pressed={selected}
                    className={`rounded-lg border py-2.5 text-sm font-semibold ${
                      selected
                        ? 'border-copper-400 bg-copper-500/10 text-copper-300'
                        : 'border-ink-700 hover:border-ink-600'
                    }`}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink-400">
              {EMPTY_REASONS[availability?.reason ?? ''] ?? 'Elige un dia para ver horarios.'}
            </p>
          )}
        </div>
      </section>

      {/* ---- 4. Datos ---- */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          <span className="mr-2 text-copper-400">{staff.length > 1 ? '4.' : '3.'}</span>
          Tus datos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
              placeholder="Como te llamas"
            />
          </Field>
          <Field label="WhatsApp" hint="A este numero te llega la confirmacion.">
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="55 1234 5678"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Algo que debamos saber" hint="Opcional.">
            <input
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              placeholder="Ej. fade bajo, ya vengo lavado"
            />
          </Field>
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-500"
        >
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 border-t border-ink-800 bg-ink-950/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-300">
            {service && slot ? (
              <>
                {service.name} · {labelFor(date, todayISO).bottom} a las {slot.time}
              </>
            ) : (
              'Elige servicio, dia y hora.'
            )}
          </p>
          <Button type="submit" disabled={!service || !slot || submitting}>
            {submitting ? 'Apartando…' : 'Confirmar cita'}
          </Button>
        </div>
      </div>
    </form>
  );
}
