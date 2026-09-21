import Link from 'next/link';

import ActionButton from '@/components/ActionButton';
import AdminForm from '@/components/AdminForm';
import Collapsible from '@/components/Collapsible';
import { Field, inputClass } from '@/components/ui';
import {
  addHoursAction,
  addTimeOffAction,
  deleteHoursAction,
  deleteTimeOffAction,
} from '@/app/admin/config-actions';
import { getBusinessHours, getSettings, getStaff } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WEEKDAY_NAMES, formatDateTime, todayISO } from '@/lib/time';
import type { TimeOff } from '@/types/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Horario' };

export default async function HorarioPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string }>;
}) {
  const { de } = await searchParams;

  const [settings, hours, staff] = await Promise.all([
    getSettings(),
    getBusinessHours(),
    getStaff(false),
  ]);

  // `de` elige de quien es el horario que se esta viendo: el general del
  // negocio o el propio de una persona.
  const viewing = staff.find((s) => s.id === de) ?? null;
  const scopeId = viewing?.id ?? null;
  const scoped = hours.filter((h) => h.staff_id === scopeId);

  // Bloqueos futuros; los pasados no sirven de nada en el mostrador.
  const { data: timeOffRows } = await supabaseAdmin()
    .from('time_off')
    .select('*')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at')
    .limit(50);

  const blocks = (timeOffRows ?? []) as TimeOff[];
  const staffNames = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <>
      <h1 className="text-2xl font-bold">Horario</h1>
      <p className="mt-1 text-sm text-ink-400">
        Las horas en que se puede agendar. Puedes poner dos bloques el mismo
        dia si cierras a comer.
      </p>

      {/* ---- De quien es el horario ---- */}
      {staff.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/admin/horario"
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              scopeId === null
                ? 'border-copper-400 text-copper-300'
                : 'border-ink-700 text-ink-300 hover:border-ink-600'
            }`}
          >
            Horario del negocio
          </Link>
          {staff.map((member) => (
            <Link
              key={member.id}
              href={`/admin/horario?de=${member.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                scopeId === member.id
                  ? 'border-copper-400 text-copper-300'
                  : 'border-ink-700 text-ink-300 hover:border-ink-600'
              }`}
            >
              {member.name}
            </Link>
          ))}
        </div>
      ) : null}

      {viewing ? (
        <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 px-4 py-3 text-sm text-ink-300">
          Horario propio de <strong className="text-ink-100">{viewing.name}</strong>. Si
          tiene aunque sea un bloque aqui, manda sobre el horario del negocio.
          Si lo dejas vacio, sigue el general.
        </p>
      ) : null}

      {/* ---- Semana ---- */}
      <section className="mt-6 space-y-3">
        {WEEKDAY_NAMES.map((label, weekday) => {
          const windows = scoped.filter((h) => h.weekday === weekday);

          return (
            <article key={label} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold">{label}</p>

                {windows.length === 0 ? (
                  <p className="text-sm text-ink-400">Cerrado</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {windows.map((window) => (
                      <li key={window.id} className="flex items-center gap-3">
                        <span className="tabular-nums">
                          {window.open_time.slice(0, 5)} – {window.close_time.slice(0, 5)}
                        </span>
                        <ActionButton
                          variant="ghost"
                          label="Quitar"
                          action={deleteHoursAction.bind(null, window.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 border-t border-ink-800 pt-4">
                <Collapsible label="Agregar bloque">
                  <AdminForm action={addHoursAction} submitLabel="Agregar" resetOnSuccess>
                    <input type="hidden" name="weekday" value={weekday} />
                    <input type="hidden" name="staffId" value={scopeId ?? ''} />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Abre">
                        <input
                          name="open_time"
                          className={inputClass}
                          type="time"
                          required
                          step={300}
                          defaultValue="10:00"
                        />
                      </Field>
                      <Field label="Cierra">
                        <input
                          name="close_time"
                          className={inputClass}
                          type="time"
                          required
                          step={300}
                          defaultValue="20:00"
                        />
                      </Field>
                    </div>
                  </AdminForm>
                </Collapsible>
              </div>
            </article>
          );
        })}
      </section>

      {/* ---- Bloqueos ---- */}
      <section className="mt-12 border-t border-ink-800 pt-8">
        <h2 className="text-xl font-bold">Dias cerrados y bloqueos</h2>
        <p className="mt-1 text-sm text-ink-400">
          Vacaciones, festivos o un rato que necesitas libre. Esas horas dejan
          de ofrecerse, pero las citas que ya existen no se cancelan solas.
        </p>

        <div className="mt-6 space-y-3">
          {blocks.map((block) => (
            <article key={block.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{block.reason ?? 'Cerrado'}</p>
                <p className="mt-0.5 text-sm text-ink-400">
                  {formatDateTime(block.starts_at, settings.timezone)} →{' '}
                  {formatDateTime(block.ends_at, settings.timezone)}
                </p>
                <p className="mt-0.5 text-sm text-ink-400">
                  {block.staff_id
                    ? `Solo ${staffNames.get(block.staff_id) ?? 'una persona'}`
                    : 'Todo el negocio'}
                </p>
              </div>

              <ActionButton
                variant="ghost"
                label="Quitar"
                action={deleteTimeOffAction.bind(null, block.id)}
                confirm="¿Quitar este bloqueo?"
              />
            </article>
          ))}

          {blocks.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-400">
              No hay bloqueos proximos.
            </div>
          ) : null}
        </div>

        <div className="mt-8 max-w-lg">
          <h3 className="text-lg font-semibold">Agregar bloqueo</h3>
          <div className="mt-4">
            <AdminForm action={addTimeOffAction} submitLabel="Bloquear" resetOnSuccess>
              <Field label="Quien">
                <select name="staffId" className={inputClass} defaultValue="">
                  <option value="">Todo el negocio</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      Solo {member.name}
                    </option>
                  ))}
                </select>
              </Field>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="all_day"
                  defaultChecked
                  className="size-4 accent-copper-500"
                />
                <span>Dias completos</span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Desde el dia">
                  <input
                    name="from_date"
                    className={inputClass}
                    type="date"
                    required
                    defaultValue={todayISO(settings.timezone)}
                  />
                </Field>
                <Field label="Hasta el dia" hint="Incluido.">
                  <input
                    name="to_date"
                    className={inputClass}
                    type="date"
                    required
                    defaultValue={todayISO(settings.timezone)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hora inicio" hint="Solo si no son dias completos.">
                  <input name="from_time" className={inputClass} type="time" step={300} />
                </Field>
                <Field label="Hora fin" hint="Solo si no son dias completos.">
                  <input name="to_time" className={inputClass} type="time" step={300} />
                </Field>
              </div>

              <Field label="Motivo" hint="Opcional. Solo lo ves tu.">
                <input name="reason" className={inputClass} maxLength={100} placeholder="Vacaciones" />
              </Field>
            </AdminForm>
          </div>
        </div>
      </section>
    </>
  );
}
