// app/api/cron/send-followups/route.ts
// Se ejecuta automáticamente cada día (ver vercel.json)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { plantillaSeguimientoQuiz, URL_LANDING } from '../../../../lib/emails-quiz';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
// soporte.productosdigitales.0@gmail.com nunca quedó verificado como remitente en Brevo
// (Brevo lo rechazaba en silencio). Usamos el remitente ya verificado y dirigimos las
// respuestas del cliente a soporte vía Reply-To.
const SENDER_EMAIL = 'typ.productos.digitales@gmail.com';
const REPLY_TO_EMAIL = 'soporte.productosdigitales.0@gmail.com';
const URL_GUIA = 'https://reto-21-dias-landing.vercel.app/guia-inicial-x9k2mq7.pdf';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const boton = (href: string, texto: string) =>
  `<p style="text-align:center;margin:24px 0"><a href="${href}" style="background:#1a6bff;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold;display:inline-block">${texto} →</a></p>`;

// La base guarda "Cliente" cuando no hay nombre: no lo usamos como saludo.
const saludo = (n: string) => (n && n !== 'Cliente' ? `Hola ${n},` : 'Hola,');

const envoltura = (cuerpo: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.55">
    ${cuerpo}
    <p style="font-size:12px;color:#888">Si no quieres recibir más correos, responde este mensaje con la palabra BAJA. — Equipo Niños Sin Pantallas</p>
  </div>`;

// Secuencia para leads de la landing (guía gratuita). Los del quiz tienen la suya aparte.
// Textos en español neutro, igual que la landing.
const SEGUIMIENTO_LANDING = {
  seguimiento1: {
    asunto: '¿Ya empezaste a aplicar la Guía Inicial?',
    contenido: (nombre: string) => envoltura(`
      <p>${saludo(nombre)} hace unos días te llegó la Guía Inicial «Niños Sin Pantallas» 🎁</p>
      <p>Si todavía no la abriste, es buen momento. Un solo capítulo basta para entender por qué tu hijo reacciona así con las pantallas — y qué hacer distinto hoy mismo.</p>
      ${boton(URL_GUIA, 'Ver la Guía Inicial')}
      <p>Si ya la leíste y quieres el plan completo día a día, el Reto de 21 días te espera aquí:</p>
      ${boton(`${URL_LANDING}?utm_source=email&utm_medium=seguimiento1&utm_campaign=reto21`, 'Ver el Reto de 21 días')}
      <p>— Equipo Niños Sin Pantallas</p>`),
  },
  seguimiento2: {
    asunto: 'El Reto de 21 días, hoy con 90% de descuento',
    contenido: (nombre: string) => envoltura(`
      <p>${saludo(nombre)} la Guía Inicial fue el primer paso. El Reto de 21 días, Método C.A.L.M.A., es el plan completo: día a día, con guiones para los momentos difíciles.</p>
      <p><strong>Hoy incluye:</strong></p>
      <ul>
        <li>Manual de Momentos Difíciles (8 escenarios con guiones)</li>
        <li>50 Actividades Offline por edad</li>
        <li>Guía «Pantallas con Propósito»</li>
        <li>Guía Co-Padres</li>
        <li>30 días de Generador de Actividades offline</li>
      </ul>
      <p><strong>Precio de lanzamiento: 9.97 USD</strong> (antes 99.70 USD, 90% de descuento).</p>
      ${boton(`${URL_LANDING}?utm_source=email&utm_medium=seguimiento2&utm_campaign=reto21`, 'Ver el Reto de 21 días')}
      <p>Si esta semana no es el momento, no pasa nada. Este es el último correo de esta secuencia.</p>
      <p>— Equipo Niños Sin Pantallas</p>`),
  },
};

async function enviarEmailBrevo(
  destinatario: string,
  nombre: string,
  tipo: 'seguimiento1' | 'seguimiento2' | 'quiz_seguimiento1' | 'quiz_seguimiento2',
  custom?: { asunto: string; contenido: string }
) {
  const plantilla = custom ?? {
    asunto: SEGUIMIENTO_LANDING[tipo as 'seguimiento1' | 'seguimiento2'].asunto,
    contenido: SEGUIMIENTO_LANDING[tipo as 'seguimiento1' | 'seguimiento2'].contenido(nombre),
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      to: [nombre ? { email: destinatario, name: nombre } : { email: destinatario }],
      sender: { email: SENDER_EMAIL, name: 'Niños Sin Pantallas' },
      replyTo: { email: REPLY_TO_EMAIL, name: 'Soporte Niños Sin Pantallas' },
      subject: plantilla.asunto,
      htmlContent: plantilla.contenido,
      tags: ['ninos-sin-pantallas', tipo],
    }),
  });

  return response.ok;
}

// Seguimientos de los leads que vienen del quiz: día 2 y día 5, con el resultado y el nombre del hijo.
// Quien compra sale de la secuencia: el webhook de Hotmart marca ambos seguimientos como enviados.
async function seguimientoQuiz(paso: 1 | 2, dias: number) {
  const campo = paso === 1 ? 'enviada_seguimiento_1' : 'enviada_seguimiento_2';
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from('contactos')
    .select('*')
    .eq('fuente', 'quiz')
    .eq('enviada_guia', true)
    .eq(campo, false)
    .lt('created_at', limite.toISOString());

  let enviados = 0;
  for (const contacto of data || []) {
    try {
      const plantilla = plantillaSeguimientoQuiz(paso, contacto.resultado_quiz || 'L', contacto.nombre_hijo || '');
      const ok = await enviarEmailBrevo(
        contacto.email,
        '',
        paso === 1 ? 'quiz_seguimiento1' : 'quiz_seguimiento2',
        plantilla
      );
      if (ok) {
        await supabase.from('contactos').update({ [campo]: true }).eq('id', contacto.id);
        enviados++;
      }
    } catch (error) {
      console.error(`Error enviando seguimiento quiz ${paso} a ${contacto.email}:`, error);
    }
  }
  return enviados;
}

export async function GET(request: NextRequest) {
  // Verificar que el request viene de Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hace3Dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Leads de la landing (guía gratuita): secuencia genérica original. Los del quiz van aparte.
    const { data: seguimiento1 } = await supabase
      .from('contactos')
      .select('*')
      .eq('enviada_guia', true)
      .eq('enviada_seguimiento_1', false)
      .or('fuente.is.null,fuente.neq.quiz')
      .lt('created_at', hace3Dias.toISOString());

    if (seguimiento1) {
      for (const contacto of seguimiento1) {
        try {
          await enviarEmailBrevo(contacto.email, contacto.nombre, 'seguimiento1');
          await supabase
            .from('contactos')
            .update({ enviada_seguimiento_1: true })
            .eq('id', contacto.id);
        } catch (error) {
          console.error(`Error enviando seguimiento1 a ${contacto.email}:`, error);
        }
      }
    }

    const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: seguimiento2 } = await supabase
      .from('contactos')
      .select('*')
      .eq('enviada_guia', true)
      .eq('enviada_seguimiento_2', false)
      .or('fuente.is.null,fuente.neq.quiz')
      .lt('created_at', hace7Dias.toISOString());

    if (seguimiento2) {
      for (const contacto of seguimiento2) {
        try {
          await enviarEmailBrevo(contacto.email, contacto.nombre, 'seguimiento2');
          await supabase
            .from('contactos')
            .update({ enviada_seguimiento_2: true })
            .eq('id', contacto.id);
        } catch (error) {
          console.error(`Error enviando seguimiento2 a ${contacto.email}:`, error);
        }
      }
    }

    const quiz1 = await seguimientoQuiz(1, 2);
    const quiz2 = await seguimientoQuiz(2, 5);

    return NextResponse.json({
      success: true,
      seg1_enviados: seguimiento1?.length || 0,
      seg2_enviados: seguimiento2?.length || 0,
      quiz_dia2_enviados: quiz1,
      quiz_dia5_enviados: quiz2,
    });
  } catch (error) {
    console.error('Error en cron:', error);
    return NextResponse.json({ error: 'Error procesando cron' }, { status: 500 });
  }
}
