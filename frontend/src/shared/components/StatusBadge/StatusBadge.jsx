import React from 'react';
import Badge from '../Badge/Badge';
import { lifecycleLabels, statusLabelMap } from '../../hooks/useLeadFlow';

const lifecycleVariants = {
  enquiry: 'primary',
  meeting_scheduled: 'today',
  thank_you_sent: 'success',
  client_info_pending: 'warning',
  kit: 'tomorrow',
  followup_due: 'warning',
  show_project: 'primary',
  interested: 'success',
  proposal_sent: 'today',
  advance_received: 'success',
  project_moved: 'success',
  converted: 'success',
  lost: 'error',
};

const statusVariants = {
  new: 'primary',
  contacted: 'today',
  meeting_done: 'warning',
  proposal_sent: 'success',
  converted: 'success',
  lost: 'error',
  // Proposal statuses
  draft: 'default',
  pending_approval: 'warning',
  manager_approved: 'success',
  rejected: 'error',
  sent: 'primary',
  esign_pending: 'warning',
  signed: 'success',
  // eSign specific statuses
  pending: 'warning',
  completed: 'success',
};

const StatusBadge = ({ value, type = 'status', className = '' }) => {
  const isLifecycle = type === 'lifecycle';
  const label = isLifecycle
    ? lifecycleLabels[value] || value
    : statusLabelMap[value] || value;

  return (
    <Badge
      label={label}
      variant={isLifecycle ? lifecycleVariants[value] || 'default' : statusVariants[value] || 'default'}
      className={className}
    />
  );
};

export default StatusBadge;
