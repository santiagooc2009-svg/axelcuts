import Link from 'next/link';

import AdminForm from '@/components/AdminForm';
import { Field, inputClass } from '@/components/ui';
import { saveSettingsAction } from '@/app/admin/config-actions';
import { getSettings } from '@/lib/data';
import { messagingMode } from '@/lib/messaging/outbox';
import { pushEnabled } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ajustes' };

const SECTIONS = [
  { href: '/admin/servicios', label: 'Servicios', hint: 'Que ofreces, duracion y precio' },
  { href: '/admin/equipo', label: 'Equipo', hint: 'Quien atiende y que hace cada quien' },
  { href: '/admin/horario', label: 'Horario', hint: 'Dias, horas y bloqueos' },
];

export default async function AjustesPage() {
  const settings = await getSettings();
  const mode = messagingMode();

  return (
    <>
      <h1 className="text-2xl font-bold">Ajustes</h1>

      {/* ---- Accesos a las otras secciones ---- */}
      <nav className="mt-6 grid gap-3 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="card p-4 transition-colors hover:border-ink-600"
          >
            <p className="font-semibold">{section.label}</p>
            <p className="mt-0.5 text-sm text-ink-400">{section.hint}</p>
          </Link>
        ))}
      </nav>

      {/* ---- Ajustes del negocio ---- */}
      <section className="mt-10 max-w-lg">
        <h2 className="text-lg font-semibold">El negocio</h2>

        <div className="mt-4">
          <AdminForm action={saveSettingsAction} submitLabel="Guardar ajustes">
            <Field label="Nombre">
              <input
                name="business_name"
                className={inputClass}
                required
                minLength={2}
                defaultValue={settings.business_name}
              />
            </Field>

            <Field label="WhatsApp del negocio" hint="El numero al que escriben los clientes.">
              <input
                name="phone"
                className={inputClass}
                type="tel"
                defaultValue={settings.phone ?? ''}
                placeholder="55 1234 5678"
              />
            </Field>

            <Field label="Direccion" hint="Va dentro del WhatsApp de confirmacion.">
              <input
                name="address"
                className={inputClass}
                maxLength={200}
                defaultValue={settings.address ?? ''}
              />
            </Field>

            <Field
              label="Zona horaria"
              hint="Con esto se calculan todas las horas. Ej. America/Mexico_City."
            >
              <input
                name="timezone"
                className={inputClass}
                required
                defaultValue={settings.timezone}
              />
            </Field>

            <h3 className="pt-4 text-sm font-semibold tracking-wide text-ink-300 uppercase">
              Como se agenda
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Cada cuanto (min)"
                hint="Los horarios se ofrecen de tanto en tanto."
              >
                <input
                  name="slot_minutes"
                  className={inputClass}
                  type="number"
                  min={5}
                  max={60}
                  step={5}
                  required
                  defaultValue={settings.slot_minutes}
                />
              </Field>

              <Field label="Anticipacion minima (min)" hint="Para reservas en linea.">
                <input
                  name="min_lead_minutes"
                  className={inputClass}
                  type="number"
                  min={0}
                  max={10080}
                  required
                  defaultValue={settings.min_lead_minutes}
                />
              </Field>

              <Field label="Se agenda hasta (dias)" hint="Que tan lejos se puede reservar.">
                <input
                  name="max_horizon_days"
                  className={inputClass}
                  type="number"
                  min={1}
                  max={365}
                  required
                  defaultValue={settings.max_horizon_days}
                />
              </Field>

              <Field
                label="Cancelacion libre (horas)"
                hint="Hasta cuando puede cancelar solo el cliente."
              >
                <input
                  name="cancel_window_hours"
                  className={inputClass}
                  type="number"
                  min={0}
                  max={168}
                  required
                  defaultValue={settings.cancel_window_hours}
                />
              </Field>
            </div>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="auto_confirm"
                defaultChecked={settings.auto_confirm}
                className="mt-0.5 size-4 accent-copper-500"
              />
              <span>
                Confirmar las reservas solas
                <span className="block text-ink-400">
                  Si lo apagas, las citas entran como "por confirmar" y tienes que
                  aprobarlas tu.
                </span>
              </span>
            </label>

            <h3 className="pt-4 text-sm font-semibold tracking-wide text-ink-300 uppercase">
              Recordatorios
            </h3>

            <Field
              label="Horas antes"
              hint="Separadas por coma. Ej. 24, 2 manda un aviso el dia antes y otro dos horas antes."
            >
              <input
                name="reminder_hours"
                className={inputClass}
                defaultValue={settings.reminder_hours.join(', ')}
                placeholder="24, 2"
              />
            </Field>

            <h3 className="pt-4 text-sm font-semibold tracking-wide text-ink-300 uppercase">
              Tarjeta de fidelidad
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sellos para el premio">
                <input
                  name="loyalty_goal"
                  className={inputClass}
                  type="number"
                  min={1}
                  max={30}
                  required
                  defaultValue={settings.loyalty_goal}
                />
              </Field>

              <Field label="Premio">
                <input
                  name="loyalty_reward"
                  className={inputClass}
                  required
                  maxLength={60}
                  defaultValue={settings.loyalty_reward}
                />
              </Field>
            </div>

            <p className="text-sm text-ink-400">
              Si subes la meta, a nadie se le quitan los sellos que ya tenia.
            </p>
          </AdminForm>
        </div>
      </section>

      {/* ---- Estado del sistema ---- */}
      <section className="mt-12 max-w-lg border-t border-ink-800 pt-8">
        <h2 className="text-lg font-semibold">Estado</h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Avisos por WhatsApp</dt>
            <dd className="text-right">
              {mode.automatic ? 'Automaticos' : 'Manuales (un toque desde Mensajes)'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-400">Notificaciones push</dt>
            <dd className="text-right">
              {pushEnabled() ? 'Configuradas' : 'Sin configurar (faltan llaves VAPID)'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-ink-400">
          Estos dos se cambian en las variables de entorno del servidor, no
          desde aqui. Vienen explicados en el README.
        </p>
      </section>
    </>
  );
}
