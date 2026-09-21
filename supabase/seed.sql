-- ============================================================================
-- AxelCuts — datos iniciales. Correr DESPUES de schema.sql.
-- Ajusta nombres, precios y horarios a la realidad de la barberia.
-- ============================================================================

update settings set
  business_name = 'AxelCuts',
  timezone      = 'America/Mexico_City',
  phone         = '+525639317160',
  loyalty_goal  = 8,
  loyalty_reward = 'Corte gratis',
  updated_at    = now()
where id = 1;

insert into services (name, description, duration_min, price_cents, sort_order)
select * from (values
  ('Corte de cabello',  'Corte completo con lavado y peinado.',        45, 20000, 1),
  ('Corte + barba',     'Corte completo y perfilado de barba.',        60, 30000, 2),
  ('Barba',             'Perfilado, navaja y toalla caliente.',        30, 15000, 3),
  ('Corte de nino',     'Para menores de 12 anos.',                    30, 15000, 4)
) as v(name, description, duration_min, price_cents, sort_order)
where not exists (select 1 from services);

insert into staff (name, bio, sort_order)
select * from (values
  ('Axel', 'Fundador de AxelCuts.', 1)
) as v(name, bio, sort_order)
where not exists (select 1 from staff);

-- Horario general del negocio: martes a sabado 10:00-20:00, domingo 11:00-16:00.
insert into business_hours (staff_id, weekday, open_time, close_time)
select null, v.weekday, v.open_time::time, v.close_time::time from (values
  (2, '10:00', '20:00'),
  (3, '10:00', '20:00'),
  (4, '10:00', '20:00'),
  (5, '10:00', '20:00'),
  (6, '10:00', '20:00'),
  (0, '11:00', '16:00')
) as v(weekday, open_time, close_time)
where not exists (select 1 from business_hours);
