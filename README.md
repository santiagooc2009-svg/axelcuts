# AxelCuts — agenda de la peluqueria

App para el dia a dia del mostrador: **agenda**, **tarjetas de fidelidad
digitales** y **avisos por WhatsApp**, instalable en la pantalla principal
del telefono.

Hecha con Next.js (App Router) + Supabase, para desplegar en Vercel.

---

## Que hace

**1. Agenda (el panel del dueño / recepcionista)** — `/admin`

- Las citas del dia, ordenadas por hora, con telefono a un toque de WhatsApp.
- Tres botones por cita: *ya se atendio* (cierra y sella la tarjeta), *no
  llego* y *cancelar*.
- Alta de citas desde el mostrador para quien llama o llega sin reservar.
- Navegacion por dia y total cobrado del dia.

**2. Tarjetas de fidelidad digitales** — `/admin/clientes`

- Alta con solo **nombre y telefono**; sale el link de la tarjeta y un boton
  para mandarselo por WhatsApp.
- Se pueden cargar sellos de arranque si el cliente ya venia juntando en papel.
- El cliente abre su link y ve sus sellos; tambien puede dejarlo en su
  pantalla principal.
- El sello se pone solo al cerrar una cita, o a mano desde el panel.
- Al completar la tarjeta, el cliente recibe el aviso y el panel muestra el
  boton de canjear.

**3. Avisos por WhatsApp**

- Confirmacion al reservar y recordatorios (24 h y 2 h antes, configurable).
- Aviso de sello y de premio disponible.
- Dos modos, se cambia con una variable de entorno:
  - **`wa_link` (por omision)** — el sistema escribe cada mensaje y queda en
    `/admin/mensajes` con un boton "Abrir en WhatsApp". Sin costo y sin
    tramites con Meta.
  - **`cloud_api`** — envio automatico con la API de Meta. Requiere cuenta de
    WhatsApp Business, numero verificado y plantillas aprobadas.

**4. Instalable en la pantalla principal**

- PWA con manifiesto e iconos. En Android aparece el boton *Instalar*; en
  iPhone se explica el gesto (Compartir → Agregar a inicio).
- Atajos directos a *Agenda de hoy*, *Nueva cita* y *Nueva tarjeta*.
- Notificaciones push: al dueño cuando alguien reserva o cancela, y al
  cliente antes de su cita.

**Extra: pagina publica de reservas** — `/` y `/reservar`

Por si quieres que la gente aparte sola desde Instagram o el link de la
tarjeta. Si no la usas, no estorba: el panel funciona igual.

---

## Puesta en marcha

### 1. Base de datos (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratis
   alcanza de sobra).
2. **SQL Editor** → pega y corre `supabase/schema.sql` completo.
3. Corre `supabase/seed.sql` para dejar servicios, barbero y horario de
   ejemplo. Ajusta nombres y precios ahi mismo o despues en las tablas.
4. **Authentication → Users → Add user**: crea el usuario con el que vas a
   entrar al panel (correo y contrasena). Marca el correo como confirmado.
5. **Project Settings → API**: de ahi salen las tres llaves del siguiente paso.

> Las tablas tienen RLS activado y **ninguna politica publica**. Toda la app
> lee y escribe desde el servidor con la `service_role`, asi que la llave
> `anon` que viaja al navegador no puede sacar telefonos de clientes.

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y llena:

| Variable | De donde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (**secreta**) |
| `NEXT_PUBLIC_SITE_URL` | la URL publica; con esto se arman los links de los WhatsApp |
| `CRON_SECRET` | invéntate una cadena larga al azar |

Para las notificaciones push:

```bash
npm run gen:vapid
```

y pega las tres lineas que imprime.

### 3. Local

```bash
npm install
npm run dev     # http://localhost:3000
npm run check   # verifica telefonos, zona horaria y calculo de huecos
```

### 4. Deploy en Vercel

1. **Add New → Project** e importa este repositorio. Vercel detecta Next.js
   solo; no hay que tocar la configuracion de build.
2. En **Environment Variables**, pega las mismas del paso 2. `NEXT_PUBLIC_SITE_URL`
   debe ser la URL final (`https://tu-proyecto.vercel.app` o tu dominio).
