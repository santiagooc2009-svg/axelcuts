import ActionButton from '@/components/ActionButton';
import AdminForm from '@/components/AdminForm';
import Collapsible from '@/components/Collapsible';
import { Field, Money, inputClass } from '@/components/ui';
import {
  deleteServiceAction,
  saveServiceAction,
  toggleServiceAction,
} from '@/app/admin/config-actions';
import { getServices } from '@/lib/data';
import type { Service } from '@/types/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Servicios' };

export default async function ServiciosPage() {
  const services = await getServices(false);

  return (
    <>
      <h1 className="text-2xl font-bold">Servicios</h1>
      <p className="mt-1 text-sm text-ink-400">
        Lo que ofreces, cuanto dura y cuanto cuesta. La duracion es lo que
        decide cuantos huecos caben en el dia.
      </p>

      <section className="mt-8 space-y-3">
        {services.map((service) => (
          <article key={service.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {service.name}
                  {!service.active ? (
                    <span className="ml-2 rounded-full bg-ink-700 px-2 py-0.5 text-xs text-ink-300">
                      Oculto
                    </span>
                  ) : null}
                </p>
                {service.description ? (
                  <p className="mt-0.5 text-sm text-ink-400">{service.description}</p>
                ) : null}
                <p className="mt-1 text-sm text-ink-400">
                  {service.duration_min} min · orden {service.sort_order}
                </p>
              </div>

              <p className="font-semibold text-copper-300">
                <Money cents={service.price_cents} />
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-ink-800 pt-4">
              <ActionButton
                label={service.active ? 'Ocultar' : 'Mostrar'}
                action={toggleServiceAction.bind(null, service.id, !service.active)}
              />
              <ActionButton
                variant="ghost"
                label="Eliminar"
                action={deleteServiceAction.bind(null, service.id)}
                confirm="¿Eliminar este servicio?"
              />
            </div>

            <div className="mt-4 border-t border-ink-800 pt-4">
              <Collapsible label="Editar">
                <ServiceFields service={service} submitLabel="Guardar cambios" />
              </Collapsible>
            </div>
          </article>
        ))}

        {services.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-semibold">Todavia no hay servicios</p>
            <p className="mt-1 text-sm text-ink-400">
              Agrega al menos uno para poder agendar.
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10 border-t border-ink-800 pt-8">
        <h2 className="text-lg font-semibold">Agregar servicio</h2>
        <div className="mt-4 max-w-lg">
          <ServiceFields submitLabel="Agregar servicio" reset />
        </div>
      </section>
    </>
  );
}

/** Mismos campos para crear y para editar; el `id` decide cual de los dos. */
function ServiceFields({
  service,
  submitLabel,
  reset = false,
}: {
  service?: Service;
  submitLabel: string;
  reset?: boolean;
}) {
  return (
    <AdminForm action={saveServiceAction} submitLabel={submitLabel} resetOnSuccess={reset}>
      {service ? <input type="hidden" name="id" value={service.id} /> : null}

      <Field label="Nombre">
        <input
          name="name"
          className={inputClass}
          required
          minLength={2}
          defaultValue={service?.name}
          placeholder="Corte de cabello"
        />
      </Field>

      <Field label="Descripcion" hint="Opcional. Se ve en la pagina publica.">
        <input
          name="description"
          className={inputClass}
          maxLength={200}
          defaultValue={service?.description ?? ''}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duracion (min)">
          <input
            name="duration_min"
            className={inputClass}
            type="number"
            min={5}
            max={480}
            step={5}
            required
            defaultValue={service?.duration_min ?? 45}
          />
        </Field>

        <Field label="Precio (pesos)">
          <input
            name="price_pesos"
            className={inputClass}
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={service ? service.price_cents / 100 : 200}
          />
        </Field>

        <Field label="Orden">
          <input
            name="sort_order"
            className={inputClass}
            type="number"
            min={0}
            max={999}
            defaultValue={service?.sort_order ?? 0}
          />
        </Field>
      </div>
    </AdminForm>
  );
}
