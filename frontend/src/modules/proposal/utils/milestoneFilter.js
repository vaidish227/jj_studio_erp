// Shared "milestone reached" predicates so the dashboard cards and the
// `?milestone=...` filter on ProposalListPage agree on what counts.
// A proposal counts toward a milestone if it's currently at that status OR
// has progressed past it — the backend auto-promotes (e.g. esign + advance →
// project_ready), so exact-status counts would otherwise drop to zero
// the moment a proposal moves further along the pipeline.

const POST_SENT     = ['sent', 'esign_received', 'payment_received', 'project_ready', 'project_started'];
const POST_ESIGN    = ['esign_received', 'payment_received', 'project_ready', 'project_started'];
const POST_PAYMENT  = ['payment_received', 'project_ready', 'project_started'];
const POST_APPROVED = ['manager_approved', ...POST_SENT];

export const MILESTONE_LABELS = {
  pending_approval: 'Pending Approval',
  approved:         'Approved',
  rejected:         'Rejected',
  sent:             'Sent to Client',
  esign:            'eSign Received',
  advance:          'Advance Paid',
};

export const matchesMilestone = (proposal, milestone) => {
  if (!proposal) return false;
  switch (milestone) {
    case 'pending_approval':
      return proposal.status === 'pending_approval';
    case 'approved':
      return Boolean(proposal.approved_by) || POST_APPROVED.includes(proposal.status);
    case 'rejected':
      return proposal.status === 'rejected';
    case 'sent':
      return POST_SENT.includes(proposal.status);
    case 'esign':
      return proposal.esign?.status === 'received' || POST_ESIGN.includes(proposal.status);
    case 'advance':
      return proposal.payments?.status === 'received' || POST_PAYMENT.includes(proposal.status);
    default:
      return true; // unknown / no milestone = no filter
  }
};

export const filterByMilestone = (proposals, milestone) => {
  if (!milestone) return proposals;
  return proposals.filter((p) => matchesMilestone(p, milestone));
};
