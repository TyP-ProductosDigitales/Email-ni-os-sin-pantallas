// app/api/hotmart-webhook/route.ts
// Hotmart avisa acá cada vez que hay una compra. Quien compra sale de los seguimientos de venta:
// marcamos ambos seguimientos como enviados y el cron ya no le escribe.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);

// Eventos de Hotmart que significan "ya compró"
const EVENTOS_COMPRA = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];

export async function POST(request: NextRequest) {
  const hottokEsperado = process.env.HOTMART_HOTTOK;
  // Sin token configurado, el endpoint no acepta nada (mejor cerrado que abierto).
  if (!hottokEsperado) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const hottok = request.headers.get('x-hotmart-hottok') || body?.hottok;
  if (hottok !== hottokEsperado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!EVENTOS_COMPRA.includes(body?.event)) {
    return NextResponse.json({ ok: true, ignorado: body?.event || 'sin evento' });
  }

  const email: string | undefined = body?.data?.buyer?.email;
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: true, ignorado: 'sin correo del comprador' });
  }

  // El correo con el que compró puede venir con otras mayúsculas que el del quiz.
  const variantes = Array.from(new Set([email, email.trim(), email.trim().toLowerCase()]));
  let actualizados = 0;
  for (const variante of variantes) {
    const { data } = await supabase
      .from('contactos')
      .update({ enviada_seguimiento_1: true, enviada_seguimiento_2: true })
      .eq('email', variante)
      .select('id');
    actualizados += data?.length || 0;
  }

  return NextResponse.json({ ok: true, contactos_actualizados: actualizados });
}
