'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';

/**
 * Cancelar es irreversible, asi que va en dos pasos: el primer toque pide
 * confirmacion explicita. Nadie pierde su lugar por un dedazo.
 */
export default function CancelButton({ code }: { code: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setWorking(true);
    setError(null);

    try {
      const res = await fetch(`/api/bookings/${code}/cancel`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'No pudimos cancelar la cita.');
        setWorking(false);
        return;
      }

      router.refresh();
    } catch {
      setError('No pudimos cancelar la cita. Revisa tu conexion.');
      setWorking(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Cancelar mi cita
        </Button>
        {error ? <p className="mt-2 text-sm text-danger-500">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="text-sm text-ink-300">
        ¿Seguro que quieres cancelar? El horario se libera para alguien mas.
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="danger" onClick={cancel} disabled={working}>
          {working ? 'Cancelando…' : 'Si, cancelar'}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={working}>
          Mejor no
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-danger-500">{error}</p> : null}
    </div>
  );
}
