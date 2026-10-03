// app/api/send-email/route.ts - Captura emails, guarda en Supabase y envía la guía vía Brevo
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { plantillaResultadoQuiz, URL_LANDING } from '../../../lib/emails-quiz';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
// soporte.productosdigitales.0@gmail.com nunca quedó verificado como remitente en Brevo
// (Brevo lo rechazaba en silencio). Usamos el remitente ya verificado y dirigimos las
// respuestas del cliente a soporte vía Reply-To.
const SENDER_EMAIL = 'typ.productos.digitales@gmail.com';
const REPLY_TO_EMAIL = 'soporte.productosdigitales.0@gmail.com';
// PDF público de la Guía Inicial gratuita (en la landing, con nombre no indexable y Disallow en robots.txt).
const URL_GUIA = 'https://reto-21-dias-landing.vercel.app/guia-inicial-x9k2mq7.pdf';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Lista de orígenes permitidos para CORS, separados por coma en ALLOWED_ORIGINS
// (o ALLOWED_ORIGIN en singular, por compatibilidad con el nombre anterior).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

interface ContactoRequest {
  email: string;
  nombre?: string;
  // Datos que aporta el quiz. Ojo: el nombre y la edad son del hijo, no de quien deja el correo.
  nombre_hijo?: string;
  edad_hijo?: string;
  resultado_quiz?: string;
  diagnostico?: string;
  respuestas_quiz?: Record<string, unknown>;
  fuente?: string;
  consentimiento?: boolean;
}

const FUENTES_VALIDAS = ['landing', 'quiz'];
const RESULTADOS_VALIDOS = ['L', 'A', 'C'];

// Limpia los campos opcionales del quiz para no guardar basura ni payloads enormes.
function datosExtra(body: ContactoRequest) {
  const extra: Record<string, unknown> = {};
  if (typeof body.nombre_hijo === 'string' && body.nombre_hijo.trim()) {
    extra.nombre_hijo = body.nombre_hijo.trim().slice(0, 80);
  }
  if (typeof body.edad_hijo === 'string' && body.edad_hijo.trim()) {
    extra.edad_hijo = body.edad_hijo.trim().slice(0, 20);
  }
  if (typeof body.resultado_quiz === 'string' && RESULTADOS_VALIDOS.includes(body.resultado_quiz)) {
    extra.resultado_quiz = body.resultado_quiz;
  }
  if (body.respuestas_quiz && typeof body.respuestas_quiz === 'object' && !Array.isArray(body.respuestas_quiz)) {
    if (JSON.stringify(body.respuestas_quiz).length <= 4000) extra.respuestas_quiz = body.respuestas_quiz;
  }
  if (typeof body.fuente === 'string' && FUENTES_VALIDAS.includes(body.fuente)) {
    extra.fuente = body.fuente;
  }
  if (typeof body.consentimiento === 'boolean') {
    extra.consentimiento = body.consentimiento;
  }
  return extra;
}

// Solo dos correos se envían desde este archivo: la guía inicial (lead de la landing) y el
// resultado del quiz. Los seguimientos viven en app/api/cron/send-followups/route.ts.
async function enviarEmailBrevo(
  destinatario: string,
  nombre: string,
  tipo: 'guia' | 'resultado_quiz',
  custom?: { asunto: string; contenido: string }
) {
  const boton = (href: string, texto: string) =>
    `<p style="text-align:center;margin:24px 0"><a href="${href}" style="background:#1a6bff;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold;display:inline-block">${texto} →</a></p>`;

  const linkLanding = `${URL_LANDING}?utm_source=email&utm_medium=guia&utm_campaign=reto21`;

  const plantillas = {
    guia: {
      asunto: '🎁 Tu Guía Inicial «Niños Sin Pantallas» ya está aquí',
      contenido: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.55">
        <h2>${nombre ? `¡Hola ${nombre}!` : '¡Hola!'}</h2>
        <p>Gracias por sumarte a Niños Sin Pantallas 💚</p>
        <p>Aquí tienes tu Guía Inicial: 20 capítulos con la ciencia detrás de la sobreestimulación y las pantallas, basada en evidencia de la Academia Americana de Pediatría y el trabajo de la Dra. Michaeleen Doucleff (NPR).</p>
        ${boton(URL_GUIA, 'Descargar mi Guía Inicial')}
        <p>Es el primer paso. Cuando quieras el plan completo día a día — el Reto de 21 días, Método C.A.L.M.A. — te espera aquí:</p>
        ${boton(linkLanding, 'Ver el Reto de 21 días')}
        <p style="font-size:12px;color:#888">Si tienes dudas, responde este correo. — Equipo Niños Sin Pantallas</p>
      </div>`,
    },
  };

  const plantilla = custom ?? plantillas[tipo as 'guia'];

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

  if (!response.ok) {
    throw new Error(`Brevo API error: ${response.statusText}`);
  }

  return true;
}

async function guardarContacto(email: string, nombre: string, extra: Record<string, unknown>) {
  const { data: existente } = await supabase
    .from('contactos')
    .select('id')
    .eq('email', email)
    .single();

  if (existente) {
    return { success: false, mensaje: 'Este email ya está registrado' };
  }

  const { data, error } = await supabase
    .from('contactos')
    .insert([{
      email,
      nombre: nombre || 'Cliente',
      enviada_guia: false,
      enviada_seguimiento_1: false,
      enviada_seguimiento_2: false,
      ...extra,
    }])
    .select()
    .single();

  if (error) throw error;

  return { success: true, contacto: data };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    const body: ContactoRequest = await request.json();

    if (!body.email || !body.email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400, headers: corsHeaders(origin) });
    }

    const extra = datosExtra(body);
    const resultGuardar = await guardarContacto(body.email, body.nombre || '', extra);

    if (!resultGuardar.success) {
      return NextResponse.json({ error: resultGuardar.mensaje }, { status: 409, headers: corsHeaders(origin) });
    }

    if (extra.fuente === 'quiz') {
      // Lead del quiz: recibe SU resultado (con el nombre del hijo), no la guía genérica.
      const plantilla = plantillaResultadoQuiz(
        (extra.resultado_quiz as string) || 'L',
        (extra.nombre_hijo as string) || '',
        body.diagnostico === 'si'
      );
      await enviarEmailBrevo(body.email, '', 'resultado_quiz', plantilla);
    } else {
      // Lead de la landing: recibe la Guía Inicial gratuita.
      await enviarEmailBrevo(body.email, body.nombre || '', 'guia');
    }

    await supabase
      .from('contactos')
      .update({ enviada_guia: true })
      .eq('email', body.email);

    return NextResponse.json({
      success: true,
      mensaje: 'Email guardado y guía enviada. ¡Revisa tu inbox!',
      contacto: resultGuardar.contacto,
    }, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 500, headers: corsHeaders(origin) });
  }
}

// Dashboard de métricas
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    const { data, count } = await supabase
      .from('contactos')
      .select('*', { count: 'exact' });

    return NextResponse.json({
      total_contactos: count,
      guias_enviadas: data?.filter(c => c.enviada_guia).length || 0,
      seguimiento_1_enviados: data?.filter(c => c.enviada_seguimiento_1).length || 0,
      seguimiento_2_enviados: data?.filter(c => c.enviada_seguimiento_2).length || 0,
    }, { headers: corsHeaders(origin) });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500, headers: corsHeaders(origin) });
  }
}
