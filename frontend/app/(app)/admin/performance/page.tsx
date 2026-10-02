import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { WORKSPACE_COOKIE } from '@/lib/st/constants';
import { createClient } from '@/lib/supabase/server';

export default async function PerformancePage() {
  const supabase = await createClient();
  const workspaceId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  if (!workspaceId) redirect('/dashboard');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('ao_org_members')
    .select('role')
    .eq('org_id', workspaceId)
    .eq('user_id', user.id)
    .is('left_at', null)
    .maybeSingle();

  const role = member?.role ? String(member.role).toLowerCase() : '';
  if (!['owner', 'admin'].includes(role)) {
    return <p className="text-destructive text-sm">Managers and admins only.</p>;
  }

  const { data: stats } = await supabase
    .from('st_rep_stats')
    .select('user_id, sessions_completed, avg_score, certifications_count')
    .eq('workspace_id', workspaceId)
    .order('sessions_completed', { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Team performance</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Rep</th>
            <th>Sessions</th>
            <th>Avg score</th>
            <th>Certs</th>
          </tr>
        </thead>
        <tbody>
          {(stats ?? []).map((row) => (
            <tr key={row.user_id} className="border-b">
              <td className="py-2 font-mono text-xs">{row.user_id.slice(0, 8)}…</td>
              <td>{row.sessions_completed}</td>
              <td>{row.avg_score ?? '—'}</td>
              <td>{row.certifications_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!stats?.length && <p className="text-muted-foreground text-sm">No rep stats yet.</p>}
    </div>
  );
}
