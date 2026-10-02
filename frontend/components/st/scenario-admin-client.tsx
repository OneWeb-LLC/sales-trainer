'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

type ScenarioRow = {
  id: string;
  title: string;
  language: string;
  published: boolean;
  slug: string;
  summary: string | null;
  difficulty: string;
  pass_threshold_pct: number;
  config: unknown;
};

export function ScenarioAdminClient({
  workspaceId,
  initialScenarios,
}: {
  workspaceId: string;
  initialScenarios: ScenarioRow[];
}) {
  const [rows, setRows] = useState(initialScenarios);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function togglePublished(id: string, published: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from('st_scenarios')
      .update({ published: !published })
      .eq('id', id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, published: !published } : x)));
  }

  async function createScenario() {
    if (!title.trim()) return;
    const supabase = createClient();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const { data, error } = await supabase
      .from('st_scenarios')
      .insert({
        workspace_id: workspaceId,
        title,
        slug: `${slug}-${Date.now()}`,
        summary: 'Custom scenario',
        language: 'en',
        difficulty: 'medium',
        published: false,
        pass_threshold_pct: 70,
        config: {
          persona: { name: 'Prospect', role: 'Buyer', tone: 'Neutral', goals: ['Evaluate offer'] },
          hidden_context: 'Hidden from rep-facing UI; stored for evaluators/agents only.',
          objection_triggers: [],
          scoring_rubric: {},
        },
      })
      .select(
        'id, title, language, published, slug, summary, difficulty, pass_threshold_pct, config'
      )
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }
    if (data) setRows((r) => [...r, data as ScenarioRow]);
    setTitle('');
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-destructive text-sm">{message}</p>}
      <div className="flex gap-2">
        <input
          className="border-input flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="New scenario title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="button" onClick={createScenario}>
          Add
        </Button>
      </div>
      <ul className="divide-border divide-y rounded-lg border">
        {rows.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-muted-foreground text-xs">{s.slug}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => togglePublished(s.id, s.published)}>
              {s.published ? 'Unpublish' : 'Publish'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
