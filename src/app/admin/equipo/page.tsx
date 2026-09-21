import ActionButton from '@/components/ActionButton';
import AdminForm from '@/components/AdminForm';
import Collapsible from '@/components/Collapsible';
import { Field, inputClass } from '@/components/ui';
import {
  saveStaffAction,
  setStaffServicesAction,
  toggleStaffAction,
} from '@/app/admin/config-actions';
import { getServices, getStaff, getStaffServiceMap } from '@/lib/data';
import type { Staff } from '@/types/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Equipo' };

export default async function EquipoPage() {
  const [staff, services, serviceMap] = await Promise.all([
    getStaff(false),
    getServices(false),
    getStaffServiceMap(),
  ]);

  // El mapa viene por servicio; aqui conviene por persona.
  const byStaff = new Map<string, Set<string>>();
  for (const [serviceId, staffIds] of serviceMap) {
    for (const staffId of staffIds) {
      const set = byStaff.get(staffId) ?? new Set<string>();
      set.add(serviceId);
      byStaff.set(staffId, set);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Equipo</h1>
      <p className="mt-1 text-sm text-ink-400">
        Quien atiende. Cada persona tiene su propia agenda, asi que dos
        pueden tener cita a la misma hora sin encimarse.
      </p>

      <section className="mt-8 space-y-3">
        {staff.map((member) => {
          const assigned = byStaff.get(member.id);

          return (
            <article key={member.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {member.name}
                    {!member.active ? (
                      <span className="ml-2 rounded-full bg-ink-700 px-2 py-0.5 text-xs text-ink-300">
                        Inactivo
                      </span>
                    ) : null}
                  </p>
                  {member.bio ? (
                    <p className="mt-0.5 text-sm text-ink-400">{member.bio}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-ink-400">
                    {!assigned || assigned.size === 0
                      ? 'Da todos los servicios'
                      : `Da ${assigned.size} de ${services.length} servicios`}
                  </p>
                </div>

                <ActionButton
                  label={member.active ? 'Desactivar' : 'Activar'}
                  action={toggleStaffAction.bind(null, member.id, !member.active)}
                />
              </div>

              <div className="mt-4 space-y-4 border-t border-ink-800 pt-4">
                <Collapsible label="Editar datos">
                  <StaffFields member={member} submitLabel="Guardar cambios" />
                </Collapsible>

                <Collapsible label="Que servicios da">
                  <AdminForm action={setStaffServicesAction} submitLabel="Guardar servicios">
                    <input type="hidden" name="staffId" value={member.id} />

                    <p className="text-sm text-ink-400">
                      Si no marcas ninguno, puede dar cualquier servicio. Marca
                      solo cuando alguien haga una parte del menu.
                    </p>

                    <div className="space-y-2">
                      {services.map((service) => (
                        <label key={service.id} className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            name="serviceIds"
                            value={service.id}
                            defaultChecked={assigned?.has(service.id) ?? false}
                            className="size-4 accent-copper-500"
                          />
                          <span>{service.name}</span>
                        </label>
                      ))}
                    </div>
                  </AdminForm>
                </Collapsible>
              </div>
            </article>
          );
        })}

        {staff.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-semibold">Todavia no hay nadie en el equipo</p>
            <p className="mt-1 text-sm text-ink-400">
              Agrega al menos una persona para poder agendar.
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10 border-t border-ink-800 pt-8">
        <h2 className="text-lg font-semibold">Agregar a alguien</h2>
        <div className="mt-4 max-w-lg">
          <StaffFields submitLabel="Agregar al equipo" reset />
        </div>
      </section>
    </>
  );
}

function StaffFields({
  member,
  submitLabel,
  reset = false,
}: {
  member?: Staff;
  submitLabel: string;
  reset?: boolean;
}) {
  return (
    <AdminForm action={saveStaffAction} submitLabel={submitLabel} resetOnSuccess={reset}>
      {member ? <input type="hidden" name="id" value={member.id} /> : null}

      <Field label="Nombre">
        <input
          name="name"
          className={inputClass}
          required
          minLength={2}
          defaultValue={member?.name}
        />
      </Field>

      <Field label="Descripcion" hint="Opcional. Se ve en la pagina publica.">
        <input
          name="bio"
          className={inputClass}
          maxLength={200}
          defaultValue={member?.bio ?? ''}
        />
      </Field>

      <Field label="Orden">
        <input
          name="sort_order"
          className={inputClass}
          type="number"
          min={0}
          max={999}
          defaultValue={member?.sort_order ?? 0}
        />
      </Field>
    </AdminForm>
  );
}

