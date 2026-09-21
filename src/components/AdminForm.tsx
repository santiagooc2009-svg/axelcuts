'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import type { ActionResult } from '@/app/admin/actions';

/**
 * Formulario del panel: envia el FormData a una Server Action y muestra el
 * resultado sin recargar. Si la accion devuelve un link (una tarjeta recien
 * creada), lo pinta con su boton de copiar y de mandar por WhatsApp.
 */
export default function AdminForm({
  action,
  submitLabel,
  children,
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setWorking(true);
    setResult(null);
    setCopied(false);

    try {
      const res = await action(new FormData(form));
      setResult(res);
      if (res.ok) {
        if (resetOnSuccess) form.reset();
        router.refresh();
      }
    } catch {
      setResult({ ok: false, message: 'No se pudo completar. Intenta de nuevo.' });
    } finally {
      setWorking(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {children}

      <Button type="submit" disabled={working}>
        {working ? 'Guardando…' : submitLabel}
      </Button>

      {result?.message ? (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.ok
              ? 'border-success-500/40 bg-success-500/10 text-success-500'
              : 'border-danger-500/40 bg-danger-500/10 text-danger-500'
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {result?.link ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm text-ink-400">Link de la tarjeta</p>
          <p className="font-mono text-sm break-all text-ink-100">{result.link}</p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => copy(result.link as string)}>
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>

            {result.waLink ? (
              <a
                href={result.waLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-copper-500 px-5 py-3 text-sm font-semibold text-ink-950 hover:bg-copper-400"
              >
                Mandar por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </form>
  );
}
