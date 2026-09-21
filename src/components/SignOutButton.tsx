'use client';

import { useRouter } from 'next/navigation';

import { supabaseBrowser } from '@/lib/supabase/browser';

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.refresh();
    router.push('/admin/login');
  }

  return (
    <button
      onClick={signOut}
      className="shrink-0 text-sm text-ink-400 hover:text-ink-100"
    >
      Salir
    </button>
  );
}
