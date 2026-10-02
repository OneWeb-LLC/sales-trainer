import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { WORKSPACE_COOKIE } from '@/lib/st/constants';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">Activate workspace</h1>
        <p className="text-muted-foreground text-sm">
          Your session is authenticated but workspace context is missing. Reload after signing in
          again, or launch from OWeb.
        </p>
        <Button asChild>
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  const { data: scenarios } = await supabase
    .from('st_scenarios')
    .select('id, title, language, difficulty, summary')
    .eq('workspace_id', workspaceId)
    .eq('published', true)
    .order('title');

  const { data: stats } = await supabase
    .from('st_rep_stats')
    .select('sessions_completed, avg_score, certifications_count')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Practice dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Realtime voice roleplay for your active workspace.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sessions" value={String(stats?.sessions_completed ?? 0)} />
        <Stat label="Avg score" value={stats?.avg_score != null ? String(stats.avg_score) : '—'} />
        <Stat label="Certifications" value={String(stats?.certifications_count ?? 0)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Start a scenario</h2>
        <ul className="divide-border divide-y rounded-lg border">
          {(scenarios ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-muted-foreground text-xs">
                  {s.language?.toUpperCase()} · {s.difficulty}
                </p>
                {s.summary && <p className="text-muted-foreground mt-1 text-sm">{s.summary}</p>}
              </div>
              <Button asChild size="sm">
                <Link href={`/practice/${s.id}`}>Practice</Link>
              </Button>
            </li>
          ))}
          {!scenarios?.length && (
            <li className="text-muted-foreground p-4 text-sm">
              No published scenarios yet. Workspace admins can seed templates under Manage
              scenarios.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