3. Deploy.
4. El cron de `vercel.json` queda activo solo: llama a
   `/api/cron/dispatch` cada 15 minutos para sacar los WhatsApp que tocan y
   los push de "tu cita es en 2 horas".

> Si cambias `NEXT_PUBLIC_SITE_URL` despues, hay que volver a desplegar: esa
> variable se hornea en el build.

Entra a `/admin`, inicia sesion con el usuario que creaste, y el telefono te
va a ofrecer instalar la app.

---

## Como esta armado

```
src/
├── app/
│   ├── page.tsx              portada publica
│   ├── reservar/             flujo de reserva del cliente
│   ├── cita/[code]/          detalle de una cita (ver y cancelar)
│   ├── tarjeta/[code]/       tarjeta de fidelidad del cliente
│   ├── admin/                el panel (protegido por middleware)
│   │   ├── page.tsx          agenda del dia
│   │   ├── clientes/         lista, sellos y alta de tarjetas
│   │   ├── nueva-cita/       alta desde el mostrador
│   │   ├── mensajes/         bandeja de WhatsApp pendientes
│   │   └── actions.ts        Server Actions (todas revalidan sesion)
│   └── api/
│       ├── availability/     huecos libres de un dia
│       ├── bookings/         crear y cancelar citas
│       ├── cron/dispatch/    motor de la automatizacion
│       └── push/subscribe/   alta de notificaciones
├── lib/
│   ├── slots.ts              calculo puro de huecos (probado en npm run check)
│   ├── availability.ts       lo anterior + base de datos y zona horaria
│   ├── bookings.ts           crear, cancelar, cerrar citas
│   ├── loyalty.ts            sellos, premios y ajustes
│   ├── messaging/            plantillas, adaptadores y bandeja de salida
│   ├── push.ts               Web Push (VAPID)
│   └── time.ts               unico puente entre UTC y la hora del negocio
└── types/db.ts               formas de las tablas
```

### Decisiones que conviene conocer

- **Las horas se guardan en UTC y se muestran en la zona del negocio**
  (`settings.timezone`). Toda conversion pasa por `src/lib/time.ts`.
- **Contra el doble booking hay dos defensas**: el servidor recalcula la
  disponibilidad al confirmar (la pantalla del cliente pudo quedarse abierta
  media hora) y la base tiene una restriccion de exclusion que impide dos
  citas encimadas del mismo barbero aunque lleguen en el mismo segundo.
- **Los mensajes no se mandan en caliente.** Se encolan en `message_outbox`
  con su hora de salida y el cron los procesa. Asi una reserva nunca se cae
  porque WhatsApp tardo, y un recordatorio sobrevive a un reinicio.
- **El sello se pone al cerrar la cita, no al reservarla.** Se premia la
  visita real.
- **El service worker no cachea nada.** Una agenda mostrando huecos viejos es
  peor que una agenda que pide conexion.

### Cambiar cosas del negocio

Por ahora, desde el SQL Editor de Supabase (tabla `settings`):

| Campo | Que hace |
|---|---|
| `slot_minutes` | cada cuanto se ofrecen horarios (15 min por omision) |
| `min_lead_minutes` | anticipacion minima para reservar en linea |
| `max_horizon_days` | que tan lejos se puede reservar |
| `cancel_window_hours` | hasta cuando puede cancelar solo el cliente |
| `loyalty_goal` / `loyalty_reward` | sellos para el premio y cual es |
| `reminder_hours` | cuando salen los recordatorios, ej. `{24,2}` |

Servicios, barberos y horarios se editan en las tablas `services`, `staff` y
`business_hours`. Los cierres por vacaciones o festivos van en `time_off`.

---

## Pendientes conocidos

- Los ajustes, servicios y horarios todavia se editan desde Supabase y no
  desde el panel.
- En modo `cloud_api`, los recordatorios que caen fuera de la ventana de 24 h
  de Meta necesitan una plantilla aprobada; el codigo manda texto libre y, si
  Meta lo rechaza, el mensaje queda en `/admin/mensajes` para mandarlo a mano.
- No hay reagendar: hoy se cancela y se crea de nuevo.
