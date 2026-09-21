import ActionButton from '@/components/ActionButton';
import { markSentAction } from '@/app/admin/actions';
import { messagingMode, pendingManualMessages } from '@/lib/messaging/outbox';
import { KIND_LABELS, type MessageKind } from '@/lib/messaging/templates';
import { getSettings } from '@/lib/data';
import { formatPhone, toWhatsappNumber } from '@/lib/phone';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Mensajes' };

export default async function MensajesPage() {
  const [messages, settings] = await Promise.all([
    pendingManualMessages(),
    getSettings(),
  ]);

  const mode = messagingMode();

  return (
    <>
      <h1 className="text-2xl font-bold">Mensajes</h1>

      <div className="card mt-4 p-4 text-sm">
        {mode.automatic ? (
          <p className="text-ink-300">
            Modo <strong className="text-ink-100">automatico</strong>: los mensajes
            salen solos por la API de WhatsApp. Aqui solo aparecen los que
            fallaron, para mandarlos a mano.
          </p>
        ) : (
          <p className="text-ink-300">
            Modo <strong className="text-ink-100">manual</strong>: el sistema
            escribe cada mensaje y tu lo mandas de un toque. No cuesta nada ni
            necesita permisos de Meta. Cuando quieras que salgan solos, se
            configura la API y esta lista se vacia.
          </p>
        )}
      </div>

      <section className="mt-6 space-y-3">
        {messages.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-semibold">No hay mensajes pendientes</p>
            <p className="mt-1 text-sm text-ink-400">
              Las confirmaciones y recordatorios aparecen aqui en cuanto toca
              mandarlos.
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          const link =
            message.wa_link ??
            `https://wa.me/${toWhatsappNumber(message.to_phone)}?text=${encodeURIComponent(
              message.body,
            )}`;

          return (
            <article key={message.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {KIND_LABELS[message.kind as MessageKind] ?? message.kind}
                  </p>
                  <p className="text-sm text-ink-400">
                    {formatPhone(message.to_phone)} ·{' '}
                    {formatDateTime(message.scheduled_for, settings.timezone)}
                  </p>
                </div>

                {message.status === 'failed' ? (
                  <span className="rounded-full bg-danger-500/15 px-2.5 py-1 text-xs font-semibold text-danger-500">
                    Fallo el envio
                  </span>
                ) : null}
              </div>

              <pre className="mt-3 rounded-lg bg-ink-850 px-3 py-3 text-sm whitespace-pre-wrap text-ink-300">
                {message.body}
              </pre>

              {message.error ? (
                <p className="mt-2 text-xs text-danger-500">{message.error}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-800 pt-4">
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-copper-500 px-4 py-1.5 text-sm font-semibold text-ink-950 hover:bg-copper-400"
                >
                  Abrir en WhatsApp
                </a>
                <ActionButton
                  variant="ghost"
                  label="Ya lo mande"
                  action={markSentAction.bind(null, message.id)}
                />
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
