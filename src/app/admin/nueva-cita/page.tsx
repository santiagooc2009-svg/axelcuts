import AdminForm from '@/components/AdminForm';
import { Field, inputClass } from '@/components/ui';
import { walkInAction } from '@/app/admin/actions';
import { getServices, getSettings, getStaff } from '@/lib/data';
import { todayISO } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Nueva cita' };

export default async function NuevaCitaPage() {
  const [settings, services, staff] = await Promise.all([
    getSettings(),
    getServices(false),
    getStaff(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Nueva cita</h1>
      <p className="mt-1 text-sm text-ink-400">
        Para cuando te llaman o llegan al mostrador. Al cliente le llega la
        confirmacion igual que si hubiera reservado en linea.
      </p>

      <div className="mt-8 max-w-lg">
        <AdminForm action={walkInAction} submitLabel="Apartar cita" resetOnSuccess>
          <Field label="Servicio">
            <select name="serviceId" className={inputClass} required>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {service.duration_min} min
                  {service.active ? '' : ' (oculto)'}
                </option>
              ))}
            </select>
          </Field>

          {staff.length > 0 ? (
            <Field label="Barbero" hint="Dejalo en blanco si da lo mismo quien.">
              <select name="staffId" className={inputClass} defaultValue="">
                <option value="">Sin asignar</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dia">
              <input
                type="date"
                name="date"
                className={inputClass}
                defaultValue={todayISO(settings.timezone)}
                required
              />
            </Field>
            <Field label="Hora">
              <input type="time" name="time" className={inputClass} required step={300} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input name="name" className={inputClass} required minLength={2} />
            </Field>
            <Field label="WhatsApp">
              <input name="phone" className={inputClass} required type="tel" placeholder="55 1234 5678" />
            </Field>
          </div>

          <Field label="Nota" hint="Opcional.">
            <input name="notes" className={inputClass} maxLength={200} />
          </Field>
        </AdminForm>
      </div>
    </>
  );
}
