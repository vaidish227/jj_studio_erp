/**
 * aiEntryPoints — a single, declarative registry of the contextual AI
 * affordances available across the app. Each page imports its slice instead of
 * hardcoding prompt strings inline, so all prompts are reviewable/tunable in one
 * place and adding a new entry point is a one-file edit.
 *
 * Shape per page key:
 *   {
 *     hint?:    { title, examples: string[] }       // for <AIHintBanner/>
 *     actions?: Array<{ label, prompt, icon? }>      // for <AskAIButton actions/>
 *   }
 *
 * `prompt` may be a string or a function of a context object: (ctx) => string.
 * Pages call `resolveEntry(key, ctx)` to get concrete strings to hand the
 * components. Keep prompts phrased as natural user requests — the assistant's
 * system prompt handles tool routing, disambiguation and the write-confirm gate.
 */

export const AI_ENTRY_POINTS = {
  // ── Proposals ──────────────────────────────────────────────────────────────
  proposalCreate: {
    hint: {
      title: 'AI can draft this proposal for you',
      examples: ['Draft from the lead’s requirements', 'Apply a saved template', 'Add line items & totals'],
    },
    actions: [
      {
        label: 'Draft this proposal with AI',
        prompt: (ctx) =>
          ctx?.leadName
            ? `Draft a proposal for ${ctx.leadName}${ctx.trackingId ? ` (${ctx.trackingId})` : ''}. Ask me for the scope and line items, then build it.`
            : 'Help me draft a new proposal. Ask me which lead it is for and what to include.',
      },
    ],
  },

  // ── Lead details hub ─────────────────────────────────────────────────────────
  leadDetails: {
    actions: [
      {
        label: 'Ask AI about this lead',
        prompt: (ctx) => `Give me a quick summary of lead ${ctx?.leadName || ''}${ctx?.trackingId ? ` (${ctx.trackingId})` : ''} — status, recent activity and what to do next.`,
      },
      {
        label: 'Schedule a meeting',
        prompt: (ctx) => `Schedule a meeting with ${ctx?.leadName || 'this lead'}${ctx?.trackingId ? ` (${ctx.trackingId})` : ''}.`,
      },
      {
        label: 'Add a follow-up',
        prompt: (ctx) => `Add a follow-up reminder for ${ctx?.leadName || 'this lead'}${ctx?.trackingId ? ` (${ctx.trackingId})` : ''}.`,
      },
      {
        label: 'Draft a proposal',
        prompt: (ctx) => `Draft a proposal for ${ctx?.leadName || 'this lead'}${ctx?.trackingId ? ` (${ctx.trackingId})` : ''}.`,
      },
    ],
  },

  // ── Dashboard ────────────────────────────────────────────────────────────────
  dashboard: {
    hint: {
      title: 'Ask AI about your pipeline',
      examples: ['What are my pending follow-ups?', "What's in my sales pipeline?", 'How many leads converted this month?'],
    },
    actions: [
      { label: "Today's follow-ups", prompt: 'What follow-ups do I have due today and which are overdue?' },
      { label: 'My sales pipeline', prompt: 'Give me a snapshot of my sales pipeline right now.' },
      { label: 'Pipeline summary', prompt: 'Summarize my dashboard stats — leads, conversions, and what needs attention.' },
    ],
  },
};

/**
 * Resolve a registry entry against a context object, turning any function
 * prompts into concrete strings. Returns { hint, actions } ready for the
 * components, or an empty object for an unknown key.
 */
export function resolveEntry(key, ctx = {}) {
  const entry = AI_ENTRY_POINTS[key];
  if (!entry) return {};
  return {
    hint: entry.hint,
    actions: (entry.actions || []).map((a) => ({
      ...a,
      prompt: typeof a.prompt === 'function' ? a.prompt(ctx) : a.prompt,
    })),
  };
}

export default AI_ENTRY_POINTS;
