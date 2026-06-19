// Contextual-help content for the Designer KPI / KRA scoreboard. SINGLE source
// of truth for the methodology shown to users via <MetricInfoTooltip> — keep it
// in sync with the backend calculation in
// backend/src/modules/pms/controllers/DashboardOverview.controller.js
// (getDesignerKRA → the 0.45 / 0.35 / 0.20 weighted score).
//
// Pure data (no JSX) so it stays trivially testable and easy to extend.
// Each entry mirrors the shape <MetricInfoTooltip> consumes:
//   title · whatItShows · calculation · whyItMatters · recommendation
//   · example · interpret[] (bullet lines under "How to interpret")

export const DESIGNER_KRA_HELP = {
  // ─── The headline KRA score ──────────────────────────────────────────────────
  kraScore: {
    title: 'KRA Score (0–5)',
    whatItShows:
      "A single performance grade for each designer, calculated automatically from their task delivery — no manual scoring. It blends quality, reliability and output into one number.",
    calculation:
      'KRA = (0.45 × On-Time Rate + 0.35 × First-Pass Rate + 0.20 × Throughput) × 5',
    whyItMatters:
      "It lets you rank and compare designers fairly on the same scale and spot who needs support — reliability (45%) and quality (35%) count for more than raw volume (20%).",
    recommendation:
      'Use it to start a conversation, not to conclude one — always open the designer detail to see which of the three drivers is pulling the score up or down.',
    example:
      'A designer who delivers 90% on-time, gets 80% approved first time, and has solid volume scores around 4.1 / 5 (green).',
    interpret: [
      'Green ≥ 4.0 — strong, consistent performer.',
      'Amber 3.0–3.9 — acceptable but has a clear weak driver to fix.',
      'Red < 3.0 — needs attention; check whether it is on-time, first-pass, or volume dragging it down.',
      'Only tasks that finished inside the selected period count — a short period with little delivered work can swing the score.',
    ],
  },

  // ─── Component KPIs ──────────────────────────────────────────────────────────
  onTime: {
    title: 'On-Time Rate (45% of KRA)',
    whatItShows:
      'The share of a designer\'s delivered tasks that were completed on or before their due date.',
    calculation:
      'On-Time Rate = (tasks delivered where completion date ≤ due date) ÷ total tasks delivered',
    whyItMatters:
      'Reliability is the single biggest driver of the KRA score — late delivery cascades into every downstream stage and client commitment.',
    recommendation:
      'If on-time is low but first-pass is high, the work is good but estimates/capacity are off — re-check workload and deadlines.',
    example: '18 of 20 delivered tasks hit their due date → 90% on-time.',
    interpret: [
      'Tasks with no due date set are NOT counted as on-time — they only contribute to throughput. Missing due dates quietly lower this number.',
      'Completion is the approval / release date, not when work merely felt "done".',
    ],
  },
  firstPass: {
    title: 'First-Pass Rate (35% of KRA)',
    whatItShows:
      'The share of delivered tasks that were approved without any revision being requested.',
    calculation:
      'First-Pass Rate = (delivered tasks with no revision requested) ÷ total tasks delivered',
    whyItMatters:
      'It is the quality signal — work that passes review the first time saves rework cycles for the whole team and the reviewer.',
    recommendation:
      'A low first-pass rate points to a quality or brief-clarity gap, not a speed problem — review standards, references, or onboarding.',
    example: '16 of 20 delivered tasks were approved with zero revisions → 80% first-pass.',
    interpret: [
      'A task counts as a "miss" if a revision was ever requested on it, even if it was eventually approved.',
      'High first-pass with low on-time usually means careful but slow; low first-pass with high on-time means fast but rushed.',
    ],
  },
  throughput: {
    title: 'Throughput (20% of KRA)',
    whatItShows:
      'How much a designer delivered relative to the team — output volume, scored against the top performer.',
    calculation:
      'Throughput = this designer\'s delivered count ÷ the highest delivered count on the team (so #1 = 1.0)',
    whyItMatters:
      'It rewards productivity, but is deliberately the smallest weight (20%) so volume alone cannot mask poor quality or lateness.',
    recommendation:
      'Read throughput together with active workload — a low score can mean limited capacity or fewer assignments, not under-performance.',
    example:
      'If the busiest designer delivered 25 tasks and this one delivered 15, their throughput contribution is 15 ÷ 25 = 0.60.',
    interpret: [
      'Because it is relative to the team, everyone\'s throughput shifts as the busiest person\'s volume changes.',
      'On a single designer\'s detail page, throughput is instead measured against a fixed baseline, so that page may differ slightly from the leaderboard.',
    ],
  },

  // ─── Summary tiles on the full scoreboard page ───────────────────────────────
  avgKra: {
    title: 'Team Average KRA',
    whatItShows: 'The mean KRA score across every designer active in the selected period.',
    calculation: 'Average of all listed designers\' KRA scores (0–5).',
    whyItMatters: 'A quick health read on the whole design team — and a baseline to judge individuals against.',
    recommendation: 'Track the trend across periods; a falling team average usually signals a capacity or process issue, not individuals.',
    example: 'An average of 3.8 / 5 means the team is solid overall with room to push more deliveries on-time.',
  },
};
