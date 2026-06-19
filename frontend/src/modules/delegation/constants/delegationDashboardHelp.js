// Contextual-help content for the Delegation Dashboard. SINGLE source of truth
// for every KPI tile, summary metric and chart explanation — consumed by
// <MetricInfoTooltip>. Keep keys in sync with the elements rendered in
// DelegationDashboardPage.jsx. Pure data (no JSX) so it stays trivially testable
// and easy to extend.
//
// Each entry:
//   title          — popover heading
//   whatItShows     — plain-language description
//   calculation     — how the value is derived (mirrors the backend aggregation)
//   whyItMatters    — the business reason to care
//   recommendation  — the action a manager should take
//   example         — a concrete interpretation
//   interpret       — (complex charts only) "How to interpret" bullet lines

export const DELEGATION_HELP = {
  // ─── KPI cards ──────────────────────────────────────────────────────────────
  active: {
    title: 'Active Delegations',
    whatItShows: 'Every delegation still in flight — not yet completed or cancelled.',
    calculation: 'Sum of Created, Assigned, In Progress, In Review and Reopened.',
    whyItMatters: 'This is your true open workload — the basis for judging whether the team is keeping up.',
    recommendation: 'If Active keeps climbing while Completed stays flat, capacity is your constraint.',
    example: 'Active 4 with Completed 2 means most recent work is still open.',
  },
  pending: {
    title: 'Pending',
    whatItShows: 'Work that exists but has not started yet.',
    calculation: 'Count of delegations with status Created or Assigned.',
    whyItMatters: 'A growing queue means new work is arriving faster than it is being started.',
    recommendation: 'Assign owners and start the oldest items first.',
    example: 'Pending 3 means three delegations are waiting for someone to begin.',
  },
  inProgress: {
    title: 'In Progress',
    whatItShows: 'Delegations actively being worked on right now.',
    calculation: 'Count of delegations with status In Progress.',
    whyItMatters: 'Represents work currently in motion — your live throughput.',
    recommendation: 'Watch for items that sit here too long (cross-check the Aging panel).',
    example: 'In Progress 1 means only one delegation is actively moving.',
  },
  inReview: {
    title: 'In Review',
    whatItShows: 'Finished work waiting for approval or sign-off.',
    calculation: 'Count of delegations with status Review.',
    whyItMatters: "Reviews are a common bottleneck — work that's done but not yet 'delivered'.",
    recommendation: 'If this stays high, reviewers are the constraint, not the doers.',
    example: 'In Review 0 means nothing is currently stuck awaiting approval.',
  },
  overdue: {
    title: 'Overdue',
    whatItShows: 'Open delegations whose due date has already passed.',
    calculation: 'Due Date < Current Date AND Status not Completed/Cancelled.',
    whyItMatters: 'Represents missed commitments and SLA risk.',
    recommendation: 'Prioritise these immediately; cross-check Attention Required.',
    example: 'If Overdue = 15 and Due in 3 Days = 20, the backlog will very likely keep growing.',
  },
  completed: {
    title: 'Completed',
    whatItShows: 'Delegations marked complete within your visibility.',
    calculation: 'Count of delegations with status Completed.',
    whyItMatters: 'Your delivery volume; the throughput numerator that pairs with Completion Rate.',
    recommendation: 'Track alongside Active to see whether output keeps up with intake.',
    example: 'Completed 2 of 8 total is a 25% completion rate.',
  },

  // ─── Summary metrics ─────────────────────────────────────────────────────────
  completionRate: {
    title: 'Completion Rate',
    whatItShows: 'Share of all delegations that have been completed.',
    calculation: 'Completed ÷ Total × 100. Total includes cancelled delegations.',
    whyItMatters: 'A simple measure of execution efficiency across the whole book of work.',
    recommendation: 'Investigate a falling rate — remember cancellations lower it too.',
    example: '2 completed out of 8 total = 25%.',
  },
  avgCycleTime: {
    title: 'Avg Cycle Time',
    whatItShows: 'Average time a delegation takes from creation to completion.',
    calculation: 'Average of (Completed date − Created date) across completed work, in days.',
    whyItMatters: 'Shows how long work takes end-to-end — a proxy for process friction.',
    recommendation: 'Rising cycle time means work is getting stuck; compare with the Aging panel.',
    example: '0 days means recent items were completed the same day they were created.',
  },
  onTimeDelivery: {
    title: 'On-Time Delivery',
    whatItShows: 'Share of completed work delivered on or before its due date.',
    calculation: 'On-time completions ÷ completed items that had a due date × 100.',
    whyItMatters: 'Measures reliability against the commitments you set.',
    recommendation: 'Pair a low value with the Overdue tile to find where slippage happens.',
    example: '50% means half of dated completions landed late. Items completed without a due date are excluded.',
  },
  dueSoon: {
    title: 'Due in 3 Days',
    whatItShows: 'Open work due within the next 3 days.',
    calculation: 'Open delegations with a due date between now and now + 3 days.',
    whyItMatters: 'An early-warning list before these items become Overdue.',
    recommendation: 'Clear or reprioritise these now to prevent new overdue items.',
    example: 'Due in 3 Days = 3 means three items need attention this week.',
  },

  // ─── Charts ──────────────────────────────────────────────────────────────────
  workloadTrend: {
    title: 'Workload Trend',
    whatItShows: 'Delegations created vs completed each day over the last 14 days.',
    calculation: 'Created counts by creation date; Completed counts by completion date. Every day is shown, zero-filled.',
    whyItMatters: 'Shows momentum — whether the team is keeping pace with incoming work.',
    recommendation: 'Plan capacity when the Created line consistently sits above Completed.',
    example: 'A widening gap with Created on top means the backlog is growing.',
    interpret: [
      'Created > Completed consistently → backlog is growing.',
      'Completed > Created consistently → team is reducing backlog.',
      'Large spikes → unusual delegation volume worth investigating.',
    ],
  },
  statusMix: {
    title: 'Status Mix',
    whatItShows: 'How all in-scope delegations are distributed across lifecycle statuses.',
    calculation: 'Count of delegations grouped by status; the centre shows the total.',
    whyItMatters: 'Reveals where work piles up in the lifecycle.',
    recommendation: 'A large Review or Reopened slice points to a process bottleneck.',
    example: 'If Review is the biggest slice, approvals are slowing everything down.',
    interpret: [
      'Large In Progress / Review slice → work is piling up mid-pipeline.',
      'Large Reopened slice → quality or rework problems.',
      'Large Completed slice → healthy throughput.',
    ],
  },
  attention: {
    title: 'Attention Required',
    whatItShows: 'Open delegations that are overdue or due within 3 days, soonest first.',
    calculation: 'Open work with a due date on or before 3 days from now. Red = overdue, amber = due soon (up to 8 shown).',
    whyItMatters: 'Your single actionable worklist for what is at risk right now.',
    recommendation: 'Work this list top-down; each row links straight to its delegation.',
    example: 'Red rows are already late; amber rows still have time.',
  },
  departmentWorkload: {
    title: 'Department Workload',
    whatItShows: 'Open delegations grouped by department.',
    calculation: "Count of open delegations per department; 'Unassigned' has no department set.",
    whyItMatters: 'Shows where the open load is concentrated across teams.',
    recommendation: 'Rebalance or add support where one department dominates.',
    example: 'One department holding most of the bars signals an uneven distribution.',
    interpret: [
      'One tall bar → that department is overloaded.',
      "Large 'Unassigned' bar → work is not being routed to a team.",
      'Even bars → load is well distributed.',
    ],
  },
  topAssignees: {
    title: 'Top Assignees',
    whatItShows: 'The people carrying the most open work (top 6).',
    calculation: 'Count of open delegations per assignee, ranked highest first.',
    whyItMatters: 'Surfaces individual overload and uneven distribution.',
    recommendation: 'Reassign from the busiest people before they become a bottleneck.',
    example: 'One person far above the rest is a burnout and delivery risk.',
    interpret: [
      'One person far above the rest → overloaded individual.',
      "A large 'Unassigned' bar → unowned work needs routing.",
      'Even bars → balanced workload.',
    ],
  },
  priority: {
    title: 'Priority (Open)',
    whatItShows: 'Open work broken down by priority (Urgent, High, Medium, Low).',
    calculation: 'Count of open delegations grouped by priority, shown as a share bar and rows.',
    whyItMatters: 'Tells you how much of the open load is genuinely urgent.',
    recommendation: 'If Urgent/High dominate, focus the team there first.',
    example: 'A wide Urgent segment means a lot of high-pressure work is open.',
  },
  aging: {
    title: 'Aging (Open)',
    whatItShows: 'How long open delegations have been sitting, by age since creation.',
    calculation: 'Open work bucketed by creation age: 0–2 days, 3–7 days, 8–14 days, 15+ days.',
    whyItMatters: 'Old open work is the clearest sign of a stalling backlog.',
    recommendation: 'Investigate anything in 15+ days — it is likely stuck.',
    example: "A fat '15+ days' bar means work is aging without progress.",
    interpret: [
      'Most work in 0–2 days → healthy, fresh pipeline.',
      'Growing 8–14d / 15+ bars → work is stalling.',
      'A large 15+ days bar → backlog needs a clean-up.',
    ],
  },
  recentActivity: {
    title: 'Recent Activity',
    whatItShows: 'The latest actions taken across your delegations.',
    calculation: 'The 10 most recent audit-log entries (creates, assignments, status changes, comments).',
    whyItMatters: 'A live pulse of what is happening without opening each delegation.',
    recommendation: 'Use it to spot stalls — long gaps mean nothing is moving.',
    example: 'A burst of status changes shows active progress today.',
  },
};

export default DELEGATION_HELP;
