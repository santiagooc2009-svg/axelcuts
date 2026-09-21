import type { Settings } from '@/types/db';
import { formatDateTime, formatTime } from '@/lib/time';

export type MessageKind =
  | 'booking_confirmed'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'cancelled_by_shop'
  | 'cancelled_by_customer'
  | 'loyalty_stamp'
  | 'loyalty_reward_ready'
  | 'win_back';

export type TemplateContext = {
  settings: Settings;
  customerName: string;
  serviceName?: string;
  staffName?: string | null;
  startsAt?: string;
  appointmentUrl?: string;
  loyaltyUrl?: string;
  stamps?: number;
  goal?: number;
  reward?: string;
};

/** Primer nombre: 'Juan Carlos Perez' → 'Juan'. */
function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/**
 * Los textos viven aqui y no repartidos por el codigo, para que el dueno
 * pueda cambiar el tono en un solo archivo. Nada de emojis de mas: esto lo
 * lee un cliente en la calle.
 */
export function renderMessage(kind: MessageKind, ctx: TemplateContext): string {
  const { settings } = ctx;
  const shop = settings.business_name;
  const name = firstName(ctx.customerName);
  const tz = settings.timezone;
  const when = ctx.startsAt ? formatDateTime(ctx.startsAt, tz) : '';
  const hour = ctx.startsAt ? formatTime(ctx.startsAt, tz) : '';
  const withWho = ctx.staffName ? ` con ${ctx.staffName}` : '';

  switch (kind) {
    case 'booking_confirmed':
      return [
        `Hola ${name}, tu cita en ${shop} quedo confirmada.`,
        '',
        `${ctx.serviceName}${withWho}`,
        when,
        settings.address ? settings.address : null,
        '',
        ctx.appointmentUrl
          ? `Ver o cancelar tu cita: ${ctx.appointmentUrl}`
          : null,
      ]
        .filter((line) => line !== null)
        .join('\n');

    case 'reminder_24h':
      return [
        `Hola ${name}, te recordamos tu cita de manana en ${shop}.`,
        '',
        `${ctx.serviceName}${withWho}`,
        when,
        '',
        ctx.appointmentUrl
          ? `Si ya no puedes, avisanos aqui: ${ctx.appointmentUrl}`
          : null,
      ]
        .filter((line) => line !== null)
        .join('\n');

    case 'reminder_2h':
      return `Hola ${name}, tu cita en ${shop} es hoy a las ${hour}${withWho}. Te esperamos.`;

    case 'cancelled_by_shop':
      return [
        `Hola ${name}, tuvimos que cancelar tu cita del ${when} en ${shop}.`,
        'Una disculpa. Escribenos por aqui y te reagendamos en el horario que te acomode.',
      ].join('\n');

    case 'cancelled_by_customer':
      return [
        `Listo ${name}, cancelamos tu cita del ${when} en ${shop}.`,
        'Cuando quieras agendar otra, aqui estamos.',
      ].join('\n');

    case 'loyalty_stamp': {
      const stamps = ctx.stamps ?? 0;
      const goal = ctx.goal ?? settings.loyalty_goal;
      const left = Math.max(goal - stamps, 0);
      return [
        `Gracias por tu visita, ${name}.`,
        `Llevas ${stamps} de ${goal} sellos en tu tarjeta de ${shop}` +
          (left > 0 ? `: te faltan ${left} para tu ${settings.loyalty_reward.toLowerCase()}.` : '.'),
        ctx.loyaltyUrl ? `\nTu tarjeta: ${ctx.loyaltyUrl}` : null,
      ]
        .filter((line) => line !== null)
        .join('\n');
    }

    case 'loyalty_reward_ready':
      return [
        `${name}, completaste tu tarjeta de ${shop}.`,
        `Tu proxima visita lleva ${ctx.reward ?? settings.loyalty_reward}.`,
        ctx.loyaltyUrl ? `\nMuestra tu tarjeta al llegar: ${ctx.loyaltyUrl}` : null,
      ]
        .filter((line) => line !== null)
        .join('\n');

    case 'win_back':
      return [
        `Hola ${name}, hace rato que no te vemos en ${shop}.`,
        'Si quieres apartar lugar esta semana, respondenos por aqui.',
      ].join('\n');
  }
}

/** Titulo corto para la bandeja del panel. */
export const KIND_LABELS: Record<MessageKind, string> = {
  booking_confirmed: 'Confirmacion de cita',
  reminder_24h: 'Recordatorio 24 h antes',
  reminder_2h: 'Recordatorio 2 h antes',
  cancelled_by_shop: 'Cancelada por la barberia',
  cancelled_by_customer: 'Cancelada por el cliente',
  loyalty_stamp: 'Sello de fidelidad',
  loyalty_reward_ready: 'Premio disponible',
  win_back: 'Cliente ausente',
};
