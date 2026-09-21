'use client';

import { useState } from 'react';

/**
 * Bloque que se abre y se cierra. Se usa para los formularios de edicion:
 * en el mostrador lo normal es leer la lista, no editarla, asi que los
 * campos empiezan guardados.
 */
export default function Collapsible({
  label,
  openLabel,
  children,
  defaultOpen = false,
}: {
  label: string;
  openLabel?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-sm font-semibold text-copper-300 hover:text-copper-400"
      >
        {open ? (openLabel ?? 'Cerrar') : label}
      </button>

      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
