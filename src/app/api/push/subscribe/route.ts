import { NextResponse } from 'next/server';
import { z } from 'zod';

import { pushEnabled } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  role: z.enum(['admin', 'customer']).default('customer'),
  loyaltyCode: z.string().trim().max(12).optional(),
});

export async function POST(request: Request) {
  if (!pushEnabled()) {
    return NextResponse.json(
      { error: 'Las notificaciones no estan configuradas (faltan llaves VAPID).' },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Suscripcion invalida' }, { status: 400 });
  }

  const { endpoint, keys, role, loyaltyCode } = parsed.data;

  // Nadie se registra como 'admin' sin una sesion de admin de verdad.
  if (role === 'admin' && !(await currentAdmin())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let customerId: string | null = null;
  if (role === 'customer' && loyaltyCode) {
    const { data } = await supabaseAdmin()
      .from('customers')
      .select('id')
      .eq('loyalty_code', loyaltyCode.toUpperCase())
      .maybeSingle();
    customerId = (data?.id as string | undefined) ?? null;
  }

  const { error } = await supabaseAdmin().from('push_subscriptions').upsert(
    {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      role,
      customer_id: customerId,
      user_agent: request.headers.get('user-agent'),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role, linked: Boolean(customerId) });
}

export async function DELETE(request: Request) {
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 });

  await supabaseAdmin().from('push_subscriptions').delete().eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
