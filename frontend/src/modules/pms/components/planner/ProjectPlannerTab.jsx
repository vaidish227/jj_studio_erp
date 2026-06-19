import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ClipboardList, ListChecks, CheckCircle2, AlertTriangle, Clock,
  Plus, RefreshCw, Search, Filter, Trash2, Loader2,
  Eye, History as HistoryIcon, X, ExternalLink, FileText, RotateCcw, ChevronRight,
  UserCog, CalendarRange, ArrowLeftRight, Zap, CheckSquare, Square,
  Upload, Replace, Calendar as CalendarIcon, UserPlus, MessageSquare,
  Rocket, Lock, Download, FileSpreadsheet, Layers, GitBranch, Settings,
} from 'lucide-react';
import { pmsService } from '../../../../shared/services/pmsService';
import { useAuth } from '../../../../shared/context/AuthContext';
import DatePicker from '../../../../shared/components/DatePicker/DatePicker';
import EmployeePicker from '../EmployeePicker';
import PreviewDrawingModal from '../PreviewDrawingModal';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import {
  StatCard, ModalShell, PRIORITY_OPTIONS, PRIORITY_BADGE,
  EditableTextCell, EditableNumberCell, EditablePriorityCell,
  EditableDurationCell, LockToggleCell,
  PhaseHeaderRow, AddDashedRow,
} from './sheetCells';
import { ScheduleStatusBadge, AutoShiftedIndicator } from './ScheduleBadges';
import SubtaskModal from './SubtaskModal';
import DependencyPicker from './DependencyPicker';
import ShiftHistoryModal from './ShiftHistoryModal';
import DelayReasonModal from './DelayReasonModal';
import SelectTemplateModal from './SelectTemplateModal';
import { taskTypeToDrawingType, buildDrawingUploadFormData } from '../../utils/workItem';
import { getAllAssignedUsers } from '../../utils/teamHelpers';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';
const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';
const fmtISO = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';

// Mirror of backend taskType enum (kept short — only drawing-producing types are
// shown by default; the rest are exposed through Tasks tab).
const TASK_TYPE_OPTIONS = [
  { value: 'technical_drawing',    label: 'Technical Drawing' },
  { value: 'civil_drawing',        label: 'Civil Drawing' },
  { value: 'furniture_layout',     label: 'Furniture Layout' },
  { value: 'kitchen_drawing',      label: 'Kitchen Drawing' },
  { value: 'bathroom_drawing',     label: 'Bathroom Drawing' },
  { value: 'ac_coordination',      label: 'AC Coordination' },
  { value: 'automation_coordination', label: 'Automation' },
  { value: '3d_render',            label: '3D Render' },
  { value: 'concept_making',       label: 'Concept' },
  { value: 'site_measurement',     label: 'Site Measurement' },
];

const STAGE_COLORS = {
  'Draft':                 'bg-[var(--border)] text-[var(--text-muted)]',
  'Not Started':           'bg-[var(--border)] text-[var(--text-secondary)]',
  'Blocked':               'bg-[var(--error)]/10 text-[var(--error)]',
  'In Progress':           'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  'Submitted for Review':  'bg-[var(--warning)]/10 text-[var(--warning)]',
  'Revision Required':     'bg-[var(--error)]/10 text-[var(--error)]',
  'Approved Internally':   'bg-[var(--success)]/10 text-[var(--success)]',
  'Pending Client Approval':'bg-[var(--warning)]/10 text-[var(--warning)]',
  'Released to Site':      'bg-[var(--primary)]/10 text-[var(--primary)]',
  'Completed':             'bg-[var(--success)]/10 text-[var(--success)]',
  'On Hold':               'bg-[var(--border)] text-[var(--text-muted)]',
};

const DRAWING_STATUS_LABEL = {
  draft:             { label: 'Draft',     cls: 'bg-[var(--border)] text-[var(--text-muted)]' },
  sent_for_approval: { label: 'In Review', cls: 'bg-[var(--warning)]/15 text-[var(--warning)]' },
  approved:          { label: 'Approved',  cls: 'bg-[var(--success)]/15 text-[var(--success)]' },
  rejected:          { label: 'Rejected',  cls: 'bg-[var(--error)]/15 text-[var(--error)]' },
  released_to_site:  { label: 'Released',  cls: 'bg-[var(--primary)]/15 text-[var(--primary)]' },
};

// A version row's Work Status + Progress are derived from THAT version's own
// drawing lifecycle so the row stays consistent with its Stage. (The snapshot's
// workStatus/progress reflect the task at upload time, which drifts once the
// version is later approved/rejected — e.g. an Approved version must not read
// "In Progress / 50%".)
const DRAWING_TO_WORKSTATUS = {
  draft:             'in_progress',
  sent_for_approval: 'in_progress',
  approved:          'completed',
  released_to_site:  'completed',
  rejected:          'in_progress',
};
const DRAWING_TO_PROGRESS = {
  draft:             50,
  sent_for_approval: 80,
  approved:          100,
  released_to_site:  100,
  rejected:          50,
};

const StageBadge = ({ stage }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${STAGE_COLORS[stage] || STAGE_COLORS.Draft}`}>
    {stage}
  </span>
);

const DelayBadge = ({ days }) => {
  if (!days || days <= 0) return <span className="text-[10px] text-[var(--text-muted)]">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--error)]">
      <AlertTriangle size={10} /> {days}d
    </span>
  );
};

const PlannerHeader = ({ project, plan, counters, template, canChangeTemplate, onChangeTemplate, onRefresh, onAddRow, onAutoSchedule, onActivate, onExport, onImport, onRecalculate, canRecalc, onOpenSettings, canEditPlanner, exporting, refreshing }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
    {/* Row 1 — title + meta on the left, primary actions on the right */}
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={18} className="text-[var(--warning)]" />
          <h2 className="text-base font-extrabold text-[var(--text-primary)]">Project Planner / Master Sheet</h2>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {project?.code ? `${project.code} · ` : ''}
          {project?.startDate ? fmt(project.startDate) : '—'} → {fmt(project?.estimatedCompletionDate)}
          {' · Phase: '}<span className="font-semibold text-[var(--text-secondary)]">{project?.phase || '—'}</span>
        </p>
        {template?.baseTemplateId && (
          <p className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
            <Layers size={11} className="text-[var(--primary)]" />
            Template:{' '}
            <span className="font-semibold text-[var(--text-secondary)]">
              {template.templateName || 'Workflow template'}
            </span>
            {template.customized && (
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded">
                Customized
              </span>
            )}
          </p>
        )}
        {plan?.effectiveAt && (
          <p className="text-[11px] text-[var(--success)] mt-1.5 flex items-center gap-1">
            <Lock size={11} className="shrink-0" /> Plan is effective — designer changes here will auto-notify the new owner.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end ml-auto">
        {plan?.effectiveAt ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--success)] border border-[var(--success)]/40 bg-[var(--success)]/10 rounded-lg whitespace-nowrap"
            title={`Plan locked on ${fmtDateTime(plan.effectiveAt)}`}
          >
            <Lock size={13} /> Plan Effective · {fmt(plan.effectiveAt)}
          </span>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-[var(--success)] rounded-lg hover:opacity-90 whitespace-nowrap"
            title="Delegate every assigned task and lock the plan baseline"
          >
            <Rocket size={13} /> Make Plan Effective
          </button>
        )}
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 whitespace-nowrap"
        >
          <Plus size={13} /> Add Drawing Row
        </button>
      </div>
    </div>

    {/* Row 2 — secondary toolbar */}
    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
      >
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={exporting}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
        title="Download every row as an Excel (.xlsx) file"
      >
        {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export
      </button>
      <button
        type="button"
        onClick={onImport}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)]"
        title="Bulk-update existing rows from an Excel file"
      >
        <FileSpreadsheet size={13} /> Import
      </button>
      {/* Auto-shift status indicator — reflects project.settings.autoShiftEnabled */}
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border whitespace-nowrap ${
          project?.settings?.autoShiftEnabled
            ? 'text-[var(--success)] border-[var(--success)]/40 bg-[var(--success)]/10'
            : 'text-[var(--text-muted)] border-[var(--border)] bg-[var(--bg)]'
        }`}
        title={project?.settings?.autoShiftEnabled
          ? 'Nightly auto-shift is ON for this project — overdue unlocked tasks shift automatically.'
          : 'Nightly auto-shift is OFF — dates only move when someone acts.'}
      >
        <Zap size={13} /> Auto-shift {project?.settings?.autoShiftEnabled ? 'ON' : 'OFF'}
        <span className="text-[var(--text-muted)] font-semibold">· {project?.settings?.calendarMode === 'working_days' ? 'Working days' : 'Calendar days'}</span>
      </span>
      {canEditPlanner && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)]"
          title="Scheduling settings (auto-shift, calendar mode)"
        >
          <Settings size={13} /> Settings
        </button>
      )}
      {canChangeTemplate && !plan?.effectiveAt && (
        <button
          type="button"
          onClick={onChangeTemplate}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)]"
          title="Choose or switch this project's master-sheet template (only this project is affected)"
        >
          <Layers size={13} /> Select Template
        </button>
      )}
      {canRecalc && (
        <button
          type="button"
          onClick={onRecalculate}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] ml-auto"
          title="Re-derive planned dates from project start, durations and dependencies"
        >
          <RefreshCw size={13} /> Recalculate
        </button>
      )}
      <button
        type="button"
        onClick={onAutoSchedule}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--primary)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 rounded-lg hover:bg-[var(--primary)]/15 ${canRecalc ? '' : 'ml-auto'}`}
        title="Auto-fill Planned Start + Deadline for every task using the template's Day offsets"
      >
        <Zap size={13} /> Auto-Schedule
      </button>
    </div>

    {/* Row 3 — status counters */}
    <div className="flex flex-wrap gap-2 mt-3">
      <StatCard icon={ListChecks}    label="Total"           value={counters?.total ?? 0} />
      <StatCard icon={CheckCircle2}  label="Completed"       value={counters?.completed ?? 0} tone="success" />
      <StatCard icon={Clock}         label="In Progress"     value={counters?.inProgress ?? 0} tone="info" />
      <StatCard icon={AlertTriangle} label="Delayed"         value={counters?.delayed ?? 0} tone="danger" />
      <StatCard icon={Clock}         label="Pending Review"  value={counters?.submitted ?? 0} tone="warning" />
      <StatCard icon={RotateCcw}     label="Revision"        value={counters?.revisionRequired ?? 0} tone="danger" />
      <StatCard icon={Clock}         label="Pending Client"  value={counters?.pendingClient ?? 0} tone="warning" />
      {/* Aggregate Planned Days / Planned Hrs / Actual Hrs strip removed — these
          totals duplicated the per-row "Days", "Planned Hrs" and "Actual Hrs"
          columns already shown in the grid below. */}
    </div>
  </div>
);

const FilterBar = ({ filters, setFilters, zones, designers }) => {
  const update = (k, v) => setFilters((prev) => ({ ...prev, [k]: v }));
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search drawing name…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="pl-7 pr-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)] w-52"
        />
      </div>
      <select
        value={filters.zone}
        onChange={(e) => update('zone', e.target.value)}
        className="px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
      >
        <option value="">All zones</option>
        {zones.map((z) => <option key={z} value={z}>{z}</option>)}
      </select>
      <select
        value={filters.designer}
        onChange={(e) => update('designer', e.target.value)}
        className="px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
      >
        <option value="">All designers</option>
        {designers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
      </select>
      <select
        value={filters.workStatus}
        onChange={(e) => update('workStatus', e.target.value)}
        className="px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
        title="Filter by Work Status"
      >
        <option value="">All work statuses</option>
        {WORK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] ml-1">
        <input
          type="checkbox"
          checked={filters.delayedOnly}
          onChange={(e) => update('delayedOnly', e.target.checked)}
          className="accent-[var(--primary)]"
        />
        Delayed only
      </label>
      <span className="ml-auto text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1">
        <Filter size={11} /> Filters apply server-side
      </span>
    </div>
  );
};

const EditableDateCell = ({ value, onSave, disabled }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value ? fmtISO(value) : '');
  useEffect(() => { setLocal(value ? fmtISO(value) : ''); }, [value]);

  if (disabled) return <span className="text-xs text-[var(--text-muted)]">{fmt(value)}</span>;

  if (!editing) {
    const isEmpty = !value;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors
          ${isEmpty
            ? 'text-[var(--text-muted)] border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--bg)]'}`}
        title={isEmpty ? 'Click to pick a date' : 'Click to change date'}
      >
        <CalendarIcon size={10} className={isEmpty ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'} />
        {fmt(value)}
      </button>
    );
  }
  return (
    <DatePicker
      value={local}
      onChange={(e) => {
        const iso = e.target.value;
        setLocal(iso);
        setEditing(false);
        if (iso !== fmtISO(value)) onSave(iso);
      }}
      autoOpen
    />
  );
};

