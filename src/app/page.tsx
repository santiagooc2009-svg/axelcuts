import Link from 'next/link';

import { ButtonLink, Money } from '@/components/ui';
import { getBusinessHours, getServices, getSettings, getStaff } from '@/lib/data';
import { WEEKDAY_NAMES } from '@/lib/time';

// La portada muestra precios y horarios que el dueno cambia desde el panel:
// se arma en cada visita, no en el build.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [settings, services, staff, hours] = await Promise.all([
    getSettings(),
    getServices(),
    getStaff(),
    getBusinessHours(),
  ]);

  const general = hours.filter((h) => h.staff_id === null);

  return (
    <main>
      {/* ---- Portada ---- */}
      <section className="mx-auto max-w-4xl px-4 pt-20 pb-16 sm:pt-28">
        <p className="text-sm font-semibold tracking-[0.2em] text-copper-400 uppercase">
          {settings.business_name}
        </p>
        <h1 className="mt-4 text-4xl leading-tight font-bold sm:text-6xl">
          Aparta tu lugar
          <br />
          <span className="text-ink-400">sin una sola llamada.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-300">
          Eliges servicio, dia y hora. Te llega la confirmacion por WhatsApp y un
          recordatorio antes de tu cita. Nada mas.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href="/reservar">Reservar ahora</ButtonLink>
          <Link
            href="#servicios"
            className="px-2 py-3 text-sm font-semibold text-ink-300 hover:text-ink-100"
          >
            Ver servicios y precios
          </Link>
        </div>

        <p className="mt-6 text-sm text-ink-400">
          Junta {settings.loyalty_goal} visitas y la siguiente lleva{' '}
          <span className="text-copper-300">{settings.loyalty_reward.toLowerCase()}</span>.
        </p>
      </section>

      {/* ---- Servicios ---- */}
      <section id="servicios" className="border-t border-ink-800 bg-ink-900/40">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-bold">Servicios</h2>
          <ul className="mt-6 divide-y divide-ink-800">
            {services.map((service) => (
              <li key={service.id} className="flex items-baseline justify-between gap-6 py-4">
                <div>
                  <p className="font-semibold">{service.name}</p>
                  {service.description ? (
                    <p className="mt-0.5 text-sm text-ink-400">{service.description}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-copper-300">
                    <Money cents={service.price_cents} />
                  </p>
                  <p className="text-xs text-ink-400">{service.duration_min} min</p>
                </div>
              </li>
            ))}
          </ul>

          {services.length === 0 ? (
            <p className="text-ink-400">
              Todavia no hay servicios cargados. Agregalos desde el panel.
            </p>
          ) : null}
        </div>
      </section>

      {/* ---- Horario y equipo ---- */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Horario</h2>
            <ul className="mt-5 space-y-2 text-sm">
              {WEEKDAY_NAMES.map((label, weekday) => {
                const windows = general.filter((h) => h.weekday === weekday);
                return (
                  <li key={label} className="flex justify-between gap-4 text-ink-300">
                    <span>{label}</span>
                    <span className={windows.length === 0 ? 'text-ink-400' : ''}>
                      {windows.length === 0
                        ? 'Cerrado'
                        : windows
                            .map((w) => `${w.open_time.slice(0, 5)}–${w.close_time.slice(0, 5)}`)
                            .join(' · ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Quien te atiende</h2>
            <ul className="mt-5 space-y-4">
              {staff.map((member) => (
                <li key={member.id}>
                  <p className="font-semibold">{member.name}</p>
                  {member.bio ? <p className="text-sm text-ink-400">{member.bio}</p> : null}
                </li>
              ))}
            </ul>

            {settings.address ? (
              <>
                <h3 className="mt-8 font-semibold">Donde estamos</h3>
                <p className="mt-1 text-sm text-ink-300">{settings.address}</p>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-400">
          <span>
            © {new Date().getFullYear()} {settings.business_name}
          </span>
          <Link href="/admin" className="hover:text-ink-100">
            Entrar al panel
          </Link>
        </div>
      </footer>
    </main>
  );
}
