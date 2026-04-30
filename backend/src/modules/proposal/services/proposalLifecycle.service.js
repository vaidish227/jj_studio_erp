const Lead = require("../../crm/models/Lead.model");
const ProposalStatusHistory = require("../models/ProposalStatusHistory.model");

const ALLOWED_TRANSITIONS = {
  draft: ["pending_approval"],
  pending_approval: ["approved", "rejected"],
  rejected: ["draft"],
  approved: ["sent"],
  sent: ["esign_received", "rejected"],
  esign_received: ["advance_received"],
  advance_received: ["converted"],
  converted: [],
};

const mapLeadState = (proposalStatus) => {
  switch (proposalStatus) {
    case "sent":
      return { status: "proposal_sent", lifecycleStage: "proposal_sent" };
    case "advance_received":
      return { status: "converted", lifecycleStage: "advance_received" };
    case "converted":
      return { status: "converted", lifecycleStage: "converted" };
    default:
      return null;
  }
};

const isTransitionAllowed = (from, to) => {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
};

const recordStatusChange = async ({ proposal, fromStatus, toStatus, changedBy, reason, metadata = {} }) => {
  await ProposalStatusHistory.create({
    proposalId: proposal._id,
    fromStatus,
    toStatus,
    changedBy: changedBy || null,
    reason: reason || "",
    metadata,
    changedAt: new Date(),
  });

  const leadState = mapLeadState(toStatus);
  if (leadState) {
    await Lead.findByIdAndUpdate(proposal.leadId, {
      ...leadState,
      $push: {
        interactionHistory: {
          type: "status_change",
          title: "Proposal lifecycle updated",
          description: `Proposal moved to ${toStatus.replace(/_/g, " ")}.`,
          createdAt: new Date(),
        },
      },
    });
  }
};

module.exports = { isTransitionAllowed, recordStatusChange };
