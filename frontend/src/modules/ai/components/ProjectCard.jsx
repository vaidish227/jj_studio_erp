import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

const ProjectCard = ({ project }) => {
  const navigate = useNavigate();
  if (!project) return null;
  const onOpen = () => project.url && navigate(project.url);

  const total = project.tasks?.total ?? 0;
  const overdue = project.tasks?.overdue ?? 0;
  const approvals = project.clientApprovals;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left w-full bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2.5 hover:border-[var(--primary,#D4B76C)] transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-[var(--text-muted,#A0A0A0)]">{project.trackingId}</div>
          <div className="text-sm font-medium text-[var(--text,#2E2E2E)] truncate">{project.name}</div>
        </div>
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg,#F8F7F3)] text-[var(--text,#2E2E2E)]">
          {project.status?.replace(/_/g, ' ')}
        </span>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-[var(--text-muted,#A0A0A0)]">
        <span>Tasks: <strong className="text-[var(--text,#2E2E2E)]">{total}</strong></span>
        {overdue > 0 && (
          <span className="inline-flex items-center gap-1 text-red-600">
            <AlertTriangle className="w-3 h-3" /> {overdue} overdue
          </span>
        )}
        {approvals && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {approvals.obtained}/{approvals.total} approvals
          </span>
        )}
        {project.team && project.team.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {project.team.length} team
          </span>
        )}
      </div>

      {project.team && project.team.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {project.team.slice(0, 4).map((m) => (
            <span key={m.id + m.label} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg,#F8F7F3)] text-[var(--text,#2E2E2E)]">
              {m.label}: {m.name}
            </span>
          ))}
        </div>
      )}
    </button>
  );
};

export default ProjectCard;
