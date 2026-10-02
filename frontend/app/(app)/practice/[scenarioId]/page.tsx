import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { PracticeRoom } from '@/components/st/practice-room';
import { WORKSPACE_COOKIE } from '@/lib/st/constants';
import { createClient } from '@/lib/supabase/server';
import { getAppConfig } from '@/lib/utils';

export default async function PracticePage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const workspaceId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  if (!workspaceId) redirect('/dashboard');

  const { data: scenario } = await supabase
    .from('st_scenarios')
    .select('id, title, language, workspace_id, published')
    .eq('id', scenarioId)
    .maybeSingle();

  if (!scenario || scenario.workspace_id !== workspaceId) notFound();

  const { data: session, error } = await supabase
    .from('st_sessions')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      scenario_id: scenario.id,
      language: scenario.language,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !session) {
    throw new Error(error?.message ?? 'Could not create session');
  }

  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return (
    <PracticeRoom appConfig={appConfig} sessionId={session.id} scenarioTitle={scenario.title} />
  );
}
