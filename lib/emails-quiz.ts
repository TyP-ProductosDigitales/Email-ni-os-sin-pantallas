// lib/emails-quiz.ts - Plantillas de los correos del quiz (resultado y seguimientos).
// Se arman siempre en el servidor: el quiz solo envía la clave del resultado (L/A/C).

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ---- Resultado del quiz por correo ----
// El texto de cada resultado replica el de index.html del quiz (objeto `resultados`).
// El quiz solo envía la clave (L/A/C); el HTML del correo se arma siempre acá, en el servidor,
// para que nadie pueda usar este endpoint para enviar contenido arbitrario.
export const URL_LANDING = 'https://reto-21-dias-landing.vercel.app/';

export const RESULTADOS_QUIZ: Record<string, {
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

export function plantillaResultadoQuiz(resultado: string, nombreHijo: string, esDiagnosticado: boolean) {
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


// ---- Seguimientos del quiz (día 2 y día 5) ----
// Texto aprobado por Sandra el 20 de septiembre de 2026. Sin nombre de la mamá: el quiz solo pide el del hijo.
const PIE_BAJA = '<p style="font-size:12px;color:#888">Si no quieres recibir más correos, responde este mensaje con la palabra BAJA. — Equipo Método Calma</p>';

export function plantillaSeguimientoQuiz(paso: 1 | 2, resultado: string, nombreHijo: string) {
  const r = RESULTADOS_QUIZ[resultado] || RESULTADOS_QUIZ.L;
  const n = escapeHtml(nombreHijo || 'tu hijo');
  const boton = (texto: string) => {
    const link = `${URL_LANDING}?utm_source=email&utm_medium=quiz_seguimiento${paso}&utm_campaign=reto21`;
    return `<p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#1a6bff;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold;display:inline-block">${texto} →</a></p>`;
  };
  const envoltura = (cuerpo: string) => `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.55">
        ${cuerpo}
        ${PIE_BAJA}
      </div>
    `;

  if (paso === 1) {
    return {
      asunto: `Una cosa pequeña para probar con ${nombreHijo || 'tu hijo'} hoy`,
      contenido: envoltura(`
        <p>Hola. Hace dos días viste el resultado de ${n}. Antes de pensar en el plan completo, prueba esto hoy, solo una vez:</p>
        <p style="background:#eef6ee;padding:12px 14px;border-radius:8px">${r.prueba.charAt(0).toUpperCase() + r.prueba.slice(1)}</p>
        <p>Si quieres ver el plan completo de 21 días, está aquí:</p>
        ${boton('Ver el plan completo')}
        <p>Si tienes dudas, responde este correo.</p>`),
    };
  }
  return {
    asunto: `¿Cómo te fue con ${nombreHijo || 'tu hijo'}?`,
    contenido: envoltura(`
        <p>Hola. Espero que la prueba haya ido bien. Una mamá nos contó:</p>
        <blockquote style="border-left:3px solid #ccc;margin:16px 0;padding:4px 14px;color:#444">"${r.testimonio.texto}"<br><small>— ${r.testimonio.autor}</small></blockquote>
        <p>El Reto de 21 días está pensado para eso: pasos diarios cortos, con guiones para los momentos difíciles, sin culpas y sin sacar las pantallas de casa.</p>
        ${boton('Ver el Reto')}
        <p>Si esta semana no fue el momento, no pasa nada. Este correo es el último.</p>`),
  };
}
