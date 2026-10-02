import { cookies } from 'next/headers';
import Link from 'next/link';
import { WORKSPACE_COOKIE } from '@/lib/st/constants';
import { createClient } from '@/lib/supabase/server';

export default async function SessionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspaceId = (await cookies()).get(WORKSPACE_COOKIE)?.value;

  const { data: sessions } =
    user && workspaceId
      ? await supabase
          .from('st_sessions')
          .select('id, status, created_at, scenario:st_scenarios(title)')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)
      : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Session history</h1>
      <ul className="divide-border divide-y rounded-lg border">
        {(sessions ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">
                {(s.scenario as { title?: string } | null)?.title ?? 'Scenario'}
              </p>
              <p className="text-muted-foreground text-xs">
                {new Date(s.created_at).toLocaleString()}
              </p>
            </div>
            <Link className="underline" href={`/sessions/${s.id}`}>
              {s.status}
            </Link>
          </li>
        ))}
        {!sessions?.length && (
          <li className="text-muted-foreground p-4 text-sm">No sessions yet.</li>
        )}
      </ul>
    </div>
  );
}