// Master Sheet "Work Status" column — manual per-row tracking, independent of
// the derived workflow Stage. Mirrors the backend Task.workStatus enum.
const WORK_STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'on_hold',     label: 'On Hold' },
  { value: 'cancelled',   label: 'Cancelled' },
];
const WORK_STATUS_BADGE = {
  pending:     'bg-[var(--border)] text-[var(--text-secondary)] border-[var(--border)]',
  in_progress: 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border-[var(--accent-blue)]/30',
  completed:   'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30',
  on_hold:     'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30',
  cancelled:   'bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/30',
};
const EditableWorkStatusCell = ({ value, onSave, disabled }) => {
  const cls = WORK_STATUS_BADGE[value || 'pending'] || WORK_STATUS_BADGE.pending;
  const label = WORK_STATUS_OPTIONS.find((o) => o.value === (value || 'pending'))?.label || 'Pending';
  if (disabled) {
    return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>{label}</span>;
  }
  return (
    <select
      value={value || 'pending'}
      onChange={(e) => onSave(e.target.value)}
      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border focus:outline-none focus:ring-1 focus:ring-[var(--primary)] ${cls}`}
      title="Work status — manual tracking for this row"
    >
      {WORK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

// Read-only progress bar (0–100). The value is auto-derived from workflow
// status by the Task model hooks (not started 0 · in progress/revision 50 ·
// pending review 80 · approved/completed 100) — never edited by hand.
const ProgressCell = ({ value }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-1.5 w-full" title="Auto-updates from task status">
      <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-[var(--text-secondary)]">{pct}%</span>
    </div>
  );
};

// Centred modal for editing a task's notes / remarks. Pre-fills with the
// current value; save on Confirm.
const NotesModal = ({ open, row, onClose, onSave, busy }) => {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(row?.notes || ''); }, [open, row]);
  if (!open || !row) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-md">
        <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Notes — {row.title}</h3>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Internal remarks. Visible to anyone with planner access.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="e.g. Awaiting client confirmation on material…"
          className="w-full mt-3 px-2.5 py-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)] resize-none"
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(text)} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Save Notes
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Full checklist editor — toggle, add, remove items. Saves the entire
 * checklist array back via the planner patch endpoint (server diffs to set
 * completedAt timestamps appropriately).
 */
const ChecklistModal = ({ open, row, onClose, onSave, busy }) => {
  const [items, setItems]   = useState([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    if (!open) return;
    setItems(
      Array.isArray(row?.checklist)
        ? row.checklist.map((c) => ({ item: c.item, isCompleted: !!c.isCompleted, completedAt: c.completedAt || null }))
        : []
    );
    setNewItem('');
  }, [open, row]);

  if (!open || !row) return null;

  const toggle = (idx) => {
    setItems((prev) => prev.map((c, i) => (i === idx ? { ...c, isCompleted: !c.isCompleted } : c)));
  };
  const remove = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateText = (idx, text) => {
    setItems((prev) => prev.map((c, i) => (i === idx ? { ...c, item: text } : c)));
  };
  const add = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, { item: trimmed, isCompleted: false, completedAt: null }]);
    setNewItem('');
  };

  const done = items.filter((i) => i.isCompleted).length;
  const total = items.length;
  const canSave = items.every((c) => c.item.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-lg max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
              <ListChecks size={15} /> Checklist — {row.title}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {total === 0 ? 'No items yet — add one below.' : `${done} of ${total} completed`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded"
            disabled={busy}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto mt-3 -mx-1 px-1">
          {items.length === 0 ? (
            <div className="text-[11px] text-[var(--text-muted)] italic text-center py-6">
              No checklist items yet. Use the field below to add one.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((c, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 group rounded-md hover:bg-[var(--bg)] px-1 py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={c.isCompleted}
                    onChange={() => toggle(idx)}
                    className="accent-[var(--primary)] flex-shrink-0"
                    disabled={busy}
                  />
                  <input
                    type="text"
                    value={c.item}
                    onChange={(e) => updateText(idx, e.target.value)}
                    disabled={busy}
                    className={`flex-1 bg-transparent text-xs px-1 py-1 border-b border-transparent focus:border-[var(--primary)] focus:outline-none ${c.isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
                  />
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    disabled={busy}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--error)] p-1 rounded"
                    title="Remove item"
                  >
                    <Trash2 size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add new */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="New checklist item…"
            disabled={busy}
            className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !newItem.trim()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[var(--primary)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 rounded-md hover:bg-[var(--primary)]/15 disabled:opacity-50"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(items.map((c) => ({ item: c.item.trim(), isCompleted: !!c.isCompleted, completedAt: c.completedAt || null })))}
            disabled={busy || !canSave}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={12} className="animate-spin" />} Save Checklist
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Designer cell — chip-style display that swaps to EmployeePicker on click.
 * Submits the new assigneeId via onChange (string, "" for unassigned).
 */
const DesignerCell = ({ value, onChange, restrictToIds }) => {
  const [editing, setEditing] = useState(false);
  // EmployeePicker expects a full user object — we have name/email from populate.
  const pickerValue = value?._id
    ? { _id: value._id, name: value.name, email: value.email || '', role: 'designer' }
    : null;

  if (!editing) {
    const isEmpty = !value?.name;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1 text-left whitespace-nowrap transition-colors
          ${isEmpty
            ? 'font-semibold text-[var(--text-secondary)] border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--bg)]'}`}
        title={isEmpty ? 'Click to assign a designer' : 'Click to change designer'}
      >
        {isEmpty
          ? <><UserPlus size={12} className="shrink-0" /> Assign…</>
          : value.name}
      </button>
    );
  }
  return (
    <div className="min-w-[200px]">
      <EmployeePicker
        value={pickerValue}
        onChange={(user) => {
          setEditing(false);
          // Don't refire if unchanged
          const nextId = user?._id || '';
          const prevId = value?._id || '';
          if (String(nextId) !== String(prevId)) onChange(nextId);
        }}
        placeholder="Pick designer…"
        restrictToIds={restrictToIds}
        emptyHint="No team members — build the project team first"
      />
    </div>
  );
};

// Human-readable elapsed time between two dates (or now). 12d 4h, 2h 15m, etc.
const fmtElapsed = (from, to = Date.now()) => {
  if (!from) return '';
  const ms = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m % 60}m`;
  if (m >= 1) return `${m}m`;
  return '<1m';
};

/**
 * Drawing cell — current-version chip, status badge, View, Replace, and an
 * inline expandable dropdown listing every revision (newest on top) with
 * per-version turnaround time and total elapsed time across the chain.
 */
const DrawingCell = ({
  drawing, onView, onUpload, uploading,
  expanded, onToggleExpand, versionsState,
}) => {
  const inputId = useMemo(() => `planner-upload-${Math.random().toString(36).slice(2, 9)}`, []);
  const handlePick = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = '';
  };

  // No drawing yet — show a single "Upload" CTA chip.
  if (!drawing) {
    return (
      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-dashed cursor-pointer transition-colors
            ${uploading
              ? 'border-[var(--primary)]/40 text-[var(--text-muted)] cursor-wait'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]'}`}
          title="Upload the first drawing for this row"
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {uploading ? 'Uploading…' : 'Upload'}
        </label>
        <input id={inputId} type="file" accept=".pdf,image/*" onChange={handlePick} disabled={uploading} className="hidden" />
      </div>
    );
  }

  const st = DRAWING_STATUS_LABEL[drawing.status] || DRAWING_STATUS_LABEL.draft;
  const canReplace = drawing.status === 'rejected' || drawing.status === 'draft';
  const versions = versionsState?.versions || [];

  // Loaded-versions-derived stats; falls back to the lightweight drawing.revisionsCount.
  // Before the versions list is lazy-loaded, fall back to the larger of the
  // latest doc's revisionsCount and its version number — so the expand toggle
  // appears whenever more than one version exists (including separate
  // version-per-doc uploads, where revisionsCount on the latest doc is 1).
  const versionCount  = versions.length || Math.max(drawing.revisionsCount || 1, drawing.version || 1);
  const oldestVersion = versions.length ? versions[versions.length - 1] : null;
  const newestVersion = versions.length ? versions[0] : null;
  const totalSpan     = (oldestVersion && newestVersion && newestVersion.version !== oldestVersion.version)
    ? fmtElapsed(oldestVersion.uploadedAt, newestVersion.uploadedAt)
    : null;

  return (
    <div className="flex flex-col gap-1 min-w-[180px] relative">
      {/* Current version chip */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] font-bold text-[var(--text-primary)]">v{drawing.version}</span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${st.cls}`}>
          {st.label}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[var(--primary)] hover:underline"
          title="Open the latest file"
        >
          <Eye size={11} /> View
        </button>
        {versionCount > 1 && (
          <button
            type="button"
            onClick={onToggleExpand}
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold hover:underline transition-colors
              ${expanded ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--primary)]'}`}
            title="Show all revisions"
          >
            <HistoryIcon size={11} />
            {versionCount} ver
            {totalSpan && <span className="text-[var(--text-muted)] font-semibold">· {totalSpan}</span>}
            <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
          </button>
        )}
        {canReplace && (
          <>
            <label
              htmlFor={inputId}
              className={`inline-flex items-center gap-0.5 text-[10px] font-bold cursor-pointer hover:underline
                ${uploading ? 'text-[var(--text-muted)] cursor-wait' : 'text-[var(--warning)]'}`}
              title="Upload a new version — old file moves to revision history"
            >
              {uploading ? <Loader2 size={11} className="animate-spin" /> : <Replace size={11} />}
              {uploading ? 'Uploading…' : 'Replace'}
            </label>
            <input id={inputId} type="file" accept=".pdf,image/*" onChange={handlePick} disabled={uploading} className="hidden" />
          </>
        )}
      </div>

      {/* The version list now expands as full-width rows under this task row
          (see VersionRows in MasterSheetGrid), not as an in-cell popup. */}
    </div>
  );
};

