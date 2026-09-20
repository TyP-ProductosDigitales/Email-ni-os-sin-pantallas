// app/api/send-email/route.ts - Captura emails, guarda en Supabase y envía la guía vía Brevo
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

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

// ---- Resultado del quiz por correo ----
// El texto de cada resultado replica el de index.html del quiz (objeto `resultados`).
// El quiz solo envía la clave (L/A/C); el HTML del correo se arma siempre acá, en el servidor,
// para que nadie pueda usar este endpoint para enviar contenido arbitrario.
const URL_LANDING = 'https://reto-21-dias-landing.vercel.app/';

const RESULTADOS_QUIZ: Record<string, {
  icon: string;
  title: (n: string) => string;
  texto: string;
  prueba: string;
  testimonio: { texto: string; autor: string };
  cta: (n: string) => string;
}> = {
  L: {
    icon: '🕊️',
    title: n => `${n} no es difícil a propósito. Su cerebro necesita un límite que no lo desborde.`,
    texto: 'Cuando apagas de golpe una fuente de dopamina sin decirle qué viene después, su cerebro reacciona como si perdiera algo importante. Lo que necesita no es más firmeza: es un sistema de transición con guiones exactos para ese momento.',
    prueba: "en vez de 'se acabó el tiempo', avísale con una acción real — 'en 5 min guardamos y armamos X'.",
    testimonio: { texto: 'Semana 1: berrinche de 40 minutos. Semana 3: él mismo buscó actividades solo.', autor: 'Gabriela' },
    cta: () => 'Quiero recuperar el control hoy',
  },
  A: {
    icon: '🎈',
    title: n => `${n} no está enganchado. Su cerebro se acostumbró a no aburrirse nunca.`,
    texto: 'Tabletas, TV y videojuegos dan recompensa cada 5 segundos. Un juego real, cada 5 minutos. No es flojera: es habituación a la dopamina rápida. Necesita un banco de actividades por edad que le enseñe a regular el aburrimiento.',
    prueba: 'una sola actividad de 10 minutos, tú eliges, sin opciones infinitas que lo saturen.',
    testimonio: { texto: 'Te dice exactamente qué hacer. No tienes que improvisar agotada.', autor: 'Carolina' },
    cta: n => `Quiero ayudar a ${n} a regularse hoy`,
  },
  C: {
    icon: '🤝',
    title: n => `Con ${n}, antes que límites, necesitan reencontrarse.`,
    texto: 'Cuando la pantalla ocupa la cena y el antes de dormir, poco a poco es más fácil estar con la pantalla que contigo. Lo que más rápido regula emociones en un niño no es otra regla: son 10 minutos de conexión real sin pantallas cerca (ni la tuya).',
    prueba: '10 minutos sin pantallas, él elige el juego, tú solo estás presente. Sin corregir nada.',
    testimonio: { texto: 'Lloraba encerrada en el baño. Día 18 vino a abrazarme y me dijo: mami, juguemos.', autor: 'María, Monterrey' },
    cta: n => `Quiero reconectar con ${n} hoy`,
  },
};

function plantillaResultadoQuiz(resultado: string, nombreHijo: string, esDiagnosticado: boolean) {
  const r = RESULTADOS_QUIZ[resultado] || RESULTADOS_QUIZ.L;
  const n = escapeHtml(nombreHijo || 'tu hijo');
  const nota = esDiagnosticado
    ? `<p style="background:#f5f1e8;padding:12px 14px;border-radius:8px"><strong>Un recordatorio:</strong> este plan es un complemento a lo que ya trabajas con el especialista de ${n} — no lo reemplaza.</p>`
    : '';
  const link = `${URL_LANDING}?utm_source=email&utm_medium=quiz_resultado&utm_campaign=reto21`;
  return {
    asunto: `${r.icon} El plan personalizado para ${nombreHijo || 'tu hijo'}: tu resultado`,
    contenido: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.55">
        <p style="font-size:13px;color:#777;margin:0 0 4px">Tu plan personalizado para ${n}</p>
        <h2 style="margin:0 0 14px">${r.icon} ${r.title(n)}</h2>
        ${nota}
        <p>${r.texto}</p>
        <p style="background:#eef6ee;padding:12px 14px;border-radius:8px"><strong>Prueba hoy mismo:</strong> ${r.prueba}</p>
        <blockquote style="border-left:3px solid #ccc;margin:16px 0;padding:4px 14px;color:#444">"${r.testimonio.texto}"<br><small>— ${r.testimonio.autor}</small></blockquote>
        <p>Tu plan de 21 días está diseñado para bajar la sobreestimulación de ${n} y devolver la calma a tu hogar, sin culpas, sin gritos y sin sacar las pantallas de casa.</p>
        <p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#1a6bff;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold;display:inline-block">${r.cta(n)} →</a></p>
        <p style="font-size:12px;color:#888">Si tienes dudas, responde este correo. — Equipo Método Calma</p>
      </div>
    `,
  };
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
