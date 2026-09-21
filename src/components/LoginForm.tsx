'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Field, inputClass } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginForm({ destino }: { destino: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // No distinguimos "correo no existe" de "contrasena mal": eso le diria
      // a un curioso que ese correo si es de la casa.
      setError('Correo o contrasena incorrectos.');
      setWorking(false);
      return;
    }

    // refresh() hace que el middleware vea la cookie nueva antes de navegar.
    router.refresh();
    router.push(destino.startsWith('/admin') ? destino : '/admin');
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Correo">
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </Field>

      <Field label="Contrasena">
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-danger-500">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={working} className="w-full">
        {working ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
