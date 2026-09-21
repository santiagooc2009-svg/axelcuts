'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'axelcuts:install-dismissed';

/**
 * "Ponlo en tu pantalla principal".
 *
 * En Android/Chrome el navegador avisa con `beforeinstallprompt` y podemos
 * abrir el dialogo nativo. En iOS no existe ese evento: ahi lo unico que se
 * puede hacer es explicar el gesto (Compartir → Agregar a inicio), asi que
 * se muestra esa instruccion en vez de un boton que no haria nada.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Ya instalada: no hay nada que ofrecer.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (standalone) return;

    try {
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      // Modo privado sin storage: se muestra igual, no es grave.
    }

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos) {
      setShowIosHint(true);
      setHidden(false);
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
      setHidden(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* sin storage, vuelve a aparecer la proxima vez */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setDeferred(null);
  }

  if (hidden) return null;

  return (
    <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="font-semibold">Ten la agenda siempre a la mano</p>
        <p className="mt-0.5 text-sm text-ink-400">
          {showIosHint
            ? 'Toca Compartir y luego "Agregar a inicio" para dejarla en tu pantalla principal.'
            : 'Instalala en la pantalla principal y abrela como una app.'}
        </p>
      </div>

      <div className="flex gap-2">
        {deferred ? <Button onClick={install}>Instalar</Button> : null}
        <Button variant="ghost" onClick={dismiss}>
          Ahora no
        </Button>
      </div>
    </div>
  );
}
