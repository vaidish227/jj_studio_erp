import React from 'react';
import ClientApprovalTracker from '../ClientApprovalTracker';

const ClientApprovalsTab = ({ project, onUpdated }) => {
  if (!project) return null;

  return (
    <ClientApprovalTracker
      project={project}
      projectId={project._id}
      approvals={project.clientApprovals || []}
      onUpdated={onUpdated}
      layout="grid"
    />
  );
};

export default ClientApprovalsTab;
