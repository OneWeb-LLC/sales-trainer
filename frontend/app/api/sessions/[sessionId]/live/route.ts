import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('st_sessions')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
