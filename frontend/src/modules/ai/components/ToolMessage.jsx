import React from 'react';
import {
  Loader2, AlertCircle, CheckCircle2,
  ListTodo, Search, FileText, Clock, ClipboardList, LayoutDashboard, Activity, Users, Calendar,
} from 'lucide-react';
import TaskCard from './TaskCard';
import ProjectCard from './ProjectCard';
import DashboardCard from './DashboardCard';
import ChecklistCard from './ChecklistCard';
import LeadCard from './LeadCard';
import MeetingCard from './MeetingCard';
import ProjectListCard from './ProjectListCard';
import ActivityCard from './ActivityCard';
import ActionConfirmCard from './ActionConfirmCard';

// Human-friendly labels + icons for each tool, used by the inline chip.
const TOOL_META = {
  getMyTasks:           { label: 'My tasks',            Icon: ListTodo },
  getTaskDetails:       { label: 'Task details',        Icon: FileText },
  getOverdueTasks:      { label: 'Overdue tasks',       Icon: Clock },
  getChecklist:         { label: 'Checklist',           Icon: ClipboardList },
  getProjectSummary:    { label: 'Project summary',     Icon: FileText },
  getDesignerDashboard: { label: 'Dashboard',           Icon: LayoutDashboard },
  searchProjects:       { label: 'Project search',      Icon: Search },
  searchActivity:       { label: 'Recent activity',     Icon: Activity },
  getLeads:             { label: 'Leads',               Icon: Users },
  getClients:           { label: 'Clients',             Icon: Users },
  getMeetings:          { label: 'Meetings',            Icon: Calendar },
  // Write tools — tasks (V3.1)
  updateTaskStatus:     { label: 'Update task status',     Icon: FileText, isWrite: true },
  toggleChecklistItem:  { label: 'Tick checklist item',    Icon: ClipboardList, isWrite: true },
  reassignTask:         { label: 'Reassign task',          Icon: Users, isWrite: true },
  requestTaskRevision:  { label: 'Request revision',       Icon: FileText, isWrite: true },
  addTaskNote:          { label: 'Add task note',          Icon: FileText, isWrite: true },
  // Write tools — drawings, CRM, projects (V3.2)
  approveDrawing:       { label: 'Approve drawing',        Icon: FileText, isWrite: true },
  rejectDrawing:        { label: 'Reject drawing',         Icon: FileText, isWrite: true },
  releaseDrawing:       { label: 'Release drawing',        Icon: FileText, isWrite: true },
  updateLeadStatus:     { label: 'Update lead status',     Icon: Users, isWrite: true },
  addFollowUp:          { label: 'Schedule follow-up',     Icon: Clock, isWrite: true },
  assignLead:           { label: 'Assign lead',            Icon: Users, isWrite: true },
  addLeadNote:          { label: 'Add lead note',          Icon: FileText, isWrite: true },
  scheduleMeeting:      { label: 'Schedule meeting',       Icon: Clock, isWrite: true },
  updateProjectStatus:  { label: 'Update project status',  Icon: FileText, isWrite: true },
  updateClientApproval: { label: 'Update client approval', Icon: ClipboardList, isWrite: true },
};

/**
 * Renders an inline tool-call lifecycle:
 *   pending  -> spinner with a "Running getMyTasks..." label
 *   error    -> red banner
 *   ok       -> structured card based on uiHint
 */
