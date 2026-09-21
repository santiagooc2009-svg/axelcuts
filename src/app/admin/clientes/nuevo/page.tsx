import AdminForm from '@/components/AdminForm';
import { Field, inputClass } from '@/components/ui';
import { createCardAction } from '@/app/admin/actions';
import { getSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Nueva tarjeta' };

export default async function NuevaTarjetaPage() {
  const settings = await getSettings();

  return (
    <>
      <h1 className="text-2xl font-bold">Nueva tarjeta digital</h1>
      <p className="mt-1 text-sm text-ink-400">
        Con el nombre y el telefono basta. Sale el link de su tarjeta y lo
        mandas por WhatsApp de un toque; el cliente lo puede dejar en su
        pantalla principal.
      </p>

      <div className="mt-8 max-w-lg">
        <AdminForm action={createCardAction} submitLabel="Crear tarjeta">
          <Field label="Nombre">
            <input name="name" className={inputClass} required minLength={2} autoComplete="off" />
          </Field>

          <Field
            label="WhatsApp"
            hint="Si esta persona ya tenia tarjeta, se reusa la suya en vez de duplicarla."
          >
            <input
              name="phone"
              className={inputClass}
              required
              type="tel"
              placeholder="55 1234 5678"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Sellos de arranque"
            hint={`Por si ya venia juntando visitas en papel. De 0 a ${settings.loyalty_goal}.`}
          >
            <input
              name="stamps"
              className={inputClass}
              type="number"
              min={0}
              max={settings.loyalty_goal}
              defaultValue={0}
            />
          </Field>
        </AdminForm>
      </div>
    </>
  );
}