const AddRowModal = ({ open, onClose, onCreate, busy, defaultPhase, teamUserIds }) => {
  const [form, setForm] = useState({
    title: '', taskType: 'technical_drawing', priority: 'medium',
    zoneName: '', floor: '', area: '',
    designer: null, plannedStartDate: '', plannedEndDate: '', plannedHours: '',
  });
  const [errors, setErrors] = useState({});

  // Reset state every time the modal opens so stale values from a previous
  // session don't carry over.
  useEffect(() => {
    if (open) {
      setForm({
        title: '', taskType: 'technical_drawing', priority: 'medium',
        zoneName: '', floor: '',
        designer: null, plannedStartDate: '', plannedEndDate: '', plannedHours: '',
      });
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
    if ((k === 'plannedStartDate' || k === 'plannedEndDate') && errors.plannedEndDate) {
      setErrors((e) => ({ ...e, plannedEndDate: undefined }));
    }
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Drawing name is required';
    if (form.plannedStartDate && form.plannedEndDate
        && new Date(form.plannedEndDate) < new Date(form.plannedStartDate)) {
      e.plannedEndDate = 'End date cannot be before start date';
    }
    const hrs = form.plannedHours === '' ? null : Number(form.plannedHours);
    if (hrs !== null && (Number.isNaN(hrs) || hrs < 0)) {
      e.plannedHours = 'Hours must be a positive number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onCreate({
      title:    form.title.trim(),
      taskType: form.taskType,
      priority: form.priority,
      assignedTo: form.designer?._id || undefined,
      phase:    defaultPhase || undefined,
      planning: {
        floor:    form.floor,
        area:     form.area,
        zoneName: form.zoneName,
        plannedStartDate: form.plannedStartDate || undefined,
        plannedEndDate:   form.plannedEndDate   || undefined,
        plannedHours:     form.plannedHours === '' ? 0 : Number(form.plannedHours),
      },
    });
  };

  const fieldErr = (k) => errors[k] ? (
    <p className="mt-1 text-[10px] font-bold text-[var(--error)]">{errors[k]}</p>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-lg"
      >
        <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-1">
          Add Drawing Row
          {defaultPhase && (
            <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded align-middle">
              {defaultPhase}
            </span>
          )}
        </h3>
        {defaultPhase && (
          <p className="text-[11px] text-[var(--text-muted)] mb-3">This task will appear under the <strong>{defaultPhase}</strong> phase.</p>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Drawing Name *</label>
            <input
              required autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={`w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border rounded-md focus:outline-none focus:border-[var(--primary)] ${
                errors.title ? 'border-[var(--error)]' : 'border-[var(--border)]'
              }`}
              placeholder="e.g. Master Bedroom — Ceiling Layout"
            />
            {fieldErr('title')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Category</label>
              <select
                value={form.taskType}
                onChange={(e) => set('taskType', e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
              >
                {TASK_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
              >
                {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Designer</label>
            <EmployeePicker
              value={form.designer}
              onChange={(user) => set('designer', user)}
              placeholder="Assign a designer…"
              restrictToIds={teamUserIds}
              filterRoles={teamUserIds ? undefined : ['designer', 'supervisor']}
              emptyHint="No team members — build the project team first"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Floor</label>
              <input
                value={form.floor}
                onChange={(e) => set('floor', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
                placeholder="e.g. 02"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Zone</label>
              <input
                value={form.zoneName}
                onChange={(e) => set('zoneName', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
                placeholder="e.g. Master Bedroom"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Area</label>
            <input
              value={form.area}
              onChange={(e) => set('area', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
              placeholder="e.g. 250 sq.ft"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Start</label>
              <DatePicker
                name="plannedStartDate"
                value={form.plannedStartDate}
                onChange={(e) => set('plannedStartDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">End / Deadline</label>
              <DatePicker
                name="plannedEndDate"
                value={form.plannedEndDate}
                onChange={(e) => set('plannedEndDate', e.target.value)}
              />
              {fieldErr('plannedEndDate')}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Planned Hours</label>
            <input
              type="number" min="0" step="0.5"
              value={form.plannedHours}
              onChange={(e) => set('plannedHours', e.target.value)}
              placeholder="e.g. 8"
              className={`w-32 px-2.5 py-1.5 text-xs bg-[var(--bg)] border rounded-md focus:outline-none focus:border-[var(--primary)] ${
                errors.plannedHours ? 'border-[var(--error)]' : 'border-[var(--border)]'
              }`}
            />
            {fieldErr('plannedHours')}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
          >Cancel</button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={12} className="animate-spin" />} Create Row
          </button>
        </div>
      </form>
    </div>
  );
};

/**
 * RevisionDrawer — slide-in panel that lists all versions of a drawing for a
 * given task. Newest on top, older revisions below. Each entry has a signed
 * preview link (the legacy /preview endpoint accepts ?historyVersion=N to sign
 * a past file).
 */
const RevisionDrawer = ({ open, row, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [drawings, setDrawings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !row?.taskId) return;
    setLoading(true);
    setError(null);
    pmsService.getDrawingsByTask(row.taskId)
      .then((res) => setDrawings(Array.isArray(res?.drawings) ? res.drawings : []))
      .catch((err) => setError(err?.message || 'Failed to load revisions'))
      .finally(() => setLoading(false));
  }, [open, row?.taskId]);

  const openSigned = async (drawingId, historyVersion) => {
    try {
      const res = await pmsService.getDrawingPreviewUrl(
        drawingId,
        historyVersion != null ? { historyVersion } : undefined,
      );
      if (res?.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err?.message || 'Could not open file');
    }
  };

  // Flatten current + history into a versions list, newest first.
  const versions = useMemo(() => {
    const out = [];
    for (const d of drawings) {
      // Current version
      out.push({
        drawingId:    d._id,
        version:      d.version,
        isCurrent:    true,
        status:       d.status,
        fileName:     d.fileName,
        uploadedAt:   d.updatedAt || d.createdAt,
        uploadedBy:   d.uploadedBy,
        notes:        d.revisionNotes,
        rejectionReason: d.rejectionReason,
        rejectedAt:   d.rejectedAt,
        approvalDate: d.approvalDate,
        historyVersion: null,
      });
      // Past revisions (already stored in revisionHistory[])
      for (const r of (d.revisionHistory || [])) {
        out.push({
          drawingId:  d._id,
          version:    r.version,
          isCurrent:  false,
          status:     'archived',
          fileName:   r.fileName,
          uploadedAt: r.uploadedAt,
          uploadedBy: r.uploadedBy,
          notes:      r.notes,
          historyVersion: r.version,
        });
      }
    }
    return out.sort((a, b) => (b.version || 0) - (a.version || 0));
  }, [drawings]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <HistoryIcon size={14} className="text-[var(--primary)]" />
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Revision History</h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] truncate">{row?.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg)] text-[var(--text-muted)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
            </div>
          )}
          {error && (
            <p className="text-xs text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/30 rounded p-2">{error}</p>
          )}
          {!loading && !error && versions.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center py-10">No drawings uploaded for this row yet.</p>
          )}
          <div className="space-y-3">
            {versions.map((v, idx) => {
              const isLatest = idx === 0;
              const st = DRAWING_STATUS_LABEL[v.status] || { label: 'Archived', cls: 'bg-[var(--border)] text-[var(--text-muted)]' };
              return (
                <div
                  key={`${v.drawingId}-${v.version}`}
                  className={`border rounded-xl p-3 ${isLatest ? 'border-[var(--primary)]/40 bg-[var(--primary)]/5' : 'border-[var(--border)]'}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-[var(--text-primary)]">v{v.version}</span>
                      {isLatest && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--primary)]">Latest</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSigned(v.drawingId, v.historyVersion)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] hover:underline"
                    >
                      <ExternalLink size={11} /> Open
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mb-1">
                    <FileText size={11} className="text-[var(--text-muted)]" />
                    <span className="truncate">{v.fileName || '—'}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {fmtDateTime(v.uploadedAt)}
                    {v.uploadedBy?.name ? ` · by ${v.uploadedBy.name}` : ''}
                  </div>
                  {v.notes && (
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5">
                      <span className="font-bold">Notes: </span>{v.notes}
                    </p>
                  )}
                  {v.rejectionReason && (
                    <p className="mt-2 text-[11px] text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/30 rounded px-2 py-1.5">
                      <span className="font-bold">Rejected: </span>{v.rejectionReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
};

// Group rows by phase. The project's planSnapshot phase list (server-provided,
// ordered) seeds the groups FIRST so freshly added phases with zero tasks still
// render their header; rows with unknown phases append after, and rows without
// a phase fall under a synthetic "Other" group appended last.
const PHASE_OTHER_KEY = '__other__';

const groupRowsByPhase = (rows, phases = []) => {
  const groups = new Map(); // ci key -> { name, rows }
  for (const p of [...phases].sort((a, b) => (a.order || 0) - (b.order || 0))) {
    const key = String(p.name || '').trim().toLowerCase();
    if (key && !groups.has(key)) groups.set(key, { name: p.name, rows: [] });
  }
  const otherRows = [];
  for (const r of rows) {
    const raw = String(r.phase || '').trim();
    if (!raw) { otherRows.push(r); continue; }
    const key = raw.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: raw, rows: [] });
    groups.get(key).rows.push(r);
  }
  if (otherRows.length) groups.set(PHASE_OTHER_KEY, { name: 'Other', rows: otherRows });
  return Array.from(groups.entries()).map(([key, value], idx) => ({
    key,
    order: idx + 1,
    name:  value.name,
    rows:  value.rows,
  }));
};

/**
 * Compact checklist chip — shows "N/M done" plus a thin progress bar. Clicking
 * the chip opens the full ChecklistModal where items can be toggled, added,
 * or removed. Empty checklist renders an "Add…" affordance.
 */
const ChecklistCell = ({ row, onOpen }) => {
  const items = Array.isArray(row?.checklist) ? row.checklist : [];
  const total = items.length;
  const done  = items.filter((i) => i.isCompleted).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  if (total === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded px-1.5 py-0.5 hover:border-[var(--primary)] hover:text-[var(--primary)]"
        title="Add checklist items"
      >
        <ListChecks size={11} /> Add…
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-0.5 min-w-[90px] text-left group"
      title="Open checklist"
    >
      <div className="flex items-center gap-1.5">
        <ListChecks
          size={11}
          className={allDone ? 'text-[var(--success)]' : 'text-[var(--text-muted)] group-hover:text-[var(--primary)]'}
        />
        <span className={`text-[11px] font-bold ${allDone ? 'text-[var(--success)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--primary)]'}`}>
          {done}/{total}
        </span>
      </div>
      <div className="h-1 w-full bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className={`h-full ${allDone ? 'bg-[var(--success)]' : 'bg-[var(--primary)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
};

/**
 * Click-to-rename phase name — used inside the phase header. Renames apply to
 * THIS project only (planSnapshot + cascading Task.phase on the server).
 */
const EditablePhaseName = ({ name, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal]     = useState(name);
  useEffect(() => { setLocal(name); }, [name]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="text-sm font-bold text-[var(--text-primary)] capitalize hover:text-[var(--primary)] underline decoration-dashed decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--primary)]"
        title="Click to rename this phase (this project only)"
      >
        {name}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const v = local.trim();
    if (v && v !== name) onRename(name, v);
    else setLocal(name);
  };
  return (
    <input
      value={local}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setEditing(false); setLocal(name); }
      }}
      className="w-40 text-sm font-bold bg-[var(--bg)] border border-[var(--primary)] rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none"
    />
  );
};

/**
 * Full-width expandable version rows. When a task's drawing history is toggled
 * open, every revision renders as a real table row (newest first) aligned to
 * all columns — not an in-cell popup. Zone/Floor/Area mirror the parent task;
 * the version-specific data (version, status, uploader, date, file, rejection
 * note) fills the relevant columns. Returns an array of <tr> so it slots
 * directly into <tbody> beneath the parent row.
 */
const VersionRows = ({ row, state, onViewVersion, totalCols }) => {
  if (state?.loading) {
    return (
      <tr className="bg-[var(--bg)]/40">
        <td className="px-2 py-2 sticky left-0 z-[5] bg-[var(--bg)]" />
        <td className="px-3 py-2 sticky left-8 z-[5] bg-[var(--bg)]" />
        <td colSpan={Math.max(1, totalCols - 2)} className="px-3 py-3">
          <span className="inline-flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <Loader2 size={13} className="animate-spin" /> Loading versions…
          </span>
        </td>
      </tr>
    );
  }
  if (state?.error) {
    return (
      <tr className="bg-[var(--bg)]/40">
        <td className="px-2 py-2 sticky left-0 z-[5] bg-[var(--bg)]" />
        <td className="px-3 py-2 sticky left-8 z-[5] bg-[var(--bg)]" />
        <td colSpan={Math.max(1, totalCols - 2)} className="px-3 py-2 text-[11px] text-[var(--error)]">{state.error}</td>
      </tr>
    );
  }

  const versions = state?.versions || [];
  if (!versions.length) return null;

  return versions.map((v, idx) => {
    const isNewest = idx === 0;
    const st = DRAWING_STATUS_LABEL[v.status] || { label: 'Archived', cls: 'bg-[var(--border)] text-[var(--text-muted)]' };
    // Per-version snapshot of the task's plan state (priority, dates, hours,
    // progress…) captured when THIS version was uploaded. Empty for versions
    // created before snapshots existed (run the backfill script to populate).
    const ts = v.taskSnapshot || {};
    return (
      <tr key={`${v.drawingId}-${v.version}-${idx}`} className="bg-[var(--bg)]/40 border-b border-[var(--border)]">
        {/* checkbox + # (sticky, blank w/ row connector) */}
        <td className="px-2 py-2 sticky left-0 z-[5] bg-[var(--bg)]" />
        <td className="px-3 py-2 sticky left-8 z-[5] bg-[var(--bg)] text-[11px] font-mono text-[var(--text-muted)]">↳</td>
        {/* Drawing Name — version label + file + date + rejection/revision note */}
        <td className="px-3 py-2 sticky left-16 z-[5] bg-[var(--bg)]">
          <div className="flex items-center gap-2 pl-3 border-l-2 border-[var(--primary)]/30">
            <span className="font-mono text-[11px] font-extrabold text-[var(--text-primary)]">v{v.version}</span>
            {isNewest && <span className="text-[9px] font-black uppercase tracking-wider text-[var(--primary)]">Latest</span>}
            <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[160px]" title={v.fileName}>{v.fileName || ''}</span>
          </div>
          <p className="mt-0.5 ml-3 text-[10px] text-[var(--text-muted)]">
            Uploaded {v.uploadedAt ? fmtDateTime(v.uploadedAt) : '—'}
            {v.approvalDate
              ? ` · Approved ${fmtDateTime(v.approvalDate)}`
              : (v.rejectedAt ? ` · Rejected ${fmtDateTime(v.rejectedAt)}` : '')}
          </p>
          {v.rejectionReason && (
            <p className="mt-1 ml-3 text-[10px] text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/30 rounded px-1.5 py-0.5 max-w-[260px] truncate" title={v.rejectionReason}>
              <span className="font-bold">REVISION: </span>{v.rejectionReason}
            </p>
          )}
          {v.notes && !v.rejectionReason && (
            <p className="mt-1 ml-3 text-[10px] text-[var(--text-muted)] max-w-[260px] truncate" title={v.notes}>{v.notes}</p>
          )}
        </td>
        {/* Stage = this version's drawing status */}
        <td className="px-3 py-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${st.cls}`}>{st.label}</span>
        </td>
        {/* Work Status — derived from THIS version's drawing lifecycle (matches Stage) */}
        <td className="px-3 py-2">
          {DRAWING_TO_WORKSTATUS[v.status]
            ? <EditableWorkStatusCell value={DRAWING_TO_WORKSTATUS[v.status]} disabled />
            : <span className="text-[11px] text-[var(--text-muted)]">—</span>}
        </td>
        {/* Priority — from THIS version's snapshot */}
        <td className="px-3 py-2">
          {ts.priority ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PRIORITY_BADGE[ts.priority] || 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
              {PRIORITY_OPTIONS.find((o) => o.value === ts.priority)?.label || ts.priority}
            </span>
          ) : <span className="text-[11px] text-[var(--text-muted)]">—</span>}
        </td>
        {/* Zone / Floor / Area = THIS version's own location (copied at upload) */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">{v.zoneName || row.planning?.zoneName || '—'}</td>{/* Zone */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">{v.floor || row.planning?.floor || '—'}</td>{/* Floor */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">{v.area || row.planning?.area || '—'}</td>{/* Area */}
        {/* Designer = who uploaded THIS version */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">{v.uploadedBy?.name || ts.assignedToName || '—'}</td>{/* Designer */}
        {/* Checklist — task checklist progress snapshotted for THIS version */}
        <td className="px-3 py-2">
          {(() => {
            let done = ts.checklistDone;
            let total = ts.checklistTotal;
            if (total == null) {
              const ck = Array.isArray(v.checklistSnapshot) ? v.checklistSnapshot : [];
              if (ck.length) { total = ck.length; done = ck.filter((i) => i.isCompleted).length; }
            }
            if (!total) return <span className="text-[11px] text-[var(--text-muted)]">—</span>;
            const pct = Math.round(((done || 0) / total) * 100);
            return (
              <div className="flex flex-col gap-0.5 min-w-[70px]">
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{done || 0}/{total}</span>
                <div className="h-1 w-full bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
        </td>
        {/* Planned Start / Deadline / Days / Hrs / Progress / Delay — from THIS version's snapshot */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{ts.plannedStartDate ? fmt(ts.plannedStartDate) : '—'}</td>{/* Planned Start */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{ts.plannedEndDate ? fmt(ts.plannedEndDate) : '—'}</td>{/* Deadline */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">{ts.plannedDays != null ? ts.plannedDays : '—'}</td>{/* Duration */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-muted)]">—</td>{/* Schedule */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-muted)]">—</td>{/* Predecessor */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-muted)]">—</td>{/* Auto-Shift */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">{ts.plannedHours != null ? ts.plannedHours : '—'}</td>{/* Planned Hrs */}
        <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)]">{ts.actualHours != null ? ts.actualHours : '—'}</td>{/* Actual Hrs */}
        <td className="px-3 py-2">{DRAWING_TO_PROGRESS[v.status] != null ? <ProgressCell value={DRAWING_TO_PROGRESS[v.status]} /> : <span className="text-[11px] text-[var(--text-muted)]">—</span>}</td>{/* Progress */}
        <td className="px-3 py-2">{ts.delayDays != null ? <DelayBadge days={ts.delayDays} /> : <span className="text-[11px] text-[var(--text-muted)]">—</span>}</td>{/* Delay */}
        <td className="px-3 py-2">{/* Drawing — open this version */}
          <button
            type="button"
            onClick={() => onViewVersion?.(v)}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] hover:underline"
            title="Open this version"
          >
            <Eye size={11} /> View
          </button>
        </td>
        <td className="px-3 py-2" />{/* Actions */}
      </tr>
    );
  });
};

/**
 * SubtaskRow — one interactive child row rendered beneath its parent. Mirrors
 * the VersionRows indentation language (sticky blank + "↳" connector, left
 * border) but every cell is editable, just like a normal task row. Column count
 * matches the parent grid exactly so everything stays aligned.
 *
 * `h` bundles the schedule/edit handlers so we don't thread a dozen props.
 */
const SubtaskRow = ({ sub, h, teamUserIds, canSchedule }) => {
  const locked = !!sub.scheduleLocked;
  const dateDisabled = locked;
  return (
    <tr className="bg-[var(--bg)]/40 border-b border-[var(--border)]">
      {/* checkbox + # (sticky, blank w/ connector) */}
      <td className="px-2 py-2 sticky left-0 z-[5] bg-[var(--bg)]" />
      <td className="px-3 py-2 sticky left-8 z-[5] bg-[var(--bg)] text-[11px] font-mono text-[var(--text-muted)]">↳</td>
      {/* Title (indented) */}
      <td className="px-3 py-2 sticky left-16 z-[5] bg-[var(--bg)]">
        <div className="flex items-center gap-2 pl-3 border-l-2 border-[var(--primary)]/30">
          <EditableTextCell value={sub.title} onSave={(v) => h.onPatch(sub.taskId, { title: v })} width="w-44" />
        </div>
      </td>
      {/* Stage */}
      <td className="px-3 py-2"><StageBadge stage={sub.stage} /></td>
      {/* Work Status */}
      <td className="px-3 py-2">
        <EditableWorkStatusCell value={sub.workStatus} onSave={(v) => h.onPatch(sub.taskId, { workStatus: v })} />
      </td>
      {/* Priority */}
      <td className="px-3 py-2">
        <EditablePriorityCell value={sub.priority} onSave={(p) => h.onPatch(sub.taskId, { priority: p })} />
      </td>
      {/* Zone / Floor / Area */}
      <td className="px-3 py-2"><EditableTextCell value={sub.planning?.zoneName} placeholder="Zone" autoSize onSave={(v) => h.onPatch(sub.taskId, { planning: { zoneName: v } })} /></td>
      <td className="px-3 py-2"><EditableTextCell value={sub.planning?.floor} placeholder="Floor" autoSize onSave={(v) => h.onPatch(sub.taskId, { planning: { floor: v } })} /></td>
      <td className="px-3 py-2"><EditableTextCell value={sub.planning?.area} placeholder="Area" autoSize onSave={(v) => h.onPatch(sub.taskId, { planning: { area: v } })} /></td>
      {/* Designer */}
      <td className="px-3 py-2">
        <DesignerCell value={sub.assignedTo} onChange={(userId) => h.onPatch(sub.taskId, { assignedTo: userId || null })} restrictToIds={teamUserIds} />
      </td>
      {/* Checklist */}
      <td className="px-3 py-2"><ChecklistCell row={sub} onOpen={() => h.onOpenChecklist(sub)} /></td>
      {/* Planned Start / Deadline */}
      <td className="px-3 py-2">
        <EditableDateCell value={sub.planning?.plannedStartDate} disabled={dateDisabled}
          onSave={(iso) => h.onScheduleDateEdit(sub, { planning: { plannedStartDate: iso } })} />
      </td>
      <td className="px-3 py-2">
        <EditableDateCell value={sub.planning?.plannedEndDate} disabled={dateDisabled}
          onSave={(iso) => h.onScheduleDateEdit(sub, { planning: { plannedEndDate: iso } })} />
      </td>
      {/* Duration */}
      <td className="px-3 py-2">
        <EditableDurationCell value={sub.durationDays} startDate={sub.planning?.plannedStartDate} disabled={dateDisabled}
          onSave={(n) => h.onDurationEdit(sub, n)} />
      </td>
      {/* Schedule status */}
      <td className="px-3 py-2"><ScheduleStatusBadge status={sub.scheduleStatus} /></td>
      {/* Predecessor */}
      <td className="px-3 py-2">
        <DependencyChip count={(sub.dependsOn || []).length} onClick={() => h.onOpenDependency(sub)} disabled={!canSchedule} />
      </td>
      {/* Auto-Shift */}
      <td className="px-3 py-2"><AutoShiftedIndicator shiftCount={sub.shiftCount} onClick={() => h.onOpenShiftHistory(sub)} /></td>
      {/* Planned / Actual hrs */}
      <td className="px-3 py-2"><EditableNumberCell value={sub.planning?.plannedHours} onSave={(n) => h.onPatch(sub.taskId, { planning: { plannedHours: n } })} /></td>
      <td className="px-3 py-2"><EditableNumberCell value={sub.planning?.actualHours} onSave={(n) => h.onPatch(sub.taskId, { planning: { actualHours: n } })} /></td>
      {/* Progress / Delay */}
      <td className="px-3 py-2"><ProgressCell value={sub.planning?.progressPercent} /></td>
      <td className="px-3 py-2"><DelayBadge days={sub.delayDays} /></td>
      {/* Drawing (subtasks rarely carry their own; show minimal state) */}
      <td className="px-3 py-2 text-[11px] text-[var(--text-muted)]">
        {sub.drawing ? <span className="font-mono">v{sub.drawing.version}</span> : '—'}
      </td>
      {/* Actions — lock + history + delete */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-0.5">
          <LockToggleCell locked={locked} disabled={!canSchedule} onToggle={(v) => h.onToggleLock(sub, v)} />
          <button type="button" onClick={() => h.onOpenShiftHistory(sub)} title="Shift history"
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg)]">
            <HistoryIcon size={12} />
          </button>
          <button type="button" onClick={() => h.onDelete(sub.taskId, sub.title, sub)} title="Delete subtask"
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10">
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// Compact dependency chip used in the Predecessor column.
const DependencyChip = ({ count, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    title={count ? `${count} predecessor(s) — click to edit` : 'Set dependencies'}
    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
      count
        ? 'text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20'
        : 'text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)]'
    } disabled:opacity-40 disabled:cursor-not-allowed`}>
    <GitBranch size={11} /> {count || '—'}
  </button>
);

const MasterSheetGrid = ({
  rows, phases, onPatch, onDelete, onViewDrawing, onShowVersions, onUpload, onOpenNotes, onOpenChecklist,
  uploadingTaskId, selectedTaskIds, onToggleRow, onToggleAll, onAddToPhase,
  // Per-project phase management (planner.edit)
  canManagePhases, onAddPhase, onRenamePhase, onDeletePhase, onEditPhaseBudget,
  // Inline version-history dropdown
  expandedVersionsTaskId, versionsCache, onToggleVersionsExpand, onViewVersion,
  // Restrict the designer picker to the project team (null = all assignable)
  teamUserIds,
  // Scheduling engine — subtasks + cascade-aware edits
  expandedSubtasksTaskId, onToggleSubtasks, sched, canSchedule,
}) => {
  // Per-phase collapse — Set of phase keys currently hidden. Phase headers act
  // as the accordion toggle; clicking the chevron (or the row outside the Add
  // button) hides/shows that phase's tasks. Hook stays above the early return.
  const [collapsedPhases, setCollapsedPhases] = useState(() => new Set());
  const togglePhase = (key) => setCollapsedPhases((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const phaseList = Array.isArray(phases) ? phases : [];
  if (!rows.length && !phaseList.length) {
    return (
      <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-12 text-center">
        <ClipboardList size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
        <p className="text-sm font-semibold text-[var(--text-secondary)]">No planner rows yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Click <span className="font-bold text-[var(--text-primary)]">+ Add Drawing Row</span> to start planning.</p>
      </div>
    );
  }
  // Header checkbox state — none / some / all
  const totalSelectable = rows.length;
  const selectedCount   = rows.reduce((n, r) => n + (selectedTaskIds.has(String(r.taskId)) ? 1 : 0), 0);
  const headerState     = selectedCount === 0 ? 'none' : selectedCount === totalSelectable ? 'all' : 'some';

  // Phase groups for grouped rendering — seeded from the snapshot phase list so
  // empty phases still render; row order preserved from the server sort.
  const phaseGroups = groupRowsByPhase(rows, phaseList);
  // Lookup of enriched phase info (budget + computed range/progress) by ci name.
  const phaseInfoByKey = new Map(
    phaseList.map((p) => [String(p.name || '').trim().toLowerCase(), p])
  );
  // Total columns including the sticky checkbox + # — used for phase-header colspan
  // and the expandable version / subtask sub-rows.
  const TOTAL_COLS = 23;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[var(--bg)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <th className="px-2 py-2 sticky left-0 bg-[var(--bg)] z-10 w-8">
              <button
                type="button"
                onClick={() => onToggleAll(headerState !== 'all')}
                className="inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary)]"
                title={headerState === 'all' ? 'Deselect all' : 'Select all'}
              >
                {headerState === 'all'  && <CheckSquare size={14} className="text-[var(--primary)]" />}
                {headerState === 'some' && <CheckSquare size={14} className="text-[var(--primary)]/60" />}
                {headerState === 'none' && <Square size={14} />}
              </button>
            </th>
            <th className="px-3 py-2 sticky left-8 bg-[var(--bg)] z-10">#</th>
            <th className="px-3 py-2 sticky left-16 bg-[var(--bg)] z-10 min-w-[220px]">Drawing Name</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2" title="Manual tracking status — set freely per row">Work Status</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Zone</th>
            <th className="px-3 py-2">Floor</th>
            <th className="px-3 py-2">Area</th>
            <th className="px-3 py-2 min-w-[180px]">Designer</th>
            <th className="px-3 py-2 min-w-[110px]">Checklist</th>
            <th className="px-3 py-2">Planned Start</th>
            <th className="px-3 py-2">Deadline</th>
            <th className="px-3 py-2" title="Duration in days — start + duration = due">Duration</th>
            <th className="px-3 py-2" title="Schedule status">Schedule</th>
            <th className="px-3 py-2" title="Predecessor / dependency tasks">Predecessor</th>
            <th className="px-3 py-2" title="Times this row's dates were shifted">Auto-Shift</th>
            <th className="px-3 py-2">Planned Hrs</th>
            <th className="px-3 py-2">Actual Hrs</th>
            <th className="px-3 py-2">Progress</th>
            <th className="px-3 py-2">Delay</th>
            <th className="px-3 py-2">Drawing</th>
            <th className="px-3 py-2 min-w-[70px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {phaseGroups.map((group) => {
            const isCollapsed = collapsedPhases.has(group.key);
            const isOther     = group.key === PHASE_OTHER_KEY;
            return (
            <React.Fragment key={group.key}>
              {/* Phase header row — click anywhere outside the controls to
                  collapse / expand this phase. */}
              <PhaseHeaderRow
                colSpan={TOTAL_COLS}
                order={group.order}
                collapsed={isCollapsed}
                onToggle={() => togglePhase(group.key)}
                nameSlot={
                  canManagePhases && !isOther ? (
                    <EditablePhaseName name={group.name} onRename={onRenamePhase} />
                  ) : (
                    <span className="text-sm font-bold text-[var(--text-primary)] capitalize">
                      {group.name}
                    </span>
                  )
                }
                metaSlot={(() => {
                  const info = phaseInfoByKey.get(group.key);
                  return (
                    <span className="text-xs text-[var(--text-secondary)] ml-1 inline-flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{group.rows.length} task{group.rows.length !== 1 ? 's' : ''}</span>
                      {info?.computedStart && info?.computedEnd && (
                        <span className="text-[var(--text-primary)]">· {fmt(info.computedStart)} → {fmt(info.computedEnd)}{info.computedDays != null ? ` (${info.computedDays}d)` : ''}</span>
                      )}
                      {info && info.progressPercent != null && info.taskCount > 0 && (
                        <span className="font-semibold text-[var(--text-primary)]">· {info.progressPercent}%</span>
                      )}
                      {info?.dayBudget != null && (
                        <span className={`font-bold ${info.computedDays != null && info.computedDays > info.dayBudget ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>
                          · Budget {info.dayBudget}d{info.computedDays != null && info.computedDays > info.dayBudget ? ' ⚠' : ''}
                        </span>
                      )}
                    </span>
                  );
                })()}
                actionsSlot={(
                  <>
                    {canManagePhases && !isOther && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditPhaseBudget?.(phaseInfoByKey.get(group.key) || { name: group.name }); }}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
                        title="Set phase day budget"
                      >
                        <CalendarRange size={12} />
                      </button>
                    )}
                    {onAddToPhase && !isOther && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAddToPhase(group.name); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest
                                   text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 transition-colors"
                        title={`Add a task under ${group.name}`}
                      >
                        <Plus size={11} /> Add task to {group.name}
                      </button>
                    )}
                    {canManagePhases && !isOther && (
                      <button
                        type="button"
                        disabled={group.rows.length > 0}
                        onClick={(e) => { e.stopPropagation(); onDeletePhase(group.name); }}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 disabled:opacity-40 disabled:hover:text-[var(--text-muted)] disabled:hover:bg-transparent"
                        title={group.rows.length > 0 ? 'Remove or move this phase\'s tasks first' : 'Delete phase (this project only)'}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                )}
              />

              {!isCollapsed && group.rows.map((r, idx) => {
            const isSelected = selectedTaskIds.has(String(r.taskId));
            const rowTone =
              r.isDelayed ? 'border-l-4 border-l-[var(--error)]' :
              r.stage === 'Completed' ? 'border-l-4 border-l-[var(--success)]' :
              r.stage === 'On Hold' ? 'border-l-4 border-l-[var(--text-muted)]' :
              r.stage === 'Revision Required' ? 'border-l-4 border-l-[var(--error)]' :
              '';
            const rowBg = isSelected ? 'bg-[var(--primary)]/5' : '';
            const isVerExpanded = expandedVersionsTaskId === String(r.taskId);
            // Show the expand caret only when more than one version exists, so
            // there's actually previous data to reveal beneath the row.
            const hasVersions = !!r.drawing && ((r.drawing.version || 1) > 1 || (r.drawing.revisionsCount || 1) > 1);
            const hasSubtasks = Array.isArray(r.subtasks) && r.subtasks.length > 0;
            const isSubExpanded = expandedSubtasksTaskId === String(r.taskId);
            const parentDatesLocked = r.scheduleLocked || hasSubtasks; // children own the dates
            return (
              <React.Fragment key={r.taskId}>
              <tr className={`border-b border-[var(--border)] hover:bg-[var(--bg)]/60 ${rowTone} ${rowBg}`}>
                <td className={`px-2 py-2 sticky left-0 z-[5] ${isSelected ? 'bg-[var(--primary)]/5' : 'bg-[var(--surface)]'}`}>
                  <button
                    type="button"
                    onClick={() => onToggleRow(String(r.taskId))}
                    className="inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary)]"
                    title={isSelected ? 'Deselect row' : 'Select row'}
                  >
                    {isSelected ? <CheckSquare size={14} className="text-[var(--primary)]" /> : <Square size={14} />}
                  </button>
                </td>
                <td className={`px-3 py-2 sticky left-8 ${isSelected ? 'bg-[var(--primary)]/5' : 'bg-[var(--surface)]'}`}>
                  <div className="flex items-center gap-1">
                    {hasSubtasks ? (
                      <button
                        type="button"
                        onClick={() => onToggleSubtasks(r)}
                        title={isSubExpanded ? 'Hide subtasks' : `Show ${r.subtasks.length} subtask(s)`}
                        className={`p-0.5 rounded hover:bg-[var(--primary)]/10 transition-colors ${isSubExpanded ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
                      >
                        <ChevronRight size={14} className={`transition-transform ${isSubExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    ) : hasVersions ? (
                      <button
                        type="button"
                        onClick={() => onToggleVersionsExpand(r)}
                        title={isVerExpanded ? 'Hide previous versions' : 'Show previous versions'}
                        className={`p-0.5 rounded hover:bg-[var(--primary)]/10 transition-colors ${isVerExpanded ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
                      >
                        <ChevronRight size={14} className={`transition-transform ${isVerExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    ) : (
                      <span className="inline-block w-[20px]" aria-hidden />
                    )}
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">{idx + 1}</span>
                  </div>
                </td>
                <td className={`px-3 py-2 sticky left-16 ${isSelected ? 'bg-[var(--primary)]/5' : 'bg-[var(--surface)]'}`}>
                  <EditableTextCell
                    value={r.title}
                    onSave={(v) => onPatch(r.taskId, { title: v })}
                    width="w-52"
                  />
                  {r.planning.drawingCode && (
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{r.planning.drawingCode}</p>
                  )}
                  {r.stage === 'Revision Required' && r.drawing?.rejectionReason && (
                    <p className="mt-1 text-[10px] text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/30 rounded px-1.5 py-0.5 max-w-[260px] truncate" title={r.drawing.rejectionReason}>
                      <span className="font-bold">REVISION: </span>{r.drawing.rejectionReason}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2"><StageBadge stage={r.stage} /></td>
                <td className="px-3 py-2">
                  <EditableWorkStatusCell
                    value={r.workStatus}
                    onSave={(v) => onPatch(r.taskId, { workStatus: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditablePriorityCell
                    value={r.priority}
                    onSave={(p) => onPatch(r.taskId, { priority: p })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableTextCell
                    value={r.planning.zoneName}
                    placeholder="Zone"
                    autoSize
                    onSave={(v) => onPatch(r.taskId, { planning: { zoneName: v } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableTextCell
                    value={r.planning.floor}
                    placeholder="Floor"
                    autoSize
                    onSave={(v) => onPatch(r.taskId, { planning: { floor: v } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableTextCell
                    value={r.planning.area}
                    placeholder="Area"
                    autoSize
                    onSave={(v) => onPatch(r.taskId, { planning: { area: v } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <DesignerCell
                    value={r.assignedTo}
                    onChange={(userId) => onPatch(r.taskId, { assignedTo: userId || null })}
                    restrictToIds={teamUserIds}
                  />
                </td>
                <td className="px-3 py-2">
                  <ChecklistCell row={r} onOpen={() => onOpenChecklist(r)} />
                </td>
                <td className="px-3 py-2">
                  <EditableDateCell
                    value={r.planning.plannedStartDate}
                    disabled={parentDatesLocked}
                    onSave={(iso) => sched.onScheduleDateEdit(r, { planning: { plannedStartDate: iso } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableDateCell
                    value={r.planning.plannedEndDate}
                    disabled={parentDatesLocked}
                    onSave={(iso) => sched.onScheduleDateEdit(r, { planning: { plannedEndDate: iso } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableDurationCell
                    value={r.durationDays}
                    startDate={r.planning.plannedStartDate}
                    disabled={parentDatesLocked}
                    onSave={(n) => sched.onDurationEdit(r, n)}
                  />
                </td>
                <td className="px-3 py-2"><ScheduleStatusBadge status={r.scheduleStatus} /></td>
                <td className="px-3 py-2">
                  <DependencyChip count={(r.dependsOn || []).length} onClick={() => sched.onOpenDependency(r)} disabled={!canSchedule} />
                </td>
                <td className="px-3 py-2">
                  <AutoShiftedIndicator shiftCount={r.shiftCount} onClick={() => sched.onOpenShiftHistory(r)} />
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell
                    value={r.planning.plannedHours}
                    onSave={(n) => onPatch(r.taskId, { planning: { plannedHours: n } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell
                    value={r.planning.actualHours}
                    onSave={(n) => onPatch(r.taskId, { planning: { actualHours: n } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <ProgressCell value={r.planning.progressPercent} />
                </td>
                <td className="px-3 py-2"><DelayBadge days={r.delayDays} /></td>
                <td className="px-3 py-2">
                  <DrawingCell
                    drawing={r.drawing}
                    onView={() => onViewDrawing(r)}
                    onShowVersions={() => onShowVersions(r)}
                    onUpload={(file) => onUpload(r, file)}
                    uploading={uploadingTaskId === String(r.taskId)}
                    expanded={expandedVersionsTaskId === String(r.taskId)}
                    onToggleExpand={() => onToggleVersionsExpand(r)}
                    versionsState={versionsCache[String(r.taskId)]}
                    onViewVersion={onViewVersion}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onOpenNotes(r)}
                      className={`p-1 rounded ${r.notes ? 'text-[var(--primary)] hover:bg-[var(--primary)]/10' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg)]'}`}
                      title={r.notes ? 'View / edit notes' : 'Add notes'}
                    >
                      <MessageSquare size={12} />
                    </button>
                    {!r.isSubtask && (
                      <button
                        type="button"
                        onClick={() => sched.onAddSubtask(r)}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
                        title="Add subtask"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                    <LockToggleCell locked={!!r.scheduleLocked} disabled={!canSchedule} onToggle={(v) => sched.onToggleLock(r, v)} />
                    <button
                      type="button"
                      onClick={() => sched.onOpenShiftHistory(r)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg)]"
                      title="Shift history"
                    >
                      <HistoryIcon size={12} />
                    </button>
                    <button
                    type="button"
                    onClick={() => onDelete(r.taskId, r.title, r)}
                    className="text-[var(--text-muted)] hover:text-[var(--error)] p-1 rounded hover:bg-[var(--error)]/10"
                    title="Delete row"
                  >
                    <Trash2 size={12} />
                  </button>
                  </div>
                </td>
              </tr>
              {isSubExpanded && hasSubtasks && (
                <>
                  {r.subtasks.map((sub) => (
                    <SubtaskRow
                      key={sub.taskId}
                      sub={sub}
                      teamUserIds={teamUserIds}
                      canSchedule={canSchedule}
                      h={sched.subtaskHandlers}
                    />
                  ))}
                  <tr className="bg-[var(--bg)]/40">
                    <td className="px-2 py-1.5 sticky left-0 z-[5] bg-[var(--bg)]" />
                    <td className="px-3 py-1.5 sticky left-8 z-[5] bg-[var(--bg)]" />
                    <td colSpan={Math.max(1, TOTAL_COLS - 2)} className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => sched.onAddSubtask(r)}
                        className="inline-flex items-center gap-1 pl-3 text-[11px] font-bold text-[var(--primary)] hover:underline"
                      >
                        <Plus size={12} /> Add subtask
                      </button>
                    </td>
                  </tr>
                </>
              )}
              {isVerExpanded && (
                <VersionRows
                  row={r}
                  state={versionsCache[String(r.taskId)]}
                  onViewVersion={onViewVersion}
                  totalCols={TOTAL_COLS}
                />
              )}
              </React.Fragment>
            );
          })}
            </React.Fragment>
            );
          })}
          {canManagePhases && (
            <AddDashedRow
              colSpan={TOTAL_COLS}
              label="Add Phase"
              onClick={onAddPhase}
            />
          )}
        </tbody>
      </table>
    </div>
  );
};

// Tiny modal for adding a per-project phase — single name field with a
// client-side duplicate check (server re-validates case-insensitively).
const AddPhaseModal = ({ open, phases, onClose, onConfirm, busy }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (open) setName(''); }, [open]);
  if (!open) return null;

  const trimmed = name.trim();
  const isDuplicate = !!trimmed && (phases || []).some(
    (p) => String(p.name || '').trim().toLowerCase() === trimmed.toLowerCase()
  );
  const canSubmit = !!trimmed && !isDuplicate && !busy;

  return (
    <ModalShell
      title="Add Phase"
      subtitle="Adds a new phase group to this project's master sheet only — templates are not affected."
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={!canSubmit}
            onClick={() => onConfirm(trimmed)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Add Phase
          </button>
        </>
      )}
    >
      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Phase Name</label>
      <input
        value={name}
        autoFocus
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) onConfirm(trimmed); }}
        placeholder="e.g. Snag List"
        className="w-full px-2.5 py-1.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
      />
      {isDuplicate && (
        <p className="text-[11px] text-[var(--error)] mt-1.5">A phase with this name already exists.</p>
      )}
    </ModalShell>
  );
};

// ─── Bulk action modals ──────────────────────────────────────────────────────
// All follow the shared ModalShell from sheetCells: centred card on a black
// backdrop with header, body, and Cancel + Confirm buttons. Each handles its
// own input state.

const AssignDesignerModal = ({ open, count, onClose, onConfirm, busy, restrictToIds }) => {
  const [user, setUser] = useState(null);
  useEffect(() => { if (open) setUser(null); }, [open]);
  if (!open) return null;
  return (
    <ModalShell
      title={`Assign designer to ${count} task${count !== 1 ? 's' : ''}`}
      subtitle="Existing assignee will be overwritten."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={!user?._id || busy}
            onClick={() => onConfirm(user._id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Assign
          </button>
        </>
      )}
    >
      <EmployeePicker
        value={user}
        onChange={setUser}
        placeholder="Pick designer…"
        restrictToIds={restrictToIds}
        emptyHint="No team members — build the project team first"
      />
    </ModalShell>
  );
};

const SetDatesModal = ({ open, count, onClose, onConfirm, busy }) => {
  const [start, setStart] = useState('');
  const [end,   setEnd]   = useState('');
  useEffect(() => { if (open) { setStart(''); setEnd(''); } }, [open]);
  if (!open) return null;
  const canSubmit = start && end && new Date(end) >= new Date(start);
  return (
    <ModalShell
      title={`Set planned dates for ${count} task${count !== 1 ? 's' : ''}`}
      subtitle="Same start + deadline applied to every selected task."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={!canSubmit || busy}
            onClick={() => onConfirm({ start, end })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Apply
          </button>
        </>
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Planned Start</label>
          <DatePicker value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Deadline</label>
          <DatePicker value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {start && end && new Date(end) < new Date(start) && (
        <p className="text-[11px] text-[var(--error)] mt-2">Deadline cannot be before start date.</p>
      )}
    </ModalShell>
  );
};

const ShiftDatesModal = ({ open, count, onClose, onConfirm, busy }) => {
  const [days, setDays] = useState(0);
  useEffect(() => { if (open) setDays(0); }, [open]);
  if (!open) return null;
  return (
    <ModalShell
      title={`Shift dates for ${count} task${count !== 1 ? 's' : ''}`}
      subtitle="Use a negative number to pull dates earlier."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={!Number(days) || busy}
            onClick={() => onConfirm(Number(days))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Shift
          </button>
        </>
      )}
    >
      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Shift by (days)</label>
      <input
        type="number"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
        placeholder="e.g. 7 or -3"
        autoFocus
      />
      <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Both Planned Start and Deadline shift together.</p>
    </ModalShell>
  );
};

const AutoScheduleModal = ({ open, projectStartDate, onClose, onConfirm, busy }) => {
  const [duration,  setDuration]  = useState(3);
  const [overwrite, setOverwrite] = useState(false);
  useEffect(() => { if (open) { setDuration(3); setOverwrite(false); } }, [open]);
  if (!open) return null;
  return (
    <ModalShell
      title="Auto-Schedule from Template"
      subtitle={projectStartDate
        ? `Project start: ${fmt(projectStartDate)} — each task's Day offset (D+0, D+5, …) is added to this date.`
        : 'Project has no start date — set one before auto-scheduling.'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={!projectStartDate || busy}
            onClick={() => onConfirm({ defaultDurationDays: Number(duration) || 3, overwriteExisting: overwrite })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Auto-Schedule
          </button>
        </>
      )}
    >
      <div>
        <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Default duration per task (days)</label>
        <input
          type="number" min="1" max="60"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Deadline = Planned Start + this many days. You can fine-tune per row afterward.</p>
      </div>
      <label className="flex items-center gap-2 mt-3 text-xs text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          className="accent-[var(--primary)]"
        />
        Overwrite tasks that already have planned dates
      </label>
    </ModalShell>
  );
};

/**
 * Confirmation modal for the "Make Plan Effective" action.
 *
 * Loads the preview synchronously when opened so the user can see what's
 * about to happen — how many tasks will be delegated, how many designers
 * will be notified, how many rows have no assignee yet. Mail + WhatsApp
 * are opt-in via checkboxes; in-app notifications always fire.
 */
const ActivatePlanModal = ({ open, projectId, onClose, onConfirm, busy }) => {
  const [preview, setPreview]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [notifyMail, setNotifyMail] = useState(true);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    setPreview(null);
    setError(null);
    setLoading(true);
    setNotifyMail(true);
    setNotifyWhatsApp(false);
    pmsService.getPlanActivationPreview(projectId)
      .then(setPreview)
      .catch((e) => setError(e?.message || 'Failed to load preview'))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  if (!open) return null;

  const canConfirm = !loading && !error && preview && preview.toDelegate > 0 && !preview.alreadyEffective;

  return (
    <ModalShell
      title="Make Plan Effective?"
      subtitle="This will delegate every assigned task to its owner and lock the project plan."
      onClose={onClose}
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || busy}
            onClick={() => onConfirm({ notifyMail, notifyWhatsApp })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--success)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            <Rocket size={12} /> Confirm & Activate
          </button>
        </>
      )}
    >
      {loading && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-3">
          <Loader2 size={14} className="animate-spin" /> Loading preview…
        </div>
      )}

      {error && (
        <div className="text-xs text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {preview && preview.alreadyEffective && (
        <div className="text-xs text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg p-2.5">
          This plan was already activated on {fmtDateTime(preview.effectiveAt)}. You can't activate it twice.
        </div>
      )}

      {preview && !preview.alreadyEffective && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2.5">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Will Delegate</div>
              <div className="text-lg font-extrabold text-[var(--success)]">{preview.toDelegate}</div>
              <div className="text-[10px] text-[var(--text-muted)]">tasks → {preview.uniqueAssignees} team member{preview.uniqueAssignees !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2.5">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Unassigned</div>
              <div className={`text-lg font-extrabold ${preview.withoutAssignee > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>{preview.withoutAssignee}</div>
              <div className="text-[10px] text-[var(--text-muted)]">tasks (will be skipped)</div>
            </div>
          </div>

          {preview.toDelegate === 0 && (
            <p className="text-xs text-[var(--error)] mt-3">
              No tasks have an assignee yet. Assign team members in the master sheet before activating.
            </p>
          )}

          {preview.toDelegate > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Notification Channels
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="accent-[var(--primary)]"
                  />
                  In-app notification (always sent)
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyMail}
                    onChange={(e) => setNotifyMail(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  Send Email
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyWhatsApp}
                    onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  Send WhatsApp
                </label>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-2">
                Once activated, the plan is locked. Future re-assignments will use the regular reassign flow.
              </p>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
};

/**
 * Two-step import wizard:
 *   1. File pick + Preview  → dry-run on the server, show diff stats + errors
 *   2. Confirm Import       → re-runs without dryRun, writes updates
 *
 * Server enforces "update existing rows only" — creating tasks via import is
 * intentionally not supported in v1 (assignee name matching is too fuzzy).
 */
const ImportExcelModal = ({ open, projectId, onClose, onDone }) => {
  const toast = useToast();
  const [file, setFile]       = useState(null);
  const [busy, setBusy]       = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError]     = useState(null);
  const [templateBusy, setTemplateBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setBusy(false);
    setPreview(null);
    setError(null);
    setTemplateBusy(false);
  }, [open]);

  if (!open) return null;

  const downloadTemplate = async () => {
    setTemplateBusy(true);
    try {
      const blob = await pmsService.getPlannerImportTemplate();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `master-sheet_import-template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err?.message || 'Failed to download template');
    } finally {
      setTemplateBusy(false);
    }
  };

  const handlePickFile = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    setError(null);
    e.target.value = ''; // allow re-picking the same file
  };

  const runPreview = async () => {
    if (!file || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await pmsService.importPlannerExcel(projectId, file, { dryRun: true });
      setPreview(res);
    } catch (err) {
      setError(err?.message || 'Failed to preview import');
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    if (!file || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await pmsService.importPlannerExcel(projectId, file, { dryRun: false });
      toast.success(`Imported — ${res.rowsUpdated} row${res.rowsUpdated !== 1 ? 's' : ''} updated, ${res.rowsSkipped} skipped, ${res.rowsFailed} failed`);
      onDone?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Failed to import');
      setBusy(false);
    }
  };

  const canPreview = !!file && !busy && !preview;
  const canCommit  = !!preview && !busy && preview.rowsUpdated > 0;

  return (
    <ModalShell
      title="Import from Excel"
      subtitle="Updates existing rows only. Use the Export button first to get a sheet with valid Task IDs."
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          {!preview && (
            <button type="button" onClick={runPreview} disabled={!canPreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Preview
            </button>
          )}
          {preview && (
            <button type="button" onClick={runCommit} disabled={!canCommit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--success)] rounded-lg hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Confirm & Import
            </button>
          )}
        </>
      )}
    >
      {/* First-time helper — download a blank template with headers + Instructions sheet */}
      <div className="mb-3 flex items-center justify-between gap-2 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg px-2.5 py-2">
        <div className="text-[11px] text-[var(--text-secondary)] leading-snug">
          <span className="font-bold text-[var(--text-primary)]">First time?</span>{' '}
          Download a blank template to see the required columns and rules.
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={templateBusy}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-[var(--primary)] border border-[var(--primary)]/40 bg-[var(--surface)] rounded-md hover:bg-[var(--primary)]/10 disabled:opacity-50 whitespace-nowrap"
        >
          {templateBusy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          Download Template
        </button>
      </div>

      {/* File picker */}
      <label className="block">
        <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
          Excel File (.xlsx, max 5 MB)
        </div>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handlePickFile}
          disabled={busy}
          className="block w-full text-xs text-[var(--text-secondary)]
                     file:mr-3 file:py-1.5 file:px-3
                     file:rounded-md file:border-0
                     file:text-xs file:font-bold
                     file:bg-[var(--primary)]/10 file:text-[var(--primary)]
                     hover:file:bg-[var(--primary)]/20"
        />
        {file && (
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
            Selected: <span className="font-semibold text-[var(--text-secondary)]">{file.name}</span> ({Math.round(file.size / 1024)} KB)
          </p>
        )}
      </label>

      {error && (
        <div className="mt-3 text-xs text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {/* Preview summary */}
      {preview && (
        <div className="mt-4 space-y-2.5">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-center">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Rows Read</div>
              <div className="text-base font-extrabold text-[var(--text-primary)]">{preview.rowsRead}</div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-center">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Will Update</div>
              <div className="text-base font-extrabold text-[var(--success)]">{preview.rowsUpdated}</div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-center">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Skipped</div>
              <div className="text-base font-extrabold text-[var(--text-muted)]">{preview.rowsSkipped}</div>
            </div>
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 text-center">
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Errors</div>
              <div className={`text-base font-extrabold ${preview.rowsFailed > 0 ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                {preview.rowsFailed}
              </div>
            </div>
          </div>

          {preview.errors?.length > 0 && (
            <div className="max-h-40 overflow-y-auto bg-[var(--error)]/5 border border-[var(--error)]/20 rounded-lg p-2 text-[11px]">
              <p className="font-bold text-[var(--error)] mb-1.5">
                Issues found ({preview.errors.length}{preview.truncated ? '+' : ''}):
              </p>
              <ul className="space-y-0.5">
                {preview.errors.map((e, i) => (
                  <li key={i} className="text-[var(--text-secondary)]">
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">Row {e.row}</span> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.rowsUpdated === 0 && preview.rowsFailed === 0 && (
            <p className="text-[11px] text-[var(--warning)]">
              Nothing to update — the file has no changes vs. the live data.
            </p>
          )}
        </div>
      )}
    </ModalShell>
  );
};

// ─── Bulk action toolbar ─────────────────────────────────────────────────────
const BulkToolbar = ({ selectedCount, onAssign, onSetDates, onShiftDates, onLock, onUnlock, canSchedule, onClear }) => (
  <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-lg p-3 flex flex-wrap items-center gap-2">
    <span className="text-xs font-extrabold text-[var(--primary)]">
      {selectedCount} selected
    </span>
    <div className="h-4 w-px bg-[var(--primary)]/30 mx-1" />
    <button type="button" onClick={onAssign}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] bg-[var(--surface)] rounded-md hover:border-[var(--primary)] hover:text-[var(--primary)]">
      <UserCog size={12} /> Assign Designer
    </button>
    <button type="button" onClick={onSetDates}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] bg-[var(--surface)] rounded-md hover:border-[var(--primary)] hover:text-[var(--primary)]">
      <CalendarRange size={12} /> Set Dates
    </button>
    <button type="button" onClick={onShiftDates}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] bg-[var(--surface)] rounded-md hover:border-[var(--primary)] hover:text-[var(--primary)]">
      <ArrowLeftRight size={12} /> Shift Dates
    </button>
    {canSchedule && (
      <>
        <button type="button" onClick={onLock}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] bg-[var(--surface)] rounded-md hover:border-[var(--warning)] hover:text-[var(--warning)]">
          <Lock size={12} /> Lock
        </button>
        <button type="button" onClick={onUnlock}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] bg-[var(--surface)] rounded-md hover:border-[var(--primary)] hover:text-[var(--primary)]">
          <Lock size={12} className="opacity-50" /> Unlock
        </button>
      </>
    )}
    <div className="ml-auto">
      <button type="button" onClick={onClear}
        className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <X size={12} /> Clear
      </button>
    </div>
  </div>
);

/**
 * Empty state for a freshly initiated project — no template selected yet, no
 * rows. The master sheet is the single place where the plan gets picked now
 * (template selection was removed from the initiation form).
 */
const NoTemplateEmptyState = ({ canSelect, onSelect, onAddRow }) => (
  <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-12 text-center">
    <Layers size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
    <p className="text-sm font-semibold text-[var(--text-secondary)]">No plan yet</p>
    <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
      Select a workflow template to seed this project's master sheet with phases and
      tasks — or start from scratch with manual rows. Everything you change here applies
      to this project only.
    </p>
    <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
      {canSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90"
        >
          <Layers size={13} /> Select Template
        </button>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)] italic">
          Ask a manager to select a template for this project.
        </p>
      )}
      <button
        type="button"
        onClick={onAddRow}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[var(--primary)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 rounded-lg hover:bg-[var(--primary)]/15"
      >
        <Plus size={13} /> Add Drawing Row
      </button>
    </div>
  </div>
);

const ProjectPlannerTab = ({ project }) => {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addPhase, setAddPhase] = useState('');
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({ search: '', zone: '', designer: '', workStatus: '', delayedOnly: false });
  const [designers, setDesigners] = useState([]);
  const [drawerRow, setDrawerRow] = useState(null); // row whose revisions are open
  const [previewDrawing, setPreviewDrawing] = useState(null); // drawing rendered in the preview modal
  // Inline version-history dropdown — { taskId | null } toggles open, cache
  // keeps the fetched versions so re-expanding is instant.
  const [expandedVersionsTaskId, setExpandedVersionsTaskId] = useState(null);
  const [versionsCache, setVersionsCache]   = useState({}); // { [taskId]: { versions, loading, error } }

  // Bulk selection + modals
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [setDatesOpen, setSetDatesOpen] = useState(false);
  const [shiftOpen,    setShiftOpen]    = useState(false);
  const [autoOpen,     setAutoOpen]     = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateBusy, setActivateBusy] = useState(false);

  // Project-specific template switch (does NOT touch the global default)
  const [changeTplOpen, setChangeTplOpen] = useState(false);
  const [changeTplBusy, setChangeTplBusy] = useState(false);
  const canChangeTemplate = !!hasPermission?.('projects.customize_plan');

  // Per-project phase management (add / rename / delete on planSnapshot)
  const canEditPlanner = !!hasPermission?.('planner.edit');
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseBusy,    setPhaseBusy]    = useState(false);
  const [phaseBudgetTarget, setPhaseBudgetTarget] = useState(null);
  const [phaseBudgetBusy,   setPhaseBudgetBusy]   = useState(false);

  // Inline upload + notes
  const [uploadingTaskId, setUploadingTaskId] = useState(null);
  const [notesRow,        setNotesRow]        = useState(null);
  const [notesBusy,       setNotesBusy]       = useState(false);
  const [checklistRow,    setChecklistRow]    = useState(null);
  const [checklistBusy,   setChecklistBusy]   = useState(false);
  const [importOpen,      setImportOpen]      = useState(false);
  const [exporting,       setExporting]       = useState(false);

  // Scheduling engine — subtasks + cascade-aware edits
  const [expandedSubtasksTaskId, setExpandedSubtasksTaskId] = useState(null);
  const [subtaskModal,   setSubtaskModal]   = useState({ open: false, mode: 'create', parent: null, subtask: null });
  const [subtaskBusy,    setSubtaskBusy]    = useState(false);
  const [shiftHistoryRow, setShiftHistoryRow] = useState(null);
  const [dependencyRow,  setDependencyRow]  = useState(null);
  const [dependencyBusy, setDependencyBusy] = useState(false);
  const [pendingShift,   setPendingShift]   = useState(null); // { row, payload } awaiting a reason
  const [shiftBusy,      setShiftBusy]      = useState(false);
  const [recalcOpen,     setRecalcOpen]     = useState(false);
  const [recalcBusy,     setRecalcBusy]     = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [settingsBusy,   setSettingsBusy]   = useState(false);
  const canSchedule = !!hasPermission?.('planner.schedule.shift');
  const canRecalc   = !!hasPermission?.('planner.schedule.recalculate');

  const projectId = project?._id;

  // Scope the master-sheet designer pickers to the people on the project team
  // (built via the "Build Team" flow → project.assignments). When no team has
  // been built yet we fall back to all assignable users (null = no restriction)
  // so the sheet is never blocked.
  const teamUserIds = useMemo(() => {
    const ids = getAllAssignedUsers(project).map((u) => String(u._id));
    return ids.length ? ids : null;
  }, [project]);

  // Flat list of every task (parents + subtasks) for the dependency picker.
  const allTaskRows = useMemo(() => {
    const out = [];
    for (const r of (data?.rows || [])) {
      out.push({ taskId: String(r.taskId), title: r.title, phase: r.phase });
      for (const s of (r.subtasks || [])) out.push({ taskId: String(s.taskId), title: s.title, phase: s.phase });
    }
    return out;
  }, [data]);

  // Candidates for the dependency picker — exclude self + direct children so the
  // UI can't trivially build a cycle (the backend re-validates regardless).
  const dependencyCandidates = useMemo(() => {
    if (!dependencyRow) return [];
    const selfId = String(dependencyRow.taskId);
    const childIds = new Set((dependencyRow.subtasks || []).map((s) => String(s.taskId)));
    return allTaskRows.filter((t) => t.taskId !== selfId && !childIds.has(t.taskId));
  }, [dependencyRow, allTaskRows]);

  const fetchSheet = useCallback(async (isRefresh = false) => {
    if (!projectId) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.zone)          params.zone = filters.zone;
      if (filters.designer)      params.designer = filters.designer;
      if (filters.workStatus)    params.workStatus = filters.workStatus;
      if (filters.delayedOnly)   params.delayedOnly = true;
      const res = await pmsService.getPlannerMaster(projectId, params);
      setData(res);
    } catch (err) {
      setError(err?.message || 'Failed to load planner');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, filters]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  useEffect(() => {
    pmsService.getAssignableUsers()
      .then((res) => setDesigners(Array.isArray(res) ? res : (res?.users || [])))
      .catch(() => setDesigners([]));
  }, []);

  const handlePatch = useCallback(async (taskId, patch) => {
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => {
          if (r.taskId !== taskId) return r;
          const next = { ...r, ...patch };
          if (patch.planning) next.planning = { ...r.planning, ...patch.planning };
          return next;
        }),
      };
    });
    try {
      await pmsService.patchPlannerRow(taskId, patch);
      // Re-fetch to get derived fields (delayDays, plannedDays, totals, populated assignedTo)
      fetchSheet(true);
    } catch (err) {
      alert(err?.message || 'Failed to save change');
      fetchSheet(true);
    }
  }, [fetchSheet]);

  const handleDelete = useCallback(async (taskId, title, row) => {
    const assigneeName = row?.assignedTo?.name;
    const wasDelegated = !!row?.delegatedAt;
    const message = wasDelegated
      ? `This task was already delegated${assigneeName ? ` to ${assigneeName}` : ''} on ${fmt(row.delegatedAt)}.\n\nDelete "${title}" anyway? They will not be notified about the removal.\n\nAttached drawings will be detached but kept for audit.`
      : `Delete planner row "${title}"? Attached drawings will be detached but kept for audit.`;
    if (!window.confirm(message)) return;
    try {
      await pmsService.deletePlannerRow(taskId);
      fetchSheet(true);
    } catch (err) {
      alert(err?.message || 'Failed to delete row');
    }
  }, [fetchSheet]);

  const handleCreate = useCallback(async (payload) => {
    setCreating(true);
    try {
      await pmsService.createPlannerRow(projectId, payload);
      toast.success(`Row created: ${payload.title}`);
      setShowAdd(false);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to create row');
    } finally {
      setCreating(false);
    }
  }, [projectId, fetchSheet, toast]);

  // ─── Scheduling engine handlers ───────────────────────────────────────────
  const handleToggleSubtasks = useCallback((row) => {
    const id = String(row.taskId);
    setExpandedSubtasksTaskId((prev) => (prev === id ? null : id));
  }, []);

  // Subtask inline edits reuse the planner patch endpoint (works on any task);
  // no optimistic update since subtasks live nested under parents.
  const handleSubtaskPatch = useCallback(async (subtaskId, patch) => {
    try {
      await pmsService.patchPlannerRow(subtaskId, patch);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save change');
      fetchSheet(true);
    }
  }, [fetchSheet, toast]);

  const handleAddSubtask = useCallback((parentRow) => {
    setSubtaskModal({ open: true, mode: 'create', parent: parentRow, subtask: null });
  }, []);

  const handleSubmitSubtask = useCallback(async (payload) => {
    setSubtaskBusy(true);
    try {
      if (subtaskModal.mode === 'edit' && subtaskModal.subtask) {
        await pmsService.updateSubtask(subtaskModal.subtask.taskId, payload);
        toast.success('Subtask updated');
      } else {
        await pmsService.createSubtask(projectId, subtaskModal.parent.taskId, payload);
        toast.success('Subtask added');
        setExpandedSubtasksTaskId(String(subtaskModal.parent.taskId));
      }
      setSubtaskModal({ open: false, mode: 'create', parent: null, subtask: null });
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save subtask');
    } finally {
      setSubtaskBusy(false);
    }
  }, [subtaskModal, projectId, fetchSheet, toast]);

  // Date edit on a row: if it has dependents, capture a reason and cascade;
  // otherwise save directly (no cascade needed).
  const handleScheduleDateEdit = useCallback((row, patch) => {
    if (row.hasDependents) {
      setPendingShift({ row, patch });
      return;
    }
    handleSubtaskPatch(row.taskId, patch); // patchPlannerRow works for parents + subtasks
  }, [handleSubtaskPatch]);

  // Duration edit always routes through the scheduling engine (it recomputes the
  // end date and cascades). A reason is required when there are dependents.
  const handleDurationEdit = useCallback(async (row, durationDays) => {
    if (row.hasDependents) {
      setPendingShift({ row, payload: { durationDays } });
      return;
    }
    try {
      await pmsService.manualShiftTask(row.taskId, { durationDays, reason: 'Duration adjusted', cascade: true });
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update duration');
    }
  }, [fetchSheet, toast]);

  // Confirm a cascading shift after the reason modal.
  const handleConfirmShift = useCallback(async (reason) => {
    if (!pendingShift) return;
    const { row, patch, payload } = pendingShift;
    setShiftBusy(true);
    try {
      let body;
      if (payload) {
        body = { ...payload, reason, cascade: true };
      } else if (patch?.planning?.plannedStartDate !== undefined) {
        body = { plannedStartDate: patch.planning.plannedStartDate, reason, cascade: true };
      } else if (patch?.planning?.plannedEndDate !== undefined) {
        body = { plannedEndDate: patch.planning.plannedEndDate, reason, cascade: true };
      } else {
        body = { reason, cascade: true };
      }
      await pmsService.manualShiftTask(row.taskId, body);
      toast.success('Schedule shifted');
      setPendingShift(null);
      fetchSheet(true);
    } catch (err) {
      const code = err?.response?.data?.code;
      toast.error(code === 'DEPENDENCY_CYCLE'
        ? 'Circular dependency — schedule not shifted.'
        : (err?.response?.data?.message || err?.message || 'Failed to shift schedule'));
    } finally {
      setShiftBusy(false);
    }
  }, [pendingShift, fetchSheet, toast]);

  const handleToggleLock = useCallback(async (row, locked) => {
    try {
      await pmsService.patchPlannerRow(row.taskId, { scheduleLocked: locked });
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to toggle lock');
    }
  }, [fetchSheet, toast]);

  const handleSaveDependency = useCallback(async (ids) => {
    if (!dependencyRow) return;
    setDependencyBusy(true);
    try {
      if (dependencyRow.isSubtask) {
        await pmsService.updateSubtask(dependencyRow.taskId, { dependsOn: ids });
      } else {
        await pmsService.patchPlannerRow(dependencyRow.taskId, { dependsOn: ids });
      }
      setDependencyRow(null);
      fetchSheet(true);
    } catch (err) {
      const code = err?.response?.data?.code;
      toast.error(code === 'DEPENDENCY_CYCLE'
        ? 'That dependency would create a circular reference.'
        : (err?.response?.data?.message || err?.message || 'Failed to save dependencies'));
    } finally {
      setDependencyBusy(false);
    }
  }, [dependencyRow, fetchSheet, toast]);

  const handleSavePhaseBudget = useCallback(async (payload) => {
    setPhaseBudgetBusy(true);
    try {
      await pmsService.updatePhaseBudget(projectId, payload);
      toast.success('Phase budget saved');
      setPhaseBudgetTarget(null);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save phase budget');
    } finally {
      setPhaseBudgetBusy(false);
    }
  }, [projectId, fetchSheet, toast]);

  const handleSaveSettings = useCallback(async (payload) => {
    setSettingsBusy(true);
    try {
      await pmsService.updatePlannerSettings(projectId, payload);
      toast.success('Scheduling settings saved');
      setSettingsOpen(false);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save settings');
    } finally {
      setSettingsBusy(false);
    }
  }, [projectId, fetchSheet, toast]);

  const handleRecalc = useCallback(async () => {
    setRecalcBusy(true);
    try {
      const res = await pmsService.recalcProjectSchedule(projectId, { overwriteExisting: true });
      toast.success(`Schedule recalculated — ${res?.scheduled ?? 0} task(s) dated`);
      setRecalcOpen(false);
      fetchSheet(true);
    } catch (err) {
      const code = err?.response?.data?.code;
      toast.error(code === 'DEPENDENCY_CYCLE'
        ? 'Circular dependency — schedule not recalculated.'
        : (err?.response?.data?.message || err?.message || 'Failed to recalculate'));
    } finally {
      setRecalcBusy(false);
    }
  }, [projectId, fetchSheet, toast]);

  // Open the in-app preview modal — gives reviewers (manager / MD / PD) the
  // annotation toolbar and approve / reject controls. The modal fetches its own
  // signed URL via pmsService.getDrawingPreviewUrl, so no need to pre-fetch.
  const handleViewDrawing = useCallback((row) => {
    if (!row?.drawing?._id) return;
    setPreviewDrawing(row.drawing);
  }, []);

  const handleShowVersions = useCallback((row) => {
    setDrawerRow(row);
  }, []);

  // Flatten the API payload (multiple Drawing docs per task) into a versions
  // list. Mirrors the side drawer's logic so the inline dropdown stays in sync.
  const flattenVersions = useCallback((drawings) => {
    const out = [];
    for (const d of (drawings || [])) {
      out.push({
        drawingId:    d._id,
        version:      d.version,
        isCurrent:    true,
        status:       d.status,
        fileName:     d.fileName,
        // createdAt = when THIS version was uploaded (updatedAt shifts on status
        // changes), so each row shows its own upload date/time.
        uploadedAt:   d.createdAt || d.updatedAt,
        uploadedBy:   d.uploadedBy,
        notes:        d.revisionNotes,
        rejectionReason: d.rejectionReason,
        approvalDate: d.approvalDate,
        rejectedAt:   d.rejectedAt,
        zoneName:     d.zoneName,
        floor:        d.floor,
        area:         d.area,
        checklistSnapshot: d.checklistSnapshot,
        taskSnapshot: d.taskSnapshot,
        historyVersion: null,
      });
      for (const r of (d.revisionHistory || [])) {
        out.push({
          drawingId:  d._id,
          version:    r.version,
          isCurrent:  false,
          status:     'archived',
          fileName:   r.fileName,
          uploadedAt: r.uploadedAt,
          uploadedBy: r.uploadedBy,
          notes:      r.notes,
          historyVersion: r.version,
        });
      }
    }
    return out.sort((a, b) => (b.version || 0) - (a.version || 0));
  }, []);

  // Toggle the inline dropdown and lazy-fetch versions on first open.
  const toggleVersionsExpand = useCallback(async (row) => {
    const taskId = String(row.taskId);
    setExpandedVersionsTaskId((prev) => (prev === taskId ? null : taskId));
    if (versionsCache[taskId]?.versions) return; // already loaded
    setVersionsCache((prev) => ({ ...prev, [taskId]: { versions: null, loading: true, error: null } }));
    try {
      const res = await pmsService.getDrawingsByTask(row.taskId);
      const versions = flattenVersions(res?.drawings || []);
      setVersionsCache((prev) => ({ ...prev, [taskId]: { versions, loading: false, error: null } }));
    } catch (err) {
      setVersionsCache((prev) => ({
        ...prev,
        [taskId]: { versions: [], loading: false, error: err?.message || 'Failed to load versions' },
      }));
    }
  }, [versionsCache, flattenVersions]);

  // Click on an older version in the dropdown — open the in-app preview modal
  // pinned to that version.
  const handleViewVersion = useCallback(async (v) => {
    try {
      // Fetch the Drawing doc so the modal has full metadata. v.drawingId is
      // the parent doc; PreviewDrawingModal then loads the right annotations
      // for the requested version.
      const res = await pmsService.getDrawing?.(v.drawingId);
      const drawing = res?.drawing || { _id: v.drawingId, title: v.fileName, version: v.version, fileName: v.fileName };
      setPreviewDrawing({ ...drawing, __viewVersion: v.historyVersion ?? v.version });
    } catch {
      setPreviewDrawing({ _id: v.drawingId, title: v.fileName, version: v.version, fileName: v.fileName });
    }
  }, []);

  // ── Bulk selection helpers ─────────────────────────────────────────────
  const toggleRow = useCallback((taskId) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  const toggleAll = useCallback((select) => {
    setSelectedTaskIds(() => {
      if (!select) return new Set();
      return new Set((data?.rows || []).map((r) => String(r.taskId)));
    });
  }, [data]);

  const clearSelection = useCallback(() => setSelectedTaskIds(new Set()), []);

  // After a bulk op completes — close modal, clear selection, refetch.
  const finishBulk = useCallback(() => {
    setBulkBusy(false);
    setAssignOpen(false);
    setSetDatesOpen(false);
    setShiftOpen(false);
    setAutoOpen(false);
    clearSelection();
    fetchSheet(true);
  }, [clearSelection, fetchSheet]);

  const handleBulkAssign = useCallback(async (userId) => {
    if (!userId || selectedTaskIds.size === 0) return;
    setBulkBusy(true);
    try {
      await pmsService.bulkAssignPlanner({
        taskIds: Array.from(selectedTaskIds),
        assignedTo: userId,
      });
      finishBulk();
    } catch (err) {
      setBulkBusy(false);
      alert(err?.message || 'Bulk assign failed');
    }
  }, [selectedTaskIds, finishBulk]);

  const handleBulkSetDates = useCallback(async ({ start, end }) => {
    if (selectedTaskIds.size === 0) return;
    setBulkBusy(true);
    try {
      await pmsService.bulkDatesPlanner({
        taskIds: Array.from(selectedTaskIds),
        mode: 'set',
        plannedStartDate: start,
        plannedEndDate:   end,
      });
      finishBulk();
    } catch (err) {
      setBulkBusy(false);
      alert(err?.message || 'Bulk set-dates failed');
    }
  }, [selectedTaskIds, finishBulk]);

  const handleBulkShift = useCallback(async (days) => {
    if (selectedTaskIds.size === 0 || !days) return;
    setBulkBusy(true);
    try {
      await pmsService.bulkDatesPlanner({
        taskIds: Array.from(selectedTaskIds),
        mode: 'shift',
        shiftDays: days,
      });
      finishBulk();
    } catch (err) {
      setBulkBusy(false);
      alert(err?.message || 'Bulk shift failed');
    }
  }, [selectedTaskIds, finishBulk]);

  const handleBulkLock = useCallback(async (locked) => {
    if (selectedTaskIds.size === 0) return;
    setBulkBusy(true);
    try {
      await pmsService.bulkSchedulePatch({
        taskIds: Array.from(selectedTaskIds),
        patch: { scheduleLocked: locked },
      });
      toast.success(locked ? 'Rows locked' : 'Rows unlocked');
      finishBulk();
    } catch (err) {
      setBulkBusy(false);
      toast.error(err?.response?.data?.message || err?.message || 'Bulk lock failed');
    }
  }, [selectedTaskIds, finishBulk, toast]);

  // Inline upload — same multipart endpoint as the task workspace. Backend bumps
  // the version automatically via the (projectId, zoneName, title) lookup, so a
  // re-upload on an existing row creates the next version. Shares the FormData
  // builder + taskType→drawingType mapping with the Upload modal, and carries
  // the row's zone/floor/area onto the new drawing version.
  const handleInlineUpload = useCallback(async (row, file) => {
    if (!file || !projectId) return;
    setUploadingTaskId(String(row.taskId));
    try {
      const fd = buildDrawingUploadFormData({
        projectId,
        taskId:      row.taskId,
        title:       row.title || file.name,
        zoneName:    row.planning?.zoneName || '',
        floor:       row.planning?.floor || '',
        area:        row.planning?.area || '',
        drawingType: taskTypeToDrawingType(row.taskType),
        description: row.planning?.zoneName ? `Auto-uploaded from master sheet · ${row.planning.zoneName}` : '',
        file,
      });
      await pmsService.uploadDrawingFile(fd);
      fetchSheet(true);
    } catch (err) {
      alert(err?.message || 'Upload failed');
    } finally {
      setUploadingTaskId(null);
    }
  }, [projectId, fetchSheet]);

  const handleSaveNotes = useCallback(async (text) => {
    if (!notesRow) return;
    setNotesBusy(true);
    try {
      await pmsService.patchPlannerRow(notesRow.taskId, { notes: text });
      setNotesRow(null);
      fetchSheet(true);
    } catch (err) {
      alert(err?.message || 'Failed to save notes');
    } finally {
      setNotesBusy(false);
    }
  }, [notesRow, fetchSheet]);

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!projectId) return;
    setExporting(true);
    try {
      const blob = await pmsService.exportPlannerExcel(projectId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const code = data?.project?.code || projectId;
      a.href     = url;
      a.download = `master-sheet_${code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Master sheet exported');
    } catch (err) {
      toast.error(err?.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  }, [projectId, data, toast]);

  const handleSaveChecklist = useCallback(async (items) => {
    if (!checklistRow) return;
    setChecklistBusy(true);
    try {
      await pmsService.patchPlannerRow(checklistRow.taskId, { checklist: items });
      setChecklistRow(null);
      fetchSheet(true);
    } catch (err) {
      alert(err?.message || 'Failed to save checklist');
    } finally {
      setChecklistBusy(false);
    }
  }, [checklistRow, fetchSheet]);

  const handleAutoSchedule = useCallback(async ({ defaultDurationDays, overwriteExisting }) => {
    if (!projectId) return;
    setBulkBusy(true);
    try {
      const res = await pmsService.autoSchedulePlanner(projectId, { defaultDurationDays, overwriteExisting });
      finishBulk();
      if (res) {
        alert(`Auto-scheduled ${res.scheduled} of ${res.total} task${res.total !== 1 ? 's' : ''}.${res.skipped ? ` Skipped ${res.skipped} that already had dates.` : ''}`);
      }
    } catch (err) {
      setBulkBusy(false);
      alert(err?.message || 'Auto-schedule failed');
    }
  }, [projectId, finishBulk]);

  // ── Make Plan Effective ───────────────────────────────────────────────────
  const handleActivatePlan = useCallback(async ({ notifyMail, notifyWhatsApp }) => {
    if (!projectId) return;
    setActivateBusy(true);
    try {
      const res = await pmsService.activatePlan(projectId, { notifyMail, notifyWhatsApp });
      toast.success(`Plan activated — ${res.notified} task${res.notified !== 1 ? 's' : ''} delegated to ${res.uniqueAssignees} team member${res.uniqueAssignees !== 1 ? 's' : ''}`);
      setActivateOpen(false);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to activate plan');
    } finally {
      setActivateBusy(false);
    }
  }, [projectId, fetchSheet, toast]);

  // ── Change Master Sheet template (this project only) ─────────────────────
  const handleChangeTemplate = useCallback(async (templateId) => {
    if (!projectId || !templateId) return;
    setChangeTplBusy(true);
    try {
      const res = await pmsService.changePlannerTemplate(projectId, templateId);
      toast.success(`Template changed to "${res.templateName}" — ${res.tasksCreated} task${res.tasksCreated !== 1 ? 's' : ''} created`);
      setChangeTplOpen(false);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to change template');
    } finally {
      setChangeTplBusy(false);
    }
  }, [projectId, fetchSheet, toast]);

  // ── Per-project phase management (planSnapshot only — templates untouched) ─
  const handleAddPhase = useCallback(async (name) => {
    if (!projectId || !name) return;
    setPhaseBusy(true);
    try {
      await pmsService.addPlannerPhase(projectId, { name });
      toast.success(`Phase "${name}" added`);
      setAddPhaseOpen(false);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to add phase');
    } finally {
      setPhaseBusy(false);
    }
  }, [projectId, fetchSheet, toast]);

  const handleRenamePhase = useCallback(async (from, to) => {
    const next = String(to || '').trim();
    if (!projectId || !next || next === from) return;
    try {
      const res = await pmsService.renamePlannerPhase(projectId, { from, to: next });
      toast.success(`Phase renamed to "${next}"${res?.tasksUpdated ? ` — ${res.tasksUpdated} task${res.tasksUpdated !== 1 ? 's' : ''} updated` : ''}`);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to rename phase');
      fetchSheet(true);
    }
  }, [projectId, fetchSheet, toast]);

  const handleDeletePhase = useCallback(async (name) => {
    if (!projectId || !name) return;
    if (!window.confirm(`Delete phase "${name}" from this project's plan? Only empty phases can be deleted.`)) return;
    try {
      await pmsService.deletePlannerPhase(projectId, name);
      toast.success(`Phase "${name}" deleted`);
      fetchSheet(true);
    } catch (err) {
      toast.error(err?.message || 'Failed to delete phase');
    }
  }, [projectId, fetchSheet, toast]);

  const zones = useMemo(() => {
    const set = new Set();
    (data?.rows || []).forEach((r) => r.planning?.zoneName && set.add(r.planning.zoneName));
    return Array.from(set).sort();
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-[var(--text-muted)]" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--error)]/10 border border-[var(--error)]/40 text-[var(--error)] rounded-xl p-4 text-sm">
        {error}
      </div>
    );
  }

  // No-template detection — keyed off the template info, NOT just zero rows
  // (server-side filters can legitimately return an empty row set), and only
  // when no filters are active so the FilterBar never becomes unreachable.
  const hasTemplate    = !!data?.template?.baseTemplateId;
  const snapshotPhases = data?.phases || [];
  const filtersActive  = !!(filters.search.trim() || filters.zone || filters.designer || filters.workStatus || filters.delayedOnly);
  const showNoTemplateEmpty = !hasTemplate
    && (data?.rows || []).length === 0
    && snapshotPhases.length === 0
    && !filtersActive;

  return (
    <div className="space-y-3">
      <PlannerHeader
        project={data?.project}
        plan={data?.plan}
        counters={data?.counters}
        template={data?.template}
        canChangeTemplate={canChangeTemplate}
        onChangeTemplate={() => setChangeTplOpen(true)}
        onRefresh={() => fetchSheet(true)}
        onAddRow={() => { setAddPhase(''); setShowAdd(true); }}
        onAutoSchedule={() => setAutoOpen(true)}
        onActivate={() => setActivateOpen(true)}
        onExport={handleExport}
        onImport={() => setImportOpen(true)}
        onRecalculate={() => setRecalcOpen(true)}
        canRecalc={canRecalc}
        onOpenSettings={() => setSettingsOpen(true)}
        canEditPlanner={canEditPlanner}
        exporting={exporting}
        refreshing={refreshing}
      />
      {showNoTemplateEmpty ? (
        <NoTemplateEmptyState
          canSelect={canChangeTemplate}
          onSelect={() => setChangeTplOpen(true)}
          onAddRow={() => { setAddPhase(''); setShowAdd(true); }}
        />
      ) : (
        <>
          {!hasTemplate && (
            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
              <Layers size={13} className="text-[var(--primary)] shrink-0" />
              <span className="text-[11px] text-[var(--text-secondary)]">
                No template applied — rows below were added manually.
              </span>
              {canChangeTemplate && (
                <button
                  type="button"
                  onClick={() => setChangeTplOpen(true)}
                  className="ml-auto text-[11px] font-bold text-[var(--primary)] hover:underline"
                >
                  Select Template
                </button>
              )}
            </div>
          )}
          <FilterBar filters={filters} setFilters={setFilters} zones={zones} designers={designers} />
          {selectedTaskIds.size > 0 && (
            <BulkToolbar
              selectedCount={selectedTaskIds.size}
              onAssign={() => setAssignOpen(true)}
              onSetDates={() => setSetDatesOpen(true)}
              onShiftDates={() => setShiftOpen(true)}
              onLock={() => handleBulkLock(true)}
              onUnlock={() => handleBulkLock(false)}
              canSchedule={canSchedule}
              onClear={clearSelection}
            />
          )}
          <MasterSheetGrid
            rows={data?.rows || []}
            phases={snapshotPhases}
            onPatch={handlePatch}
            onDelete={handleDelete}
            onViewDrawing={handleViewDrawing}
            onShowVersions={handleShowVersions}
            onUpload={handleInlineUpload}
            onOpenNotes={setNotesRow}
            onOpenChecklist={setChecklistRow}
            uploadingTaskId={uploadingTaskId}
            selectedTaskIds={selectedTaskIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onAddToPhase={(phaseName) => { setAddPhase(phaseName || ''); setShowAdd(true); }}
            canManagePhases={canEditPlanner}
            onAddPhase={() => setAddPhaseOpen(true)}
            onRenamePhase={handleRenamePhase}
            onDeletePhase={handleDeletePhase}
            onEditPhaseBudget={setPhaseBudgetTarget}
            expandedVersionsTaskId={expandedVersionsTaskId}
            versionsCache={versionsCache}
            onToggleVersionsExpand={toggleVersionsExpand}
            onViewVersion={handleViewVersion}
            teamUserIds={teamUserIds}
            expandedSubtasksTaskId={expandedSubtasksTaskId}
            onToggleSubtasks={handleToggleSubtasks}
            canSchedule={canSchedule}
            sched={{
              onScheduleDateEdit: handleScheduleDateEdit,
              onDurationEdit: handleDurationEdit,
              onToggleLock: handleToggleLock,
              onOpenShiftHistory: setShiftHistoryRow,
              onOpenDependency: setDependencyRow,
              onAddSubtask: handleAddSubtask,
              subtaskHandlers: {
                onPatch: handleSubtaskPatch,
                onDelete: handleDelete,
                onOpenChecklist: setChecklistRow,
                onScheduleDateEdit: handleScheduleDateEdit,
                onDurationEdit: handleDurationEdit,
                onToggleLock: handleToggleLock,
                onOpenShiftHistory: setShiftHistoryRow,
                onOpenDependency: setDependencyRow,
              },
            }}
          />
        </>
      )}
      <AddRowModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={handleCreate}
        busy={creating}
        defaultPhase={addPhase}
        teamUserIds={teamUserIds}
      />
      <RevisionDrawer
        open={!!drawerRow}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
      />
      <PreviewDrawingModal
        drawing={previewDrawing}
        isOpen={!!previewDrawing}
        onClose={() => setPreviewDrawing(null)}
      />
      <AssignDesignerModal
        open={assignOpen}
        count={selectedTaskIds.size}
        onClose={() => !bulkBusy && setAssignOpen(false)}
        onConfirm={handleBulkAssign}
        busy={bulkBusy}
        restrictToIds={teamUserIds}
      />
      <SetDatesModal
        open={setDatesOpen}
        count={selectedTaskIds.size}
        onClose={() => !bulkBusy && setSetDatesOpen(false)}
        onConfirm={handleBulkSetDates}
        busy={bulkBusy}
      />
      <ShiftDatesModal
        open={shiftOpen}
        count={selectedTaskIds.size}
        onClose={() => !bulkBusy && setShiftOpen(false)}
        onConfirm={handleBulkShift}
        busy={bulkBusy}
      />
      <AutoScheduleModal
        open={autoOpen}
        projectStartDate={data?.project?.startDate}
        onClose={() => !bulkBusy && setAutoOpen(false)}
        onConfirm={handleAutoSchedule}
        busy={bulkBusy}
      />
      <NotesModal
        open={!!notesRow}
        row={notesRow}
        onClose={() => !notesBusy && setNotesRow(null)}
        onSave={handleSaveNotes}
        busy={notesBusy}
      />
      <ActivatePlanModal
        open={activateOpen}
        projectId={projectId}
        onClose={() => !activateBusy && setActivateOpen(false)}
        onConfirm={handleActivatePlan}
        busy={activateBusy}
      />
      <ChecklistModal
        open={!!checklistRow}
        row={checklistRow}
        onClose={() => !checklistBusy && setChecklistRow(null)}
        onSave={handleSaveChecklist}
        busy={checklistBusy}
      />
      <ImportExcelModal
        open={importOpen}
        projectId={projectId}
        onClose={() => setImportOpen(false)}
        onDone={() => fetchSheet(true)}
      />
      <SelectTemplateModal
        open={changeTplOpen}
        currentTemplate={data?.template}
        onClose={() => !changeTplBusy && setChangeTplOpen(false)}
        onConfirm={handleChangeTemplate}
        busy={changeTplBusy}
      />
      <AddPhaseModal
        open={addPhaseOpen}
        phases={snapshotPhases}
        onClose={() => !phaseBusy && setAddPhaseOpen(false)}
        onConfirm={handleAddPhase}
        busy={phaseBusy}
      />
      {/* ─── Scheduling engine modals ─── */}
      <SubtaskModal
        open={subtaskModal.open}
        mode={subtaskModal.mode}
        subtask={subtaskModal.subtask}
        parentTitle={subtaskModal.parent?.title}
        teamUserIds={teamUserIds}
        busy={subtaskBusy}
        onClose={() => !subtaskBusy && setSubtaskModal({ open: false, mode: 'create', parent: null, subtask: null })}
        onSubmit={handleSubmitSubtask}
      />
      <ShiftHistoryModal
        open={!!shiftHistoryRow}
        taskId={shiftHistoryRow?.taskId}
        taskTitle={shiftHistoryRow?.title}
        onClose={() => setShiftHistoryRow(null)}
      />
      <DependencyPicker
        open={!!dependencyRow}
        candidates={dependencyCandidates}
        value={dependencyRow?.dependsOn || []}
        busy={dependencyBusy}
        onClose={() => !dependencyBusy && setDependencyRow(null)}
        onSave={handleSaveDependency}
      />
      <DelayReasonModal
        open={!!pendingShift}
        mode="shiftConfirm"
        title={pendingShift?.row?.title}
        affectedCount={0}
        busy={shiftBusy}
        onClose={() => !shiftBusy && setPendingShift(null)}
        onConfirm={handleConfirmShift}
      />
      <RecalcScheduleModal
        open={recalcOpen}
        busy={recalcBusy}
        onClose={() => !recalcBusy && setRecalcOpen(false)}
        onConfirm={handleRecalc}
      />
      <PlannerSettingsModal
        open={settingsOpen}
        settings={data?.project?.settings}
        busy={settingsBusy}
        onClose={() => !settingsBusy && setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
      <PhaseBudgetModal
        open={!!phaseBudgetTarget}
        phase={phaseBudgetTarget}
        busy={phaseBudgetBusy}
        onClose={() => !phaseBudgetBusy && setPhaseBudgetTarget(null)}
        onSave={handleSavePhaseBudget}
      />
    </div>
  );
};

// Small confirm modal for the "Recalculate Schedule" toolbar action.
const RecalcScheduleModal = ({ open, busy, onClose, onConfirm }) => {
  if (!open) return null;
  return (
    <ModalShell
      title="Recalculate Schedule"
      subtitle="Re-derive planned dates from project start, durations and dependencies."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Recalculate
          </button>
        </>
      )}
    >
      <p className="text-xs text-[var(--text-secondary)]">
        Locked rows and completed/approved tasks are never moved. Dependent tasks are
        chained after their predecessors. This overwrites existing planned dates for
        unlocked tasks.
      </p>
    </ModalShell>
  );
};

// Scheduling settings — project-level auto-shift toggle + calendar mode.
const PlannerSettingsModal = ({ open, settings, busy, onClose, onSave }) => {
  const [autoShift, setAutoShift] = useState(false);
  const [calMode, setCalMode] = useState('calendar_days');
  useEffect(() => {
    if (open) {
      setAutoShift(!!settings?.autoShiftEnabled);
      setCalMode(settings?.calendarMode || 'calendar_days');
    }
  }, [open, settings]);
  if (!open) return null;
  return (
    <ModalShell
      title="Scheduling Settings"
      subtitle="Applies to this project only."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => onSave({ autoShiftEnabled: autoShift, calendarMode: calMode })} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Save
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoShift}
            onChange={(e) => setAutoShift(e.target.checked)}
            className="mt-0.5 accent-[var(--primary)]"
          />
          <span>
            <span className="text-sm font-bold text-[var(--text-primary)]">Enable nightly auto-shift</span>
            <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
              When on, overdue tasks that aren't locked/completed shift forward automatically each
              night (also requires the server-side <code>PMS_AUTO_SHIFT_ENABLED</code> flag). Off by default.
            </span>
          </span>
        </label>
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Calendar mode</label>
          <select
            value={calMode}
            onChange={(e) => setCalMode(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="calendar_days">Calendar days (weekends count)</option>
            <option value="working_days">Working days (skip Sat/Sun)</option>
          </select>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Controls how durations and shifts count days. Existing dates are not changed — use
            Recalculate to re-derive the schedule under the new mode.
          </p>
        </div>
      </div>
    </ModalShell>
  );
};

// Phase day budget — startDayOffset + dayBudget for a single phase.
const PhaseBudgetModal = ({ open, phase, busy, onClose, onSave }) => {
  const [startOffset, setStartOffset] = useState('');
  const [budget, setBudget] = useState('');
  useEffect(() => {
    if (open) {
      setStartOffset(phase?.startDayOffset != null ? String(phase.startDayOffset) : '');
      setBudget(phase?.dayBudget != null ? String(phase.dayBudget) : '');
    }
  }, [open, phase]);
  if (!open) return null;

  const save = () => {
    const payload = { name: phase.name };
    payload.startDayOffset = startOffset === '' ? 0 : Number(startOffset);
    payload.dayBudget = budget === '' ? null : Number(budget);
    onSave(payload);
  };

  return (
    <ModalShell
      title={`Phase Budget — ${phase?.name || ''}`}
      subtitle="Advisory only — does not move task dates. Use Recalculate to apply the offset."
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Save
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Start day offset</label>
          <input type="number" min="0" max="3650" value={startOffset} onChange={(e) => setStartOffset(e.target.value)}
            placeholder="Days from project start"
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]" />
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Tasks in this phase with no offset of their own start here (on Recalculate).</p>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Day budget</label>
          <input type="number" min="0" max="3650" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder="Nominal phase length (days) — leave blank for none"
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]" />
          <p className="text-[11px] text-[var(--text-muted)] mt-1">The phase header flags when the computed span exceeds this budget.</p>
        </div>
      </div>
    </ModalShell>
  );
};

export default ProjectPlannerTab;
