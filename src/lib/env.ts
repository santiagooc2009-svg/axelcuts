/**
 * Lectura de variables de entorno. Se falla ruidosamente al arrancar y no a
 * media reserva: una URL de Supabase mal puesta debe reventar en el deploy.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa .env.example y el panel de Vercel.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  /** Solo servidor. Salta RLS: nunca debe llegar al navegador. */
  get supabaseServiceKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get siteUrl() {
    const raw =
      optional('NEXT_PUBLIC_SITE_URL') ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
      'http://localhost:3000';
    return raw.replace(/\/$/, '');
  },
  get cronSecret() {
    return optional('CRON_SECRET');
  },
  // --- Web Push (VAPID) -----------------------------------------------------
  get vapidPublicKey() {
    return optional('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
  },
  get vapidPrivateKey() {
    return optional('VAPID_PRIVATE_KEY');
  },
  get vapidSubject() {
    return optional('VAPID_SUBJECT') ?? 'mailto:hola@axelcuts.mx';
  },
  // --- WhatsApp -------------------------------------------------------------
  /** 'wa_link' (manual, sin tramites) o 'cloud_api' (automatico, Meta). */
  get whatsappProvider(): 'wa_link' | 'cloud_api' {
    return optional('WHATSAPP_PROVIDER') === 'cloud_api' ? 'cloud_api' : 'wa_link';
  },
  get whatsappToken() {
    return optional('WHATSAPP_TOKEN');
  },
  get whatsappPhoneNumberId() {
    return optional('WHATSAPP_PHONE_NUMBER_ID');
  },
  get whatsappApiVersion() {
    return optional('WHATSAPP_API_VERSION') ?? 'v21.0';
  },
};

export const pushEnabled = () =>
  Boolean(env.vapidPublicKey && env.vapidPrivateKey);
