'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui';

/**
 * Alta de notificaciones push (Web Push / VAPID).
 *
 * Reglas que respeta a proposito:
 *  - Solo pide permiso tras un toque explicito. Pedirlo al cargar es la via
 *    rapida a que el navegador bloquee el origen para siempre.
 *  - Si el navegador no soporta push (Safari sin instalar la app, por
 *    ejemplo), no pinta nada en vez de ofrecer algo que va a fallar.
 */
export default function PushToggle({
  role,
  loyaltyCode,
}: {
  role: 'admin' | 'customer';
  loyaltyCode?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<'idle' | 'working' | 'on' | 'blocked' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setSupported(ok);
    if (!ok) return;

    if (Notification.permission === 'denied') setState('blocked');

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setState('on');
      })
      .catch(() => {
        /* sin registro previo: se queda en idle */
      });
  }, []);

  async function enable() {
    setState('working');
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'idle');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setState('error');
        setMessage('Las notificaciones no estan configuradas todavia.');
        return;
      }

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const raw = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: raw.endpoint,
          keys: raw.keys,
          role,
          loyaltyCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setState('error');
        setMessage(data.error ?? 'No pudimos activar las notificaciones.');
        return;
      }

      setState('on');
    } catch (cause) {
      setState('error');
      setMessage(cause instanceof Error ? cause.message : 'No pudimos activarlas.');
    }
  }

  if (!supported) return null;

  if (state === 'on') {
    return (
      <p className="text-center text-sm text-ink-400">
        Notificaciones activadas en este dispositivo.
      </p>
    );
  }

  if (state === 'blocked') {
    return (
      <p className="text-center text-sm text-ink-400">
        Bloqueaste las notificaciones para este sitio. Se activan desde los ajustes
        del navegador.
      </p>
    );
  }

  return (
    <div className="text-center">
      <Button variant="secondary" onClick={enable} disabled={state === 'working'} className="w-full">
        {state === 'working' ? 'Activando…' : 'Avisarme de mis citas'}
      </Button>
      {message ? <p className="mt-2 text-sm text-danger-500">{message}</p> : null}
    </div>
  );
}

/**
 * La llave VAPID viaja en base64url y `subscribe` pide bytes. El buffer se
 * crea explicito para que el tipo sea Uint8Array<ArrayBuffer>, que es lo que
 * exige `applicationServerKey`.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
