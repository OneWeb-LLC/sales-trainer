import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ScenarioAdminClient } from '@/components/st/scenario-admin-client';
import { WORKSPACE_COOKIE } from '@/lib/st/constants';
import { ensureDefaultScenarios } from '@/lib/st/seed-scenarios.server';
import { createClient } from '@/lib/supabase/server';

export default async function AdminScenariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const workspaceId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  if (!workspaceId) redirect('/dashboard');

  const { data: member } = await supabase
    .from('ao_org_members')
    .select('role')
    .eq('org_id', workspaceId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();

  const role = member?.role ? String(member.role).toLowerCase() : '';
  if (!['owner', 'admin'].includes(role)) {
    return <p className="text-destructive text-sm">Only workspace admins can manage scenarios.</p>;
  }

  await ensureDefaultScenarios(supabase, workspaceId, user.id);

  const { data: scenarios } = await supabase
    .from('st_scenarios')
    .select('id, title, language, published, slug, summary, difficulty, pass_threshold_pct, config')
    .eq('workspace_id', workspaceId)
    .order('title');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">Manage scenarios</h1>
      <ScenarioAdminClient workspaceId={workspaceId} initialScenarios={scenarios ?? []} />
    </div>
  );
}
