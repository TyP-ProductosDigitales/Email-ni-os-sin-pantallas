import { NextResponse } from 'next/server';

function inspect(name: string) {
  const val = process.env[name];
  if (val === undefined) return { name, present: false };
  const badChars: { index: number; code: number; char: string }[] = [];
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i);
    if (code > 255) {
      badChars.push({ index: i, code, char: val[i] });
    }
  }
  return {
    name,
    present: true,
    length: val.length,
    first6: val.slice(0, 6),
    last6: val.slice(-6),
    hasWhitespaceEdges: /^\s|\s$/.test(val) || /\n|\r/.test(val),
    badChars,
  };
}

export async function GET() {
  return NextResponse.json({
    vars: [
      inspect('NEXT_PUBLIC_SUPABASE_URL'),
      inspect('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      inspect('BREVO_API_KEY'),
      inspect('CRON_SECRET'),
      inspect('ALLOWED_ORIGIN'),
    ],
  });
}