const ToolMessage = ({ message }) => {
  const pending = message.role === 'tool_pending';
  const isError = message.status === 'error' || message.ok === false;
  const isProposal = message.uiHint === 'actionProposal' || message.status === 'pending_confirmation';
  const meta = TOOL_META[message.toolName] || { label: toolDisplayName(message.toolName), Icon: CheckCircle2 };
  const ToolIcon = meta.Icon;

  if (pending) {
    return (
      <div className="pl-9">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted,#A0A0A0)] bg-[var(--bg,#F8F7F3)] rounded-full px-2 py-0.5 border border-[var(--border,#e5e5e5)]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <ToolIcon className="w-3 h-3" />
          <span>{meta.label}…</span>
        </span>
      </div>
    );
  }

  if (isError && !isProposal) {
    return (
      <div className="pl-9 flex items-start gap-2 text-xs">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-red-500 flex-shrink-0" />
        <div className="min-w-0">
          <span className="font-medium text-red-700">{meta.label}</span>
          <span className="text-[var(--text-muted,#A0A0A0)]"> · {message.summaryText || message.error || 'Failed'}</span>
        </div>
      </div>
    );
  }

  // Write-tool proposal → render the confirm/cancel card instead of a result.
  if (isProposal) {
    return (
      <div className="pl-9">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted,#A0A0A0)] bg-[var(--bg,#F8F7F3)] rounded-full px-2 py-0.5 border border-[var(--border,#e5e5e5)] mb-1.5">
          <ToolIcon className="w-3 h-3 text-amber-600" />
          <span className="font-medium text-[var(--text,#2E2E2E)]">{meta.label}</span>
          <span className="opacity-80"> · proposed</span>
        </div>
        <ActionConfirmCard message={message} />
      </div>
    );
  }

  const isEmpty = !message.data
    || (Array.isArray(message.data) && message.data.length === 0)
    || (message.uiHint === 'dashboard' && !message.data.totalAssigned && !message.data.upcoming?.length);

  return (
    <div className="pl-9">
      <div className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted,#A0A0A0)] bg-[var(--bg,#F8F7F3)] rounded-full px-2 py-0.5 border border-[var(--border,#e5e5e5)] mb-1.5">
        <ToolIcon className="w-3 h-3 text-[var(--accent-teal,#4A8F7C)]" />
        <span className="font-medium text-[var(--text,#2E2E2E)]">{meta.label}</span>
        {message.summaryText && <span className="opacity-80"> · {message.summaryText}</span>}
      </div>
      {isEmpty ? (
        <EmptyResult hint={message.uiHint} toolName={message.toolName} summary={message.summaryText} />
      ) : (
        <RenderByHint hint={message.uiHint} data={message.data} message={message} />
      )}
    </div>
  );
};

function EmptyResult({ hint, toolName, summary }) {
  const messages = {
    taskList:      { headline: 'All clear', subline: summary || "You don't have any tasks in that filter." },
    taskDetails:   { headline: 'Not found', subline: summary || 'No task matched that ID.' },
    checklist:     { headline: 'No checklist', subline: 'This task has no checklist items.' },
    projectSummary:{ headline: 'No data', subline: summary || 'Nothing to summarize for that project.' },
    dashboard:     { headline: 'Empty dashboard', subline: 'No tasks assigned to you yet.' },
    leadList:      { headline: 'No leads', subline: summary || 'Nothing in the funnel right now.' },
    clientList:    { headline: 'No clients', subline: summary || 'No converted clients found.' },
    meetingList:   { headline: 'No meetings', subline: summary || 'Nothing on the calendar for that filter.' },
    projectList:   { headline: 'No projects', subline: summary || 'No projects matched your filters.' },
    activityList:  { headline: 'No activity', subline: summary || 'No actions in that time window.' },
  };
  const m = messages[hint] || { headline: 'No results', subline: summary || 'The tool returned no data.' };
  return (
    <div className="bg-white border border-dashed border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2.5 text-xs">
      <div className="font-medium text-[var(--text,#2E2E2E)]">{m.headline}</div>
      <div className="text-[var(--text-muted,#A0A0A0)] mt-0.5">{m.subline}</div>
    </div>
  );
}

function RenderByHint({ hint, data, message }) {
  if (!data) return null;
  switch (hint) {
    case 'taskList':       return <TaskCard items={Array.isArray(data) ? data : []} />;
    case 'taskDetails':    return <TaskCard items={[data]} mode="details" />;
    case 'projectSummary': return <ProjectCard project={data} />;
    case 'dashboard':      return <DashboardCard dashboard={data} />;
    case 'checklist':      return <ChecklistCard checklist={data} />;
    case 'leadList':       return <LeadCard items={Array.isArray(data) ? data : []} total={message?.total} viewAllUrl={message?.viewAllUrl} />;
    case 'clientList':     return <LeadCard items={Array.isArray(data) ? data : []} total={message?.total} viewAllUrl={message?.viewAllUrl} />;
    case 'meetingList':    return <MeetingCard items={Array.isArray(data) ? data : []} total={message?.total} viewAllUrl={message?.viewAllUrl} />;
    case 'projectList':    return <ProjectListCard items={Array.isArray(data) ? data : []} />;
    case 'activityList':   return <ActivityCard items={Array.isArray(data) ? data : []} />;
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
