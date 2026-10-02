import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureStProfile, resolveSalesTrainerContext } from '@/lib/oweb/activation.server';
import { WORKSPACE_COOKIE } from '@/lib/st/constants';
import { ensureDefaultScenarios } from '@/lib/st/seed-scenarios.server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    preferredWorkspaceId?: string;
    activationKind?: 'sign_in' | 'sso_launch' | 'signup';
  };

  const cookieStore = await cookies();
  const cookieWorkspace = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const preferred = body.preferredWorkspaceId ?? cookieWorkspace ?? null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: 'no_access_token' }, { status: 401 });
  }

  await ensureStProfile(supabase, user.id, user.email);

  const ctx = await resolveSalesTrainerContext({
    supabase,
    userId: user.id,
    accessToken,
    preferredWorkspaceId: preferred,
    activationKind: body.activationKind ?? 'sign_in',
  });

  if (ctx.workspaceId && ctx.isAdmin) {
    await ensureDefaultScenarios(supabase, ctx.workspaceId, user.id);
  }

  const res = NextResponse.json(ctx);
  if (ctx.workspaceId) {
    res.cookies.set(WORKSPACE_COOKIE, ctx.workspaceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
