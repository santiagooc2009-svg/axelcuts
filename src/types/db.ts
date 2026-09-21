/** Formas de las tablas de Supabase, escritas a mano (sin codegen). */

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type Settings = {
  id: number;
  business_name: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  slot_minutes: number;
  min_lead_minutes: number;
  max_horizon_days: number;
  cancel_window_hours: number;
  auto_confirm: boolean;
  loyalty_goal: number;
  loyalty_reward: string;
  reminder_hours: number[];
  updated_at: string;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type Staff = {
  id: string;
  name: string;
  bio: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type BusinessHour = {
  id: string;
  staff_id: string | null;
  weekday: number;
  open_time: string;
  close_time: string;
};

export type TimeOff = {
  id: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
};

export type Customer = {
  id: string;
  phone: string;
  name: string;
  loyalty_code: string;
  stamps: number;
  rewards_redeemed: number;
  visits: number;
  whatsapp_opt_in: boolean;
  notes: string | null;
  created_at: string;
  last_visit_at: string | null;
};

export type Appointment = {
  id: string;
  code: string;
  customer_id: string;
  service_id: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  notes: string | null;
  source: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
};

export type LoyaltyEvent = {
  id: string;
  customer_id: string;
  appointment_id: string | null;
  type: 'stamp' | 'redeem' | 'adjust';
  delta: number;
  balance_after: number;
  note: string | null;
  created_at: string;
};

export type OutboxMessage = {
  id: string;
  customer_id: string | null;
  appointment_id: string | null;
  kind: string;
  channel: string;
  to_phone: string;
  body: string;
  status: 'queued' | 'ready' | 'sent' | 'failed' | 'skipped';
  provider: string | null;
  wa_link: string | null;
  scheduled_for: string;
  sent_at: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  role: 'admin' | 'customer';
  customer_id: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
};

/** Cita con servicio, barbero y cliente ya resueltos (lo que pinta la UI). */
export type AppointmentDetail = Appointment & {
  service: Pick<Service, 'id' | 'name' | 'duration_min' | 'price_cents'> | null;
  staff: Pick<Staff, 'id' | 'name'> | null;
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'loyalty_code' | 'stamps'> | null;
};
