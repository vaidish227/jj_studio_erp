import React from 'react';
import ClientApprovalTracker from '../ClientApprovalTracker';

const ClientApprovalsTab = ({ project, onUpdated }) => {
  if (!project) return null;

  return (
    <div className="max-w-xl">
      <ClientApprovalTracker
        project={project}
        projectId={project._id}
        approvals={project.clientApprovals || []}
        onUpdated={onUpdated}
      />
    </div>
  );
};

export default ClientApprovalsTab;
