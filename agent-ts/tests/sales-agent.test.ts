import { describe, expect, it } from 'vitest';
import { buildSalesInstructions, type ScenarioConfig } from '../src/sales-agent';

const sample: ScenarioConfig = {
  persona: { name: 'Maria', role: 'Prospect', tone: 'Warm', goals: ['Learn cost'] },
  hidden_context: 'Secret budget info',
  objection_triggers: [],
  scoring_rubric: {},
  opening_line: 'Hi there',
};

describe('buildSalesInstructions', () => {
  it('includes persona and never mentions scorecards to prospect', () => {
    const text = buildSalesInstructions('Test', sample, 'en');
    expect(text).toContain('Maria');
    expect(text).toContain('Never break character');
    expect(text).not.toContain('Secret budget');
  });

  it('uses Spanish directive for es language', () => {
    const text = buildSalesInstructions('Test', sample, 'es');
    expect(text).toContain('español');
  });
});
