// app/api/send-email/route.ts - Captura emails, guarda en Supabase y envía la guía vía Brevo
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { plantillaResultadoQuiz } from '../../../lib/emails-quiz';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
// soporte.productosdigitales.0@gmail.com nunca quedó verificado como remitente en Brevo
// (Brevo lo rechazaba en silencio). Usamos el remitente ya verificado y dirigimos las
// respuestas del cliente a soporte vía Reply-To.
const SENDER_EMAIL = 'typ.productos.digitales@gmail.com';
const REPLY_TO_EMAIL = 'soporte.productosdigitales.0@gmail.com';

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
  return extra;
}

async function enviarEmailBrevo(
  destinatario: string,
  nombre: string,
  tipo: 'guia' | 'seguimiento1' | 'seguimiento2' | 'resultado_quiz',
  custom?: { asunto: string; contenido: string }
) {
  const plantillas = {
    guia: {
      asunto: '🎯 Tu Guía Exclusiva - Método Calma',
      contenido: `
        <h2>${nombre ? `¡Hola ${nombre}!` : '¡Hola!'}</h2>
        <p>Gracias por tu interés en el <strong>Método Calma</strong> 🙏</p>
        <p>Aquí está tu guía exclusiva que pediste. Te mostrará los primeros pasos para implementar el método en tu vida.</p>
        <p><strong>Contenido de la guía:</strong></p>
        <ul>
          <li>✅ Principios clave del Método Calma</li>
          <li>✅ Ejercicios prácticos para los primeros 3 días</li>
          <li>✅ Cómo integrar con actividades de tus hijos</li>
          <li>✅ Acceso a la app PLR Kids Builder (30 días)</li>
        </ul>
        <p>Si tienes dudas, responde este email 💬</p>
        <p>¡Que disfrutes el viaje!</p>
        <p>— Equipo Método Calma</p>
      `
    },
    seguimiento1: {
      asunto: '⏰ ¿Ya empezaste? Aquí van los primeros resultados',
      contenido: `
        <h2>Hola ${nombre},</h2>
        <p>Espero que hayas recibido tu guía y ya hayas experimentado los primeros cambios 🌟</p>
        <p><strong>Este es el momento crítico:</strong> Los primeros 3 días son cuando ves si el método funciona para ti.</p>
        <p>Si aún no has empezado, aquí va un recordatorio de por dónde comenzar:</p>
        <ol>
          <li>Haz el ejercicio de respiración (5 minutos)</li>
          <li>Practica con tus hijos (10 minutos)</li>
          <li>Observa los cambios (sin presión)</li>
        </ol>
        <p>Si tienes preguntas, estoy aquí para ayudarte 💪</p>
        <p>— Equipo Método Calma</p>
      `
    },
    seguimiento2: {
      asunto: '🚀 El siguiente paso: Acceso completo a Método Calma',
      contenido: `
        <h2>¡${nombre}, es hora del siguiente nivel!</h2>
        <p>Si has seguido la guía durante estos días, ya notaste los cambios ¿verdad?</p>
        <p><strong>Lo que hace la diferencia:</strong> La mayoría de personas abandona después de 3 días. Tú no. Tú seguiste adelante.</p>
        <p>Por eso te ofrecemos acceso completo a:</p>
        <ul>
          <li>🎓 Módulos completos del Método Calma</li>
          <li>📱 PLR Kids Builder (generador de actividades)</li>
          <li>💬 Comunidad exclusiva</li>
          <li>📞 Soporte directo</li>
        </ul>
        <p><strong>Tu inversión:</strong> Menos de lo que gastas en un café al día.</p>
        <p>[BOTÓN: Ver oferta especial]</p>
        <p>— Equipo Método Calma</p>
      `
    }
  };

  const plantilla = custom ?? plantillas[tipo as 'guia' | 'seguimiento1' | 'seguimiento2'];

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      to: [nombre ? { email: destinatario, name: nombre } : { email: destinatario }],
      sender: { email: SENDER_EMAIL, name: 'Método Calma' },
      replyTo: { email: REPLY_TO_EMAIL, name: 'Soporte Método Calma' },
      subject: plantilla.asunto,
      htmlContent: plantilla.contenido,
      tags: ['metodo-calma', tipo],
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
