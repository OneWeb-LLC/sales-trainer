import { cookies } from 'next/headers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { WORKSPACE_COOKIE } from '@/lib/st/constants';
import { createClient } from '@/lib/supabase/server';

export default async function ScenariosPage() {
  const supabase = await createClient();
  const workspaceId = (await cookies()).get(WORKSPACE_COOKIE)?.value;

  const { data: scenarios } = workspaceId
    ? await supabase
        .from('st_scenarios')
        .select('id, title, language, difficulty, published, summary')
        .eq('workspace_id', workspaceId)
        .order('title')
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Scenario library</h1>
      <ul className="divide-border divide-y rounded-lg border">
        {(scenarios ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 p-4">
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-muted-foreground text-xs">
                {s.language?.toUpperCase()} · {s.difficulty} {s.published ? '' : '(draft)'}
              </p>
            </div>
            {s.published && (
              <Button asChild size="sm">
                <Link href={`/practice/${s.id}`}>Practice</Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
