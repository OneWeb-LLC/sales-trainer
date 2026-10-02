import type { SupabaseClient } from '@supabase/supabase-js';
import { GHI_CNA_ADMISSIONS_EN, GHI_CNA_ADMISSIONS_ES } from '@/lib/st/scenario-templates';

/** Idempotent workspace seed for demo scenarios (admin-only insert via RLS). */
export async function ensureDefaultScenarios(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<void> {
  const templates = [
    {
      slug: 'ghi-cna-admissions-price-objection',
      title: 'GHI CNA Admissions — Price Objection',
      summary: 'Prospective student pushes back on program cost while comparing options.',
      language: 'en',
      vertical_tag: 'healthcare-admissions',
      config: GHI_CNA_ADMISSIONS_EN,
    },
    {
      slug: 'ghi-cna-admissions-objecion-precio-es',
      title: 'Admisiones CNA GHI — Objeción de precio',
      summary: 'Estudiante prospectiva cuestiona el costo del programa.',
      language: 'es',
      vertical_tag: 'healthcare-admissions',
      config: GHI_CNA_ADMISSIONS_ES,
    },
  ] as const;

  for (const t of templates) {
    const { data: existing } = await supabase
      .from('st_scenarios')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('slug', t.slug)
      .maybeSingle();

    if (existing) continue;

    await supabase.from('st_scenarios').insert({
      workspace_id: workspaceId,
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      language: t.language,
      vertical_tag: t.vertical_tag,
      published: true,
      pass_threshold_pct: 70,
      config: t.config,
      created_by: userId,
    });
  }
}
