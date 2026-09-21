import Link from 'next/link';

import ActionButton from '@/components/ActionButton';
import PushToggle from '@/components/PushToggle';
import { ButtonLink, Money, StatusPill } from '@/components/ui';
import AdminForm from '@/components/AdminForm';
import Collapsible from '@/components/Collapsible';
import { Field, inputClass } from '@/components/ui';
import {
  cancelAction,
  completeAction,
  confirmAction,
  noShowAction,
  rescheduleAction,
} from '@/app/admin/actions';
import { getAppointmentsForRange } from '@/lib/bookings';
import { getSettings, getStaff } from '@/lib/data';
import { formatPhone, toWhatsappNumber } from '@/lib/phone';
import {
  addDaysISO,
  dateISO,
  formatLongDate,
  formatTime,
  todayISO,
  zonedToUtc,
} from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const { dia } = await searchParams;
  const [settings, staff] = await Promise.all([getSettings(), getStaff()]);
  const tz = settings.timezone;

  const today = todayISO(tz);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? '') ? (dia as string) : today;

  const from = zonedToUtc(day, '00:00', tz);
  const to = zonedToUtc(addDaysISO(day, 1), '00:00', tz);
  const appointments = await getAppointmentsForRange(from.toISOString(), to.toISOString());

  const live = appointments.filter(
    (a) => a.status === 'pending' || a.status === 'confirmed',
  );
  const income = appointments
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + a.price_cents, 0);

  return (
    <>
      {/* ---- Encabezado del dia ---- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {day === today ? 'Hoy' : formatLongDate(`${day}T12:00:00Z`, 'UTC')}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {live.length} {live.length === 1 ? 'cita por atender' : 'citas por atender'}
            {income > 0 ? (
              <>
                {' · '}
                <Money cents={income} /> cobrados
              </>
            ) : null}
          </p>
        </div>

        <ButtonLink href="/admin/nueva-cita">Nueva cita</ButtonLink>
      </div>

      {/* ---- Navegacion de dias ---- */}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/admin?dia=${addDaysISO(day, -1)}`}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-ink-300 hover:border-ink-600"
        >
          ← Dia anterior
        </Link>
        {day !== today ? (
          <Link
            href="/admin"
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-ink-300 hover:border-ink-600"
          >
            Hoy
          </Link>
        ) : null}
        <Link
          href={`/admin?dia=${addDaysISO(day, 1)}`}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-ink-300 hover:border-ink-600"
        >
          Dia siguiente →
        </Link>
      </div>

      {/* ---- Citas ---- */}
      <section className="mt-6 space-y-3">
        {appointments.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-semibold">Ninguna cita este dia</p>
            <p className="mt-1 text-sm text-ink-400">
              Cuando alguien reserve desde la pagina, aparece aqui sola.
            </p>
          </div>
        ) : null}

        {appointments.map((appointment) => {
          const open =
            appointment.status === 'pending' || appointment.status === 'confirmed';

          return (
            <article key={appointment.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tabular-nums">
                      {formatTime(appointment.starts_at, tz)}
                    </span>
                    <StatusPill status={appointment.status} />
                  </div>

                  {appointment.customer ? (
                    <Link
                      href={`/admin/clientes/${appointment.customer.loyalty_code}`}
                      className="mt-1.5 block font-semibold hover:text-copper-300"
                    >
                      {appointment.customer.name}
                    </Link>
                  ) : (
                    <p className="mt-1.5 font-semibold">Cliente</p>
                  )}

                  <p className="text-sm text-ink-400">
                    {appointment.service?.name}
                    {appointment.staff ? ` · ${appointment.staff.name}` : ''}
                    {' · '}
                    {formatTime(appointment.starts_at, tz)}–{formatTime(appointment.ends_at, tz)}
                  </p>

                  {appointment.notes ? (
                    <p className="mt-2 rounded-lg bg-ink-850 px-3 py-2 text-sm text-ink-300">
                      {appointment.notes}
                    </p>
                  ) : null}

                  {appointment.customer ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <a
                        href={`https://wa.me/${toWhatsappNumber(appointment.customer.phone)}`}
                        className="text-copper-300 hover:text-copper-400"
                      >
                        {formatPhone(appointment.customer.phone)}
                      </a>
                      <Link
                        href={`/tarjeta/${appointment.customer.loyalty_code}`}
                        className="text-ink-400 hover:text-ink-100"
                      >
                        {appointment.customer.stamps}/{settings.loyalty_goal} sellos
                      </Link>
                    </div>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="font-semibold text-copper-300">
                    <Money cents={appointment.price_cents} />
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-400">{appointment.code}</p>
                </div>
              </div>

              {open ? (
                <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-ink-800 pt-4">
                  {appointment.status === 'pending' ? (
                    <ActionButton
                      variant="primary"
                      label="Confirmar"
                      pendingLabel="Confirmando…"
                      action={confirmAction.bind(null, appointment.code)}
                    />
                  ) : null}
                  <ActionButton
                    variant={appointment.status === 'pending' ? 'secondary' : 'primary'}
                    label="Ya se atendio"
                    pendingLabel="Cerrando…"
                    action={completeAction.bind(null, appointment.code)}
                  />
                  <ActionButton
                    label="No llego"
                    action={noShowAction.bind(null, appointment.code)}
                    confirm="¿Marcar que no llego?"
                  />
                  <ActionButton
                    variant="ghost"
                    label="Cancelar"
                    action={cancelAction.bind(null, appointment.code)}
                    confirm="¿Cancelar esta cita?"
                  />
                </div>
              ) : null}

              {open ? (
                <div className="mt-4">
                  <Collapsible label="Mover de hora">
                    <div className="max-w-sm">
                      <AdminForm
                        action={rescheduleAction.bind(null, appointment.code)}
                        submitLabel="Mover cita"
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Nuevo dia">
                            <input
                              type="date"
                              name="date"
                              className={inputClass}
                              required
                              defaultValue={dateISO(appointment.starts_at, tz)}
                            />
                          </Field>
                          <Field label="Nueva hora">
                            <input
                              type="time"
                              name="time"
                              className={inputClass}
                              required
                              step={300}
                              defaultValue={formatTime(appointment.starts_at, tz)}
                            />
                          </Field>
                        </div>

                        {staff.length > 0 ? (
                          <Field label="Barbero">
                            <select
                              name="staffId"
                              className={inputClass}
                              defaultValue={appointment.staff_id ?? ''}
                            >
                              <option value="">Sin asignar</option>
                              {staff.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ) : null}
                      </AdminForm>
                    </div>
                  </Collapsible>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <div className="mt-10 border-t border-ink-800 pt-6">
        <PushToggle role="admin" />
        <p className="mt-2 text-center text-xs text-ink-400">
          Activa el aviso para enterarte en el momento en que alguien reserve.
        </p>
      </div>
    </>
  );
}
