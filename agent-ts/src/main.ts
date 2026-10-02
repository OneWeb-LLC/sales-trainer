import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  llm,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { audioEnhancement } from '@livekit/plugins-ai-coustics';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { getSupabase } from './db/client';
import {
  SalesRoleplayAgent,
  appendTranscriptLine,
  buildHiddenContextBlock,
  buildSalesInstructions,
  loadScenarioConfig,
  type SalesDispatchMeta,
} from './sales-agent';

dotenv.config({ path: '.env.local' });

function safeParseMetadata(raw: string | undefined | null): Partial<SalesDispatchMeta> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<SalesDispatchMeta>;
  } catch {
    return {};
  }
}

function resolveMeta(raw: string | undefined | null): SalesDispatchMeta {
  const meta = safeParseMetadata(raw);
  if (!meta.user_id || !meta.session_id || !meta.scenario_id) {
    throw new Error('Dispatch metadata must include user_id, session_id, and scenario_id');
  }
  return {
    user_id: meta.user_id,
    session_id: meta.session_id,
    scenario_id: meta.scenario_id,
    workspace_id: meta.workspace_id ?? '',
    language: meta.language ?? 'en',
  };
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    const meta = resolveMeta(ctx.job.metadata);
    ctx.proc.userData.meta = meta;

    const supabase = getSupabase();
    const scenario = await loadScenarioConfig(supabase, meta.scenario_id);

    const { data: sessionRow } = await supabase
      .from('st_sessions')
      .select('retry_focus')
      .eq('id', meta.session_id)
      .maybeSingle();

    const retryFocus = Array.isArray(sessionRow?.retry_focus)
      ? (sessionRow.retry_focus as string[])
      : [];

    const instructions = buildSalesInstructions(
      scenario.title,
      scenario.config,
      scenario.language,
      retryFocus,
    );

    const chatCtx = new llm.ChatContext();
    chatCtx.addMessage({
      role: 'assistant',
      content: buildHiddenContextBlock(scenario.config),
    });

    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: 'deepgram/nova-3',
        language: scenario.language === 'es' ? 'es' : 'en',
      }),
      llm: new inference.LLM({
        model: 'openai/gpt-4o-mini',
      }),
      tts: new inference.TTS({
        model: 'cartesia/sonic-3',
        voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
      }),
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
      voiceOptions: {
        preemptiveGeneration: true,
      },
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const msg = ev.item;
      if (msg.type !== 'message') return;
      const text = msg.textContent ?? '';
      if (!text) return;
      const speaker = msg.role === 'assistant' ? 'prospect' : 'rep';
      void appendTranscriptLine(supabase, meta.session_id, speaker, text);
    });

    ctx.addShutdownCallback(async () => {
      await supabase
        .from('st_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', meta.session_id);
    });

    await session.start({
      agent: new SalesRoleplayAgent({ chatCtx, instructions }),
      room: ctx.room,
      inputOptions: {
        noiseCancellation: audioEnhancement({ model: 'quailVfL' }),
      },
    });

    await ctx.connect();

    session.generateReply({
      instructions: 'Begin the roleplay in character with your opening line.',
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: process.env.AGENT_NAME ?? 'sales-trainer-agent',
  }),
);
