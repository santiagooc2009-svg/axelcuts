import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm ' +
  'font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS = {
  primary: 'bg-copper-500 text-ink-950 hover:bg-copper-400',
  secondary: 'border border-ink-700 bg-ink-850 text-ink-100 hover:border-ink-600',
  ghost: 'text-ink-300 hover:text-ink-100',
  danger: 'border border-danger-500/40 text-danger-500 hover:bg-danger-500/10',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-6 ${className}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-300">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-danger-500">{error}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-ink-700 bg-ink-850 px-4 py-3 text-base ' +
  'text-ink-100 placeholder:text-ink-400 focus:border-copper-400 focus:outline-none';

export function Money({ cents }: { cents: number }) {
  return <>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(cents / 100)}</>;
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-success-500/15 text-success-500',
    pending: 'bg-copper-500/15 text-copper-300',
    completed: 'bg-ink-700 text-ink-300',
    cancelled: 'bg-danger-500/15 text-danger-500',
    no_show: 'bg-danger-500/15 text-danger-500',
  };
  const labels: Record<string, string> = {
    confirmed: 'Confirmada',
    pending: 'Por confirmar',
    completed: 'Atendida',
    cancelled: 'Cancelada',
    no_show: 'No llego',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] ?? 'bg-ink-700 text-ink-300'
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
