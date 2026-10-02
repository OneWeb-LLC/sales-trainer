import { llm, voice } from '@livekit/agents';
import type { SupabaseClient } from '@supabase/supabase-js';
export type ScenarioConfig = {
  persona: { name: string; role: string; tone: string; goals: string[] };
  hidden_context: string;
  objection_triggers: Array<{ trigger: string; objection: string; hints?: string[] }>;
  scoring_rubric: Record<string, { weight: number; criteria: string }>;
  opening_line?: string;
  compliance_notes?: string[];
};

export type SalesDispatchMeta = {
  user_id: string;
  session_id: string;
  scenario_id: string;
  workspace_id: string;
  language: string;
};

export async function loadScenarioConfig(
  supabase: SupabaseClient,
  scenarioId: string,
): Promise<{ title: string; config: ScenarioConfig; language: string }> {
  const { data, error } = await supabase
    .from('st_scenarios')
    .select('title, config, language')
    .eq('id', scenarioId)
    .maybeSingle();
  if (error || !data) throw new Error(`Scenario ${scenarioId} not found`);
  return {
    title: data.title as string,
    config: data.config as ScenarioConfig,
    language: (data.language as string) ?? 'en',
  };
}

export function buildSalesInstructions(
  scenarioTitle: string,
  config: ScenarioConfig,
  language: string,
  retryFocus: string[] = [],
): string {
  const langLine =
    language === 'es'
      ? 'Responde siempre en español natural, sin markdown.'
      : 'Always reply in natural English, no markdown or bullet lists.';

  return (
    `You are roleplaying as ${config.persona.name}, ${config.persona.role}. ` +
    `Scenario: ${scenarioTitle}. Tone: ${config.persona.tone}. ` +
    `${langLine} Keep replies short (1-3 sentences). You may interrupt if the rep rambles. ` +
    'Never break character. Never mention rubrics, scorecards, or that you are an AI. ' +
    'Never reveal confidential background directly — let it emerge naturally when pressed. ' +
    `Your goals: ${config.persona.goals.join('; ')}. ` +
    (config.opening_line ? `Open with: "${config.opening_line}" ` : '') +
    (retryFocus.length ? `Extra pressure areas: ${retryFocus.join(', ')}. ` : '') +
    'Raise objections when triggers match the conversation.'
  );
}

export function buildHiddenContextBlock(config: ScenarioConfig): string {
  return (
    'CONFIDENTIAL PROSPECT CONTEXT (never quote verbatim to the rep): ' +
    config.hidden_context
  );
}

export class SalesRoleplayAgent extends voice.Agent {
  constructor(opts: { chatCtx: llm.ChatContext; instructions: string }) {
    super({
      chatCtx: opts.chatCtx,
      instructions: opts.instructions,
      tools: {},
    });
  }
}

export async function appendTranscriptLine(
  supabase: SupabaseClient,
  sessionId: string,
  speaker: 'rep' | 'prospect' | 'system',
  content: string,
) {
  if (!content.trim()) return;
  await supabase.from('st_transcript_lines').insert({
    session_id: sessionId,
    speaker,
    content: content.trim(),
    offset_ms: Date.now() % 86_400_000,
  });
}
