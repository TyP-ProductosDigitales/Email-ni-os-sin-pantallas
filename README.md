# Sistema de Email Marketing — Reto 21 Días / Método Calma

Proyecto Next.js (App Router) que captura leads de la landing, los guarda en Supabase
y envía guía + 2 seguimientos automáticos vía Brevo, con un Cron de Vercel.

## Estructura

```
app/
  page.tsx                              landing de prueba con el formulario
  api/send-email/route.ts               POST captura+envía guía · GET dashboard de métricas
  api/cron/send-followups/route.ts      cron diario: seguimiento día 3 y día 7
components/
  FormularioCaptura.tsx                 formulario (nombre + email)
supabase-schema.sql                     tabla `contactos` + RLS
vercel.json                             config del cron (9 AM UTC)
```

## Configuración (5 minutos)

1. **Brevo** (https://www.brevo.com) — Configuración → SMTP y API → copia la API Key.
2. **Supabase** (https://supabase.com) — crea proyecto, abre SQL Editor, pega y ejecuta
   `supabase-schema.sql`. Luego copia `Project URL` y `anon public key` desde Settings → API.
3. Copia `.env.local.example` a `.env.local` y rellena las 4 variables (incluye un
   `CRON_SECRET` inventado por ti, cualquier string aleatorio).
4. Instala dependencias y corre en local:
   ```bash
   npm install
   npm run dev
   ```
   Abre http://localhost:3000

## Deploy en Vercel

1. Sube este proyecto a un repo de GitHub y conéctalo en Vercel.
2. En Vercel → Settings → Environment Variables agrega las mismas variables de `.env.local`.
3. Vercel detecta `vercel.json` automáticamente y activa el Cron diario.

## Integración con la landing de Lovable

La landing real vive en `https://metodo-calma.lovable.app` (otro dominio/proyecto). Este
repo solo aloja el backend (API + cron). Para conectar el formulario de Lovable a este API:

1. Despliega este proyecto en Vercel y copia su URL (ej. `https://email-nios-sin-pantallas.vercel.app`).
2. En Vercel, define `ALLOWED_ORIGIN=https://metodo-calma.lovable.app` (ya está en CORS).
3. En el código del formulario dentro de Lovable, apunta el `fetch` a:
   `https://TU-PROYECTO.vercel.app/api/send-email` (método POST, body `{ nombre, email }`).
4. Si el formulario de Lovable ya existe, solo hace falta cambiar la URL del fetch — no
   necesitas mover `FormularioCaptura.tsx` a Lovable a menos que quieras reemplazar el
   formulario actual por este componente.

## Notas

- Brevo gratis: 300 emails/día.
- El remitente está fijo en `soporte.productosdigitales.0@gmail.com` (línea `SENDER_EMAIL`
  en ambos `route.ts`) — cámbialo si usas otro correo verificado en Brevo.
- Dashboard de métricas: `GET /api/send-email` devuelve total de contactos y envíos.
