'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, type ButtonVariant } from '@/components/ui';
import type { ActionResult } from '@/app/admin/actions';

/**
 * Boton que dispara una Server Action y muestra el resultado en el lugar.
 * Con `confirm` pide confirmacion antes: lo usan cancelar y canjear, que no
 * se pueden deshacer.
 */
export default function ActionButton({
  action,
  label,
  pendingLabel,
  variant = 'secondary',
  confirm,
  className = '',
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  confirm?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);

  function run() {
    setAsking(false);
    setBusy(true);

    action()
      .then((res) => {
        setResult(res);
        if (res.ok) startTransition(() => router.refresh());
      })
      .catch(() => setResult({ ok: false, message: 'No se pudo completar la accion.' }))
      .finally(() => setBusy(false));
  }

  const working = busy || pending;

  if (asking) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-300">{confirm}</span>
        <Button variant="danger" onClick={run} disabled={working} className="px-3 py-1.5">
          Si
        </Button>
        <Button variant="ghost" onClick={() => setAsking(false)} className="px-3 py-1.5">
          No
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        variant={variant}
        disabled={working}
        onClick={() => (confirm ? setAsking(true) : run())}
        className={`px-3 py-1.5 ${className}`}
      >
        {working ? (pendingLabel ?? 'Un momento…') : label}
      </Button>
      {result?.message ? (
        <span className={`text-xs ${result.ok ? 'text-success-500' : 'text-danger-500'}`}>
          {result.message}
        </span>
      ) : null}
    </span>
  );
}
