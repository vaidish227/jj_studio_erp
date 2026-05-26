import React from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import TaskCard from './TaskCard';
import ProjectCard from './ProjectCard';
import DashboardCard from './DashboardCard';
import ChecklistCard from './ChecklistCard';

/**
 * Renders an inline tool-call lifecycle:
 *   pending  -> spinner with a "Running getMyTasks..." label
 *   error    -> red banner
 *   ok       -> structured card based on uiHint
 */
const ToolMessage = ({ message }) => {
  const pending = message.role === 'tool_pending';
  const isError = message.status === 'error' || message.ok === false;

  if (pending) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted,#A0A0A0)] pl-9">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>
          {toolDisplayName(message.toolName)}
          <span className="opacity-70">…</span>
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="pl-9 flex items-start gap-2 text-xs">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-red-500" />
        <div>
          <span className="font-medium text-red-700">{toolDisplayName(message.toolName)}</span>
          <span className="text-[var(--text-muted,#A0A0A0)]"> · {message.summaryText || message.error || 'Failed'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-9">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted,#A0A0A0)] mb-1">
        <CheckCircle2 className="w-3 h-3 text-[var(--accent-teal,#4A8F7C)]" />
        <span>{toolDisplayName(message.toolName)}</span>
        {message.summaryText && <span className="opacity-80"> · {message.summaryText}</span>}
      </div>
      <RenderByHint hint={message.uiHint} data={message.data} />
    </div>
  );
};

function RenderByHint({ hint, data }) {
  if (!data) return null;
  switch (hint) {
    case 'taskList':       return <TaskCard items={Array.isArray(data) ? data : []} />;
    case 'taskDetails':    return <TaskCard items={[data]} mode="details" />;
    case 'projectSummary': return <ProjectCard project={data} />;
    case 'dashboard':      return <DashboardCard dashboard={data} />;
    case 'checklist':      return <ChecklistCard checklist={data} />;
    default:               return null;
  }
}

function toolDisplayName(name) {
  if (!name) return 'Tool';
  return name
    .replace(/^get/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default ToolMessage;
