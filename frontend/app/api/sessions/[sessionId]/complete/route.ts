import { NextResponse } from 'next/server';
import { evaluateSession } from '@/lib/st/evaluate-session.server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: session } = await supabase
    .from('st_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await supabase
    .from('st_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  try {
    const result = await evaluateSession(sessionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: true, evaluation: 'failed' });
  }
}
