// app/api/cron/send-followups/route.ts
// Se ejecuta automáticamente cada día (ver vercel.json)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const SENDER_EMAIL = 'soporte.productosdigitales.0@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function enviarEmailBrevo(
  destinatario: string,
  nombre: string,
  tipo: 'seguimiento1' | 'seguimiento2'
) {
  const plantillas = {
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

  const plantilla = plantillas[tipo];

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      to: [{ email: destinatario, name: nombre }],
      from: { email: SENDER_EMAIL, name: 'Método Calma' },
      subject: plantilla.asunto,
      htmlContent: plantilla.contenido,
      tags: ['metodo-calma', tipo],
    }),
  });

  return response.ok;
}

export async function GET(request: NextRequest) {
  // Verificar que el request viene de Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hace3Dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const { data: seguimiento1 } = await supabase
      .from('contactos')
      .select('*')
      .eq('enviada_guia', true)
      .eq('enviada_seguimiento_1', false)
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

    return NextResponse.json({
      success: true,
      seg1_enviados: seguimiento1?.length || 0,
      seg2_enviados: seguimiento2?.length || 0,
    });
  } catch (error) {
    console.error('Error en cron:', error);
    return NextResponse.json({ error: 'Error procesando cron' }, { status: 500 });
  }
}
