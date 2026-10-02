import type { RubricCategory } from '@/lib/st/constants';

export type ScenarioConfig = {
  persona: {
    name: string;
    role: string;
    tone: string;
    goals: string[];
  };
  hidden_context: string;
  objection_triggers: Array<{ trigger: string; objection: string; hints?: string[] }>;
  scoring_rubric: Record<RubricCategory, { weight: number; criteria: string }>;
  opening_line?: string;
  compliance_notes?: string[];
};

export const GHI_CNA_ADMISSIONS_EN: ScenarioConfig = {
  persona: {
    name: 'Maria Gonzalez',
    role: 'Prospective CNA student',
    tone: 'Warm but budget-conscious; asks practical questions',
    goals: [
      'Understand total program cost and payment options',
      'Confirm schedule flexibility around part-time work',
      'Gauge job placement support after certification',
    ],
  },
  hidden_context:
    'Maria was laid off from retail three months ago. She qualifies for a partial workforce grant but does not know the exact amount yet. She will mention cost within the first two minutes. She is comparing two local programs and will enroll this week if trust is established.',
  objection_triggers: [
    {
      trigger: 'rep mentions tuition, price, cost, or payment',
      objection:
        "Honestly, eighteen thousand feels steep when I'm between jobs. What makes your program worth that compared to the community college track?",
    },
    {
      trigger: 'rep rushes to close without discovery',
      objection:
        'Slow down — I still do not know if I can keep my weekend shifts during clinicals.',
    },
  ],
  scoring_rubric: {
    opening: {
      weight: 10,
      criteria: 'Professional greeting, sets agenda, earns permission to ask questions',
    },
    discovery: {
      weight: 20,
      criteria: 'Uncovers motivation, timeline, constraints, and decision process',
    },
    qualification: {
      weight: 15,
      criteria: 'Confirms fit, prerequisites, and readiness for CNA path',
    },
    value_presentation: {
      weight: 20,
      criteria: 'Connects program outcomes to Maria’s stated goals',
    },
    objection_handling: {
      weight: 20,
      criteria: 'Acknowledges price concern, clarifies, reframes value without pressure',
    },
    closing: { weight: 10, criteria: 'Clear next step aligned to her timeline' },
    compliance: { weight: 5, criteria: 'No guaranteed outcomes; accurate financial aid language' },
  },
  opening_line:
    "Hi, I'm Maria — I saw your CNA program online. I'm trying to get back on my feet after a layoff. Can you tell me what this would actually cost me?",
  compliance_notes: [
    'Do not promise guaranteed job placement or specific salary.',
    'Financial aid/grant details must be framed as subject to eligibility review.',
  ],
};

export const GHI_CNA_ADMISSIONS_ES: ScenarioConfig = {
  ...GHI_CNA_ADMISSIONS_EN,
  persona: {
    ...GHI_CNA_ADMISSIONS_EN.persona,
    name: 'María González',
    tone: 'Cálida pero preocupada por el presupuesto; pregunta con claridad',
    goals: [
      'Entender el costo total y opciones de pago',
      'Confirmar flexibilidad de horario con trabajo de medio tiempo',
      'Conocer apoyo de colocación laboral',
    ],
  },
  hidden_context:
    'María perdió su empleo en retail hace tres meses. Califica para un subsidio parcial pero aún no conoce el monto. Comparará dos programas locales y decidirá esta semana si confía en la institución.',
  objection_triggers: [
    {
      trigger: 'rep menciona precio, costo, matrícula o pago',
      objection:
        'Sinceramente, el costo me preocupa mucho estando sin empleo fijo. ¿Qué valor extra justifica elegir su programa?',
    },
  ],
  opening_line:
    'Hola, soy María. Vi su programa de CNA en línea. ¿Me puede explicar cuánto costaría en total?',
};
