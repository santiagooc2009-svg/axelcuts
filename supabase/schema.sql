-- ============================================================================
-- AxelCuts — esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en Supabase Studio → SQL Editor.
-- Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Ajustes del negocio (fila unica, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id                   smallint primary key default 1 check (id = 1),
  business_name        text        not null default 'AxelCuts',
  timezone             text        not null default 'America/Mexico_City',
  phone                text,                        -- numero del negocio, E.164
  address              text,
  slot_minutes         smallint    not null default 15 check (slot_minutes between 5 and 60),
  min_lead_minutes     integer     not null default 60,   -- anticipacion minima para reservar
  max_horizon_days     smallint    not null default 30,   -- que tan lejos se puede reservar
  cancel_window_hours  smallint    not null default 3,    -- hasta cuando puede cancelar el cliente
  auto_confirm         boolean     not null default true, -- reservar deja la cita ya confirmada
  loyalty_goal         smallint    not null default 8 check (loyalty_goal > 0),
  loyalty_reward       text        not null default 'Corte gratis',
  reminder_hours       smallint[]  not null default '{24,2}',
  updated_at           timestamptz not null default now()
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Servicios (corte, barba, etc.)
-- ---------------------------------------------------------------------------
create table if not exists services (
  id           uuid primary key default gen_random_uuid(),
  name         text     not null,
  description  text,
  duration_min smallint not null check (duration_min between 5 and 480),
  price_cents  integer  not null default 0 check (price_cents >= 0),
  active       boolean  not null default true,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists services_active_idx on services (active, sort_order);

-- ---------------------------------------------------------------------------
-- Barberos
-- ---------------------------------------------------------------------------
create table if not exists staff (
  id         uuid primary key default gen_random_uuid(),
  name       text    not null,
  bio        text,
  active     boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Que servicios puede dar cada barbero. Si un servicio no tiene ninguna fila
-- aqui, se asume que cualquier barbero activo lo puede dar.
create table if not exists staff_services (
  staff_id   uuid not null references staff (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  primary key (staff_id, service_id)
);

-- ---------------------------------------------------------------------------
-- Horario semanal. weekday: 0 = domingo ... 6 = sabado.
-- Varias filas por dia permiten partir el horario (ej. cerrar a comer).
-- staff_id null = horario general del negocio.
-- ---------------------------------------------------------------------------
create table if not exists business_hours (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid references staff (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  open_time  time     not null,
  close_time time     not null,
  constraint business_hours_order check (close_time > open_time)
);

create index if not exists business_hours_weekday_idx on business_hours (weekday);

-- ---------------------------------------------------------------------------
-- Bloqueos: vacaciones, dias festivos, huecos personales.
-- staff_id null = cierra para todo el negocio.
-- ---------------------------------------------------------------------------
create table if not exists time_off (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid references staff (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint time_off_order check (ends_at > starts_at)
);

create index if not exists time_off_range_idx on time_off (starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- Clientes. El telefono en E.164 es la identidad (es como les llega WhatsApp).
-- loyalty_code es el codigo publico de su tarjeta de fidelidad.
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id               uuid primary key default gen_random_uuid(),
  phone            text unique not null,
  name             text not null,
  loyalty_code     text unique not null,
  stamps           smallint not null default 0 check (stamps >= 0),
  rewards_redeemed integer  not null default 0,
  visits           integer  not null default 0,
  whatsapp_opt_in  boolean  not null default true,
  notes            text,
  created_at       timestamptz not null default now(),
  last_visit_at    timestamptz
);

create index if not exists customers_loyalty_code_idx on customers (loyalty_code);

-- ---------------------------------------------------------------------------
-- Citas. `code` es el identificador publico corto (link de la cita).
-- ---------------------------------------------------------------------------
do $$ begin
  create type appointment_status as enum
    ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

create table if not exists appointments (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  customer_id  uuid not null references customers (id) on delete cascade,
  service_id   uuid not null references services (id) on delete restrict,
  staff_id     uuid references staff (id) on delete set null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       appointment_status not null default 'confirmed',
  price_cents  integer not null default 0,
  notes        text,
  source       text not null default 'web',
  cancelled_at timestamptz,
  cancelled_by text,
  created_at   timestamptz not null default now(),
  constraint appointments_order check (ends_at > starts_at)
);

create index if not exists appointments_starts_at_idx on appointments (starts_at);
create index if not exists appointments_staff_window_idx on appointments (staff_id, starts_at, ends_at);
create index if not exists appointments_customer_idx on appointments (customer_id, starts_at desc);

-- Nada de dos citas encima del mismo barbero. El indice solo mira las citas
-- vivas; las canceladas liberan el hueco.
do $$ begin
  alter table appointments
    add constraint appointments_no_overlap
    exclude using gist (
      staff_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status in ('pending', 'confirmed') and staff_id is not null);
exception
  when duplicate_object then null
  when undefined_object then
    -- btree_gist no disponible: se crea abajo y se reintenta.
    null;
end $$;

create extension if not exists btree_gist;

do $$ begin
  alter table appointments
    add constraint appointments_no_overlap
    exclude using gist (
      staff_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status in ('pending', 'confirmed') and staff_id is not null);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Movimientos de la tarjeta de fidelidad (historial audit-friendly).
-- ---------------------------------------------------------------------------
do $$ begin
  create type loyalty_event_type as enum ('stamp', 'redeem', 'adjust');
exception when duplicate_object then null; end $$;

create table if not exists loyalty_events (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  type           loyalty_event_type not null,
  delta          smallint not null,
  balance_after  smallint not null,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists loyalty_events_customer_idx on loyalty_events (customer_id, created_at desc);

-- Un sello por cita, no dos.
create unique index if not exists loyalty_events_one_stamp_per_appointment
  on loyalty_events (appointment_id)
  where type = 'stamp' and appointment_id is not null;

-- ---------------------------------------------------------------------------
-- Bandeja de salida de mensajes: confirmaciones y recordatorios de WhatsApp.
-- El cron la recorre; cada renglon sabe cuando debe salir y por donde.
-- ---------------------------------------------------------------------------
do $$ begin
  create type message_status as enum ('queued', 'ready', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

create table if not exists message_outbox (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references customers (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete cascade,
  kind           text not null,          -- booking_confirmed | reminder_24h | ...
  channel        text not null default 'whatsapp',
  to_phone       text not null,
  body           text not null,
  status         message_status not null default 'queued',
  provider       text,                   -- wa_link | cloud_api
  wa_link        text,                   -- link listo para el modo manual
  scheduled_for  timestamptz not null default now(),
  sent_at        timestamptz,
  attempts       smallint not null default 0,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists message_outbox_due_idx
  on message_outbox (status, scheduled_for);

-- No repetir el mismo aviso para la misma cita.
create unique index if not exists message_outbox_unique_kind
  on message_outbox (appointment_id, kind)
  where appointment_id is not null;

-- ---------------------------------------------------------------------------
-- Suscripciones de notificaciones push (Web Push / VAPID).
-- role 'admin' = el telefono del barbero; 'customer' = el del cliente.
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  role        text not null default 'customer' check (role in ('admin', 'customer')),
  customer_id uuid references customers (id) on delete cascade,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_role_idx on push_subscriptions (role);

-- ---------------------------------------------------------------------------
-- RLS: todo cerrado. La app entra solo con la service-role key desde el
-- servidor, nunca desde el navegador. Sin politicas publicas, la anon key no
-- puede leer telefonos de clientes aunque se filtre.
-- ---------------------------------------------------------------------------
alter table settings            enable row level security;
alter table services            enable row level security;
alter table staff               enable row level security;
alter table staff_services      enable row level security;
alter table business_hours      enable row level security;
alter table time_off            enable row level security;
alter table customers           enable row level security;
alter table appointments        enable row level security;
alter table loyalty_events      enable row level security;
alter table message_outbox      enable row level security;
alter table push_subscriptions  enable row level security;
