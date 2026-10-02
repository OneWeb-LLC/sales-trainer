import { RUBRIC_CATEGORIES, type RubricCategory } from '@/lib/st/constants';
import type { ScenarioConfig } from '@/lib/st/scenario-templates';
import { createAdminClient } from '@/lib/supabase/admin';

type RubricScore = Record<RubricCategory, { score: number; feedback: string }>;

export async function evaluateSession(
  sessionId: string
): Promise<{ total: number; passed: boolean }> {
  const admin = createAdminClient();

  const { data: session, error: sessionErr } = await admin
    .from('st_sessions')
    .select('id, workspace_id, user_id, scenario_id, language')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionErr || !session) throw new Error('Session not found');

  const { data: scenario } = await admin
    .from('st_scenarios')
    .select('pass_threshold_pct, config, title')
    .eq('id', session.scenario_id)
    .maybeSingle();

  const config = (scenario?.config ?? {}) as ScenarioConfig;
  const threshold = Number(scenario?.pass_threshold_pct ?? 70);

  const { data: lines } = await admin
    .from('st_transcript_lines')
    .select('speaker, content')
    .eq('session_id', sessionId)
    .order('id', { ascending: true });

  const transcript = (lines ?? []).map((l) => `${l.speaker}: ${l.content}`).join('\n');

  const rubric = await scoreTranscript(transcript, config, session.language as string);

  let weighted = 0;
  let weightSum = 0;
  for (const cat of RUBRIC_CATEGORIES) {
    const w = config.scoring_rubric?.[cat]?.weight ?? 10;
    weighted += (rubric[cat]?.score ?? 0) * w;
    weightSum += w;
  }
  const total = weightSum ? Math.round((weighted / weightSum) * 10) / 10 : 0;
  const passed = total >= threshold;

  await admin.from('st_scorecards').upsert(
    {
      session_id: sessionId,
      total_score: total,
      passed,
      rubric,
      coaching: {
        summary: passed
          ? 'Solid performance. Review coaching notes per category for refinement.'
          : 'Focus your retry on the lowest-scoring categories below.',
        retry_focus: Object.entries(rubric)
          .sort((a, b) => a[1].score - b[1].score)
          .slice(0, 2)
          .map(([k]) => k),
      },
      evaluated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id' }
  );

  if (passed) {
    await admin.from('st_certifications').upsert(
      {
        workspace_id: session.workspace_id,
        user_id: session.user_id,
        scenario_id: session.scenario_id,
        score: total,
        certified_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,user_id,scenario_id' }
    );
  }

  const { data: stats } = await admin
    .from('st_rep_stats')
    .select('sessions_completed, avg_score, certifications_count')
    .eq('workspace_id', session.workspace_id)
    .eq('user_id', session.user_id)
    .maybeSingle();

  const prevCount = stats?.sessions_completed ?? 0;
  const prevAvg = stats?.avg_score ?? null;
  const newCount = prevCount + 1;
  const newAvg =
    prevAvg === null ? total : Math.round(((prevAvg * prevCount + total) / newCount) * 10) / 10;

  await admin.from('st_rep_stats').upsert(
    {
      workspace_id: session.workspace_id,
      user_id: session.user_id,
      sessions_completed: newCount,
      avg_score: newAvg,
      certifications_count: passed
        ? (stats?.certifications_count ?? 0) + 1
        : (stats?.certifications_count ?? 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' }
  );

  return { total, passed };
}

async function scoreTranscript(
  transcript: string,
  config: ScenarioConfig,
  language: string
): Promise<RubricScore> {
  const apiKey = process.env.OPENAI_API_KEY;
  const categories = RUBRIC_CATEGORIES.map((c) => ({
    key: c,
    criteria: config.scoring_rubric?.[c]?.criteria ?? c,
  }));

  if (!apiKey || !transcript.trim()) {
    const fallback: Partial<RubricScore> = {};
    for (const c of RUBRIC_CATEGORIES) {
      fallback[c] = {
        score: transcript.trim() ? 5 : 0,
        feedback: transcript.trim()
          ? 'Automatic placeholder score (OPENAI_API_KEY unavailable).'
          : 'No transcript captured for evaluation.',
      };
    }
    return fallback as RubricScore;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a sales QA coach. Score the REP only (not the prospect). Return JSON { "scores": { "<category>": { "score": 0-10, "feedback": "..." } } }. Categories: ' +
            categories.map((c) => c.key).join(', '),
        },
        {
          role: 'user',
          content: `Scenario language: ${language}\nRubric:\n${JSON.stringify(categories)}\n\nTranscript:\n${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI evaluation failed: ${res.status}`);

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as {
    scores?: Record<string, { score?: number; feedback?: string }>;
  };

  const out: Partial<RubricScore> = {};
  for (const c of RUBRIC_CATEGORIES) {
    const row = parsed.scores?.[c];
    out[c] = {
      score: Math.max(0, Math.min(10, Number(row?.score ?? 0))),
      feedback: row?.feedback ?? '',
    };
  }
  return out as RubricScore;
}
