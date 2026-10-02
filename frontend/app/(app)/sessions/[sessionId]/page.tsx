import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('st_sessions')
    .select('id, status, scenario:st_scenarios(title, id)')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) notFound();

  const { data: lines } = await supabase
    .from('st_transcript_lines')
    .select('speaker, content, created_at')
    .eq('session_id', sessionId)
    .order('id');

  const { data: scorecard } = await supabase
    .from('st_scorecards')
    .select('total_score, passed, rubric, coaching')
    .eq('session_id', sessionId)
    .maybeSingle();

  const scenarioId = (session.scenario as { id?: string } | null)?.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {(session.scenario as { title?: string } | null)?.title}
          </h1>
          <p className="text-muted-foreground text-sm">Status: {session.status}</p>
        </div>
        {scenarioId && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/practice/${scenarioId}`}>Retry</Link>
          </Button>
        )}
      </header>

      {scorecard && (
        <section className="rounded-lg border p-4">
          <p className="font-medium">
            Score {scorecard.total_score}/10 · {scorecard.passed ? 'Passed' : 'Keep practicing'}
          </p>
          <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs">
            {JSON.stringify(scorecard.coaching, null, 2)}
          </pre>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">Transcript</h2>
        <div className="space-y-2 rounded-lg border p-4 text-sm">
          {(lines ?? []).map((l, i) => (
            <p key={i}>
              <span className="font-mono text-xs uppercase">{l.speaker}</span>: {l.content}
            </p>
          ))}
          {!lines?.length && <p className="text-muted-foreground">No transcript lines recorded.</p>}
        </div>
      </section>
    </div>
  );
}
