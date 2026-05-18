import React from 'react';
import { CheckSquare, FileText, Users, BarChart2 } from 'lucide-react';
import { DashboardCard } from '../../../../shared/components';
import KickstartChecklist from '../KickstartChecklist';
import ClientApprovalTracker from '../ClientApprovalTracker';

const OverviewTab = ({ project, tasks, drawings, onProjectUpdated }) => {
  if (!project) return null;

  const taskCounts = {
    total:       tasks.length,
    completed:   tasks.filter((t) => t.status === 'completed').length,
    inProgress:  tasks.filter((t) => t.status === 'in_progress').length,
    overdue:     tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length,
  };

  const drawingCounts = {
    total:    drawings.length,
    approved: drawings.filter((d) => d.status === 'approved' || d.status === 'released_to_site').length,
    pending:  drawings.filter((d) => d.status === 'sent_for_approval').length,
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Total Tasks"
          value={taskCounts.total}
          icon={CheckSquare}
          iconBg="bg-[var(--primary)]/10"
          compact
        />
        <DashboardCard
          title="Completed"
          value={taskCounts.completed}
          icon={CheckSquare}
          iconBg="bg-[var(--success)]/10"
          compact
        />
        <DashboardCard
          title="Total Drawings"
          value={drawingCounts.total}
          icon={FileText}
          iconBg="bg-[var(--accent-blue)]/10"
          compact
        />
        <DashboardCard
          title="Drawings Approved"
          value={drawingCounts.approved}
          icon={BarChart2}
          iconBg="bg-[var(--accent-teal)]/10"
          compact
        />
      </div>

      {/* Kickstart + Client Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KickstartChecklist
          projectId={project._id}
          kickstartData={project.kickstartData || {}}
          onUpdated={onProjectUpdated}
        />
        <ClientApprovalTracker
          projectId={project._id}
          approvals={project.clientApprovals || []}
          onUpdated={onProjectUpdated}
        />
      </div>

      {/* Project notes */}
      {project.notes && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{project.notes}</p>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
