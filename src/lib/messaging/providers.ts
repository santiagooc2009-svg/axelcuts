import 'server-only';

import { env } from '@/lib/env';
import { toWhatsappNumber } from '@/lib/phone';

export type SendResult = {
  /**
   * 'sent'  — salio de verdad por la API.
   * 'ready' — el mensaje quedo listo con su link; falta que alguien lo mande.
   * 'failed'— el proveedor lo rechazo.
   */
  status: 'sent' | 'ready' | 'failed';
  provider: string;
  waLink?: string;
  error?: string;
};

export interface WhatsappProvider {
  readonly name: string;
  readonly automatic: boolean;
  send(to: string, body: string): Promise<SendResult>;
}

/**
 * Modo sin tramites: no manda nada solo, arma el link `wa.me` con el mensaje
 * ya escrito para que el dueno lo dispare de un toque desde el panel.
 *
 * Es el modo por omision a proposito: no requiere cuenta de Meta Business,
 * no cuesta por conversacion y no hay riesgo de que suspendan el numero por
 * mandar plantillas no aprobadas.
 */
export const waLinkProvider: WhatsappProvider = {
  name: 'wa_link',
  automatic: false,
  async send(to, body) {
    const number = toWhatsappNumber(to);
    if (!number) {
      return { status: 'failed', provider: 'wa_link', error: 'Telefono invalido' };
    }
    return {
      status: 'ready',
      provider: 'wa_link',
      waLink: `https://wa.me/${number}?text=${encodeURIComponent(body)}`,
    };
  },
};

/**
 * Modo automatico con la Cloud API de Meta.
 *
 * Ojo con la regla de Meta: fuera de la ventana de 24 h desde el ultimo
 * mensaje del cliente, solo pasan PLANTILLAS APROBADAS. Un recordatorio de
 * 24 h casi siempre cae fuera de esa ventana, asi que para ese caso hay que
 * registrar la plantilla en Meta y ponerla en WHATSAPP_TEMPLATE_REMINDER.
 * Cuando no hay plantilla configurada se intenta texto libre y, si Meta lo
 * rechaza, el mensaje cae a 'failed' con el motivo — no se pierde: queda en
 * la bandeja con su link para mandarlo a mano.
 */
export const cloudApiProvider: WhatsappProvider = {
  name: 'cloud_api',
  automatic: true,
  async send(to, body) {
    const token = env.whatsappToken;
    const phoneId = env.whatsappPhoneNumberId;

    if (!token || !phoneId) {
      return {
        status: 'failed',
        provider: 'cloud_api',
        error: 'Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID',
      };
    }

    const number = toWhatsappNumber(to);
    const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${phoneId}/messages`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: number,
          type: 'text',
          text: { preview_url: false, body },
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        return {
          status: 'failed',
          provider: 'cloud_api',
          error: `Meta respondio ${res.status}: ${detail.slice(0, 400)}`,
          waLink: `https://wa.me/${number}?text=${encodeURIComponent(body)}`,
        };
      }

      return { status: 'sent', provider: 'cloud_api' };
    } catch (cause) {
      return {
        status: 'failed',
        provider: 'cloud_api',
        error: cause instanceof Error ? cause.message : 'Error de red',
        waLink: `https://wa.me/${number}?text=${encodeURIComponent(body)}`,
      };
    }
  },
};

export function activeProvider(): WhatsappProvider {
  return env.whatsappProvider === 'cloud_api' ? cloudApiProvider : waLinkProvider;
}
