import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ClipboardList, ListChecks, CheckCircle2, AlertTriangle, Clock,
  Plus, RefreshCw, Search, Filter, Trash2, Loader2,
  Eye, History as HistoryIcon, X, ExternalLink, FileText, RotateCcw,
  UserCog, CalendarRange, ArrowLeftRight, Zap, CheckSquare, Square,
  Upload, Replace, Calendar as CalendarIcon, UserPlus, MessageSquare,
  ChevronDown, ChevronRight, Rocket, Lock, Download, FileSpreadsheet,
} from 'lucide-react';
import { pmsService } from '../../../../shared/services/pmsService';
import DatePicker from '../../../../shared/components/DatePicker/DatePicker';
import EmployeePicker from '../EmployeePicker';
import PreviewDrawingModal from '../PreviewDrawingModal';
import { useToast } from '../../../../shared/notifications/ToastProvider';

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

const StatCard = ({ icon: Icon, label, value, tone = 'default' }) => {
  const colors = {
    default: 'text-[var(--text-primary)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    info:    'text-[var(--accent-blue)]',
    danger:  'text-[var(--error)]',
  };
  return (
    <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 min-w-[120px]">
      <Icon size={16} className={colors[tone]} />
      <div>
        <p className={`text-base font-bold leading-none ${colors[tone]}`}>{value}</p>
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  );
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

const PlannerHeader = ({ project, plan, counters, onRefresh, onAddRow, onAutoSchedule, onActivate, onExport, onImport, exporting, refreshing }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={18} className="text-[var(--warning)]" />
          <h2 className="text-base font-extrabold text-[var(--text-primary)]">Project Planner / Master Sheet</h2>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {project?.code ? `${project.code} · ` : ''}
          {project?.startDate ? fmt(project.startDate) : '—'} → {fmt(project?.estimatedCompletionDate)}
          {' · Phase: '}<span className="font-semibold text-[var(--text-secondary)]">{project?.phase || '—'}</span>
        </p>
        {plan?.effectiveAt && (
          <p className="text-[11px] text-[var(--success)] mt-1.5 inline-flex items-center gap-1">
            <Lock size={11} /> Plan is effective — designer changes here will auto-notify the new owner.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
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
        <button
          type="button"
          onClick={onAutoSchedule}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--primary)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 rounded-lg hover:bg-[var(--primary)]/15"
          title="Auto-fill Planned Start + Deadline for every task using the template's Day offsets"
        >
          <Zap size={13} /> Auto-Schedule
        </button>
        {plan?.effectiveAt ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--success)] border border-[var(--success)]/40 bg-[var(--success)]/10 rounded-lg"
            title={`Plan locked on ${fmtDateTime(plan.effectiveAt)}`}
          >
            <Lock size={13} /> Plan Effective · {fmt(plan.effectiveAt)}
          </span>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-[var(--success)] rounded-lg hover:opacity-90"
            title="Delegate every assigned task and lock the plan baseline"
          >
            <Rocket size={13} /> Make Plan Effective
          </button>
        )}
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90"
        >
          <Plus size={13} /> Add Drawing Row
        </button>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <StatCard icon={ListChecks}    label="Total"           value={counters?.total ?? 0} />
      <StatCard icon={CheckCircle2}  label="Completed"       value={counters?.completed ?? 0} tone="success" />
      <StatCard icon={Clock}         label="In Progress"     value={counters?.inProgress ?? 0} tone="info" />
      <StatCard icon={AlertTriangle} label="Delayed"         value={counters?.delayed ?? 0} tone="danger" />
      <StatCard icon={Clock}         label="Pending Review"  value={counters?.submitted ?? 0} tone="warning" />
      <StatCard icon={RotateCcw}     label="Revision"        value={counters?.revisionRequired ?? 0} tone="danger" />
      <StatCard icon={Clock}         label="Pending Client"  value={counters?.pendingClient ?? 0} tone="warning" />
      <div className="ml-auto flex items-center gap-3 text-[11px] text-[var(--text-muted)] px-2">
        <span>Planned Days: <strong className="text-[var(--text-primary)]">{plan?.totalPlannedDays ?? 0}</strong></span>
        <span>Planned Hrs: <strong className="text-[var(--text-primary)]">{plan?.totalPlannedHours ?? 0}</strong></span>
        <span>Actual Hrs: <strong className="text-[var(--text-primary)]">{plan?.totalActualHours ?? 0}</strong></span>
      </div>
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

const EditableNumberCell = ({ value, onSave, disabled, min = 0, max = 10000 }) => {
  const [local, setLocal] = useState(value ?? 0);
  useEffect(() => { setLocal(value ?? 0); }, [value]);
  if (disabled) return <span className="text-xs text-[var(--text-muted)]">{value ?? 0}</span>;
  return (
    <input
      type="number"
      min={min} max={max}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(local);
        if (!Number.isNaN(n) && n !== Number(value || 0)) onSave(n);
      }}
      className="w-16 px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] rounded text-[var(--text-primary)] focus:outline-none"
    />
  );
};

const EditableTextCell = ({ value, onSave, disabled, placeholder, width = 'w-32' }) => {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);
  if (disabled) return <span className="text-xs text-[var(--text-muted)]">{value || '—'}</span>;
  // Empty-state gets a dashed underline + dimmer placeholder so the user sees
  // it as a "fillable" cell rather than a label.
  const isEmpty = !local;
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== (value || '')) onSave(local); }}
      className={`${width} px-1.5 py-0.5 text-xs bg-transparent border border-transparent rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:bg-[var(--bg)]
        ${isEmpty ? 'border-b-[1.5px] border-dashed border-[var(--border)]/70 placeholder:text-[var(--text-muted)]/60' : 'hover:border-[var(--border)]'}`}
    />
  );
};

// Inline priority dropdown with colour badge. Always-visible (no edit mode flip).
const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
const PRIORITY_BADGE = {
  low:    'bg-[var(--text-muted)]/15 text-[var(--text-muted)] border-[var(--text-muted)]/30',
  medium: 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border-[var(--accent-blue)]/30',
  high:   'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30',
  urgent: 'bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/30',
};
const EditablePriorityCell = ({ value, onSave, disabled }) => {
  const cls = PRIORITY_BADGE[value || 'medium'] || PRIORITY_BADGE.medium;
  if (disabled) {
    return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>{value}</span>;
  }
  return (
    <select
      value={value || 'medium'}
      onChange={(e) => onSave(e.target.value)}
      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border focus:outline-none focus:ring-1 focus:ring-[var(--primary)] ${cls}`}
    >
      {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

// Click-to-edit progress bar (0–100). Bar visible by default; clicking flips
// to a tiny number input that submits on blur or Enter.
const EditableProgressCell = ({ value, onSave, disabled }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value ?? 0);
  useEffect(() => { setLocal(value ?? 0); }, [value]);

  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  if (disabled || !editing) {
    return (
      <button
        type="button"
        onClick={() => !disabled && setEditing(true)}
        className="flex items-center gap-1.5 w-full text-left group"
        title={disabled ? '' : 'Click to edit progress %'}
      >
        <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[10px] tabular-nums ${disabled ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--primary)]'}`}>{pct}%</span>
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const n = Math.max(0, Math.min(100, Math.round(Number(local) || 0)));
    if (n !== pct) onSave(n);
  };
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0} max={100}
        value={local}
        autoFocus
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-12 px-1.5 py-0.5 text-xs bg-[var(--bg)] border border-[var(--primary)] rounded text-[var(--text-primary)] focus:outline-none tabular-nums"
      />
      <span className="text-[10px] text-[var(--text-muted)]">%</span>
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
const DesignerCell = ({ value, onChange }) => {
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
        className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 text-left transition-colors
          ${isEmpty
            ? 'text-[var(--text-muted)] border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--bg)]'}`}
        title={isEmpty ? 'Click to assign a designer' : 'Click to change designer'}
      >
        {isEmpty
          ? <><UserPlus size={11} className="opacity-70" /> Assign…</>
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
  expanded, onToggleExpand, versionsState, onViewVersion,
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
  const versionCount  = versions.length || drawing.revisionsCount || drawing.version || 1;
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

      {/* Inline expanded version dropdown — newest first */}
      {expanded && (
        <div className="mt-1 border border-[var(--primary)]/30 bg-[var(--bg)] rounded-lg p-2 space-y-1.5 shadow-sm">
          {versionsState?.loading && (
            <div className="flex items-center justify-center py-3">
              <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
            </div>
          )}
          {versionsState?.error && (
            <p className="text-[10px] text-[var(--error)]">{versionsState.error}</p>
          )}
          {!versionsState?.loading && !versionsState?.error && versions.length > 0 && (
            <>
              {/* Stats banner — total revisions + total elapsed time */}
              <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] border-b border-[var(--border)] pb-1 mb-1">
                <span>{versionCount} version{versionCount !== 1 ? 's' : ''}</span>
                {totalSpan && <span>⏱ {totalSpan} total</span>}
              </div>
              {versions.map((v, idx) => {
                const isNewest = idx === 0;
                const next     = versions[idx + 1]; // the previous chronological version
                const delta    = next ? fmtElapsed(next.uploadedAt, v.uploadedAt) : null;
                const vSt      = DRAWING_STATUS_LABEL[v.status] || { label: 'Archived', cls: 'bg-[var(--border)] text-[var(--text-muted)]' };
                return (
                  <div
                    key={`${v.drawingId}-${v.version}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-[10px] cursor-pointer transition-colors
                      ${isNewest ? 'bg-[var(--primary)]/8 border border-[var(--primary)]/30' : 'hover:bg-[var(--surface)]'}`}
                    onClick={() => onViewVersion?.(v)}
                    title="Open this version in preview"
                  >
                    <span className="font-mono font-extrabold text-[var(--text-primary)] w-6">v{v.version}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${vSt.cls}`}>
                      {vSt.label}
                    </span>
                    {isNewest && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-[var(--primary)]">Latest</span>
                    )}
                    <span className="flex-1 text-[var(--text-muted)] truncate" title={v.fileName}>
                      {v.uploadedAt ? fmtDateTime(v.uploadedAt) : '—'}
                    </span>
                    {delta && (
                      <span className="text-[var(--text-muted)] font-semibold whitespace-nowrap" title="Time since previous version">
                        +{delta}
                      </span>
                    )}
                    <Eye size={11} className="text-[var(--primary)] shrink-0" />
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const AddRowModal = ({ open, onClose, onCreate, busy, defaultPhase }) => {
  const [form, setForm] = useState({
    title: '', taskType: 'technical_drawing', priority: 'medium',
    zoneName: '', floor: '',
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
              filterRoles={['designer', 'supervisor']}
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

// Group rows by phase preserving first-appearance order. Rows without a phase
// fall under a synthetic "Other" group so existing pre-phase projects still
// render cleanly under the new grouped layout.
const PHASE_OTHER_KEY = '__other__';

const groupRowsByPhase = (rows) => {
  const groups = new Map();
  for (const r of rows) {
    const key = r.phase ? r.phase : PHASE_OTHER_KEY;
    if (!groups.has(key)) {
      groups.set(key, { name: r.phase || 'Other', rows: [] });
    }
    groups.get(key).rows.push(r);
  }
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

const MasterSheetGrid = ({
  rows, onPatch, onDelete, onViewDrawing, onShowVersions, onUpload, onOpenNotes, onOpenChecklist,
  uploadingTaskId, selectedTaskIds, onToggleRow, onToggleAll, onAddToPhase,
  // Inline version-history dropdown
  expandedVersionsTaskId, versionsCache, onToggleVersionsExpand, onViewVersion,
}) => {
  if (!rows.length) {
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

  // Phase groups for grouped rendering. Order preserved from the row sort.
  const phaseGroups = groupRowsByPhase(rows);
  // Total columns including the sticky checkbox + # — used for phase-header colspan.
  const TOTAL_COLS = 17;

  // Per-phase collapse — Set of phase keys currently hidden. Phase headers act
  // as the accordion toggle; clicking the chevron (or the row outside the Add
  // button) hides/shows that phase's tasks.
  const [collapsedPhases, setCollapsedPhases] = useState(() => new Set());
  const togglePhase = (key) => setCollapsedPhases((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

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
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Zone</th>
            <th className="px-3 py-2">Floor</th>
            <th className="px-3 py-2 min-w-[180px]">Designer</th>
            <th className="px-3 py-2 min-w-[110px]">Checklist</th>
            <th className="px-3 py-2">Planned Start</th>
            <th className="px-3 py-2">Deadline</th>
            <th className="px-3 py-2" title="Auto-computed from Start &amp; Deadline">Days</th>
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
            return (
            <React.Fragment key={group.key}>
              {/* Phase header row — click anywhere outside the Add button to
                  collapse / expand this phase. */}
              <tr
                className="bg-[var(--primary)]/8 border-b border-[var(--border)] sticky-phase-header cursor-pointer hover:bg-[var(--primary)]/12"
                onClick={() => togglePhase(group.key)}
              >
                <td colSpan={TOTAL_COLS} className="px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); togglePhase(group.key); }}
                      className="text-[var(--text-secondary)] hover:text-[var(--primary)] -ml-1 p-0.5"
                      title={isCollapsed ? 'Expand phase' : 'Collapse phase'}
                      aria-label={isCollapsed ? 'Expand phase' : 'Collapse phase'}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                      {group.order}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)] capitalize">
                      {group.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-1">
                      {group.rows.length} task{group.rows.length !== 1 ? 's' : ''}
                    </span>
                    {onAddToPhase && group.key !== PHASE_OTHER_KEY && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAddToPhase(group.name); }}
                        className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest
                                   text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 transition-colors"
                        title={`Add a task under ${group.name}`}
                      >
                        <Plus size={11} /> Add task to {group.name}
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {!isCollapsed && group.rows.map((r, idx) => {
            const isSelected = selectedTaskIds.has(String(r.taskId));
            const rowTone =
              r.isDelayed ? 'border-l-4 border-l-[var(--error)]' :
              r.stage === 'Completed' ? 'border-l-4 border-l-[var(--success)]' :
              r.stage === 'On Hold' ? 'border-l-4 border-l-[var(--text-muted)]' :
              r.stage === 'Revision Required' ? 'border-l-4 border-l-[var(--error)]' :
              '';
            const rowBg = isSelected ? 'bg-[var(--primary)]/5' : '';
            return (
              <tr key={r.taskId} className={`border-b border-[var(--border)] hover:bg-[var(--bg)]/60 ${rowTone} ${rowBg}`}>
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
                <td className={`px-3 py-2 text-[11px] font-mono text-[var(--text-muted)] sticky left-8 ${isSelected ? 'bg-[var(--primary)]/5' : 'bg-[var(--surface)]'}`}>{idx + 1}</td>
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
                  <EditablePriorityCell
                    value={r.priority}
                    onSave={(p) => onPatch(r.taskId, { priority: p })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableTextCell
                    value={r.planning.zoneName}
                    placeholder="Zone"
                    onSave={(v) => onPatch(r.taskId, { planning: { zoneName: v } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableTextCell
                    value={r.planning.floor}
                    placeholder="Floor"
                    width="w-12"
                    onSave={(v) => onPatch(r.taskId, { planning: { floor: v } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <DesignerCell
                    value={r.assignedTo}
                    onChange={(userId) => onPatch(r.taskId, { assignedTo: userId || null })}
                  />
                </td>
                <td className="px-3 py-2">
                  <ChecklistCell row={r} onOpen={() => onOpenChecklist(r)} />
                </td>
                <td className="px-3 py-2">
                  <EditableDateCell
                    value={r.planning.plannedStartDate}
                    onSave={(iso) => onPatch(r.taskId, { planning: { plannedStartDate: iso } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableDateCell
                    value={r.planning.plannedEndDate}
                    onSave={(iso) => onPatch(r.taskId, { planning: { plannedEndDate: iso } })}
                  />
                </td>
                <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{r.plannedDays ?? '—'}</td>
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
                  <EditableProgressCell
                    value={r.planning.progressPercent}
                    onSave={(n) => onPatch(r.taskId, { planning: { progressPercent: n } })}
                  />
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
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenNotes(r)}
                      className={`p-1 rounded ${r.notes ? 'text-[var(--primary)] hover:bg-[var(--primary)]/10' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg)]'}`}
                      title={r.notes ? 'View / edit notes' : 'Add notes'}
                    >
                      <MessageSquare size={12} />
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
            );
          })}
            </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Bulk action modals ──────────────────────────────────────────────────────
// All four follow the same shell: centred card on a black backdrop with header,
// body, and Cancel + Confirm buttons. Each handles its own input state.

const ModalShell = ({ title, subtitle, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-md"
    >
      <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{title}</h3>
      {subtitle && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 mt-5">{footer}</div>}
    </div>
  </div>
);

const AssignDesignerModal = ({ open, count, onClose, onConfirm, busy }) => {
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
      <EmployeePicker value={user} onChange={setUser} placeholder="Pick designer…" />
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
const BulkToolbar = ({ selectedCount, onAssign, onSetDates, onShiftDates, onClear }) => (
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
    <div className="ml-auto">
      <button type="button" onClick={onClear}
        className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <X size={12} /> Clear
      </button>
    </div>
  </div>
);

const ProjectPlannerTab = ({ project }) => {
  const toast = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addPhase, setAddPhase] = useState('');
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({ search: '', zone: '', designer: '', delayedOnly: false });
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

  // Inline upload + notes
  const [uploadingTaskId, setUploadingTaskId] = useState(null);
  const [notesRow,        setNotesRow]        = useState(null);
  const [notesBusy,       setNotesBusy]       = useState(false);
  const [checklistRow,    setChecklistRow]    = useState(null);
  const [checklistBusy,   setChecklistBusy]   = useState(false);
  const [importOpen,      setImportOpen]      = useState(false);
  const [exporting,       setExporting]       = useState(false);

  const projectId = project?._id;

  const fetchSheet = useCallback(async (isRefresh = false) => {
    if (!projectId) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.zone)          params.zone = filters.zone;
      if (filters.designer)      params.designer = filters.designer;
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
        uploadedAt:   d.updatedAt || d.createdAt,
        uploadedBy:   d.uploadedBy,
        notes:        d.revisionNotes,
        rejectionReason: d.rejectionReason,
        approvalDate: d.approvalDate,
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

  // Map planner task type → Drawing.drawingType enum so the upload lands in the
  // right S3 folder + filter group.
  const drawingTypeFor = (taskType) => {
    switch (taskType) {
      case 'civil_drawing':           return 'civil';
      case 'technical_drawing':       return 'technical_detail';
      case 'ac_coordination':         return 'ac_coordination';
      case 'automation_coordination': return 'automation';
      case 'kitchen_drawing':         return 'kitchen';
      case 'bathroom_drawing':        return 'bathroom';
      case '3d_render':               return '3d_render';
      case 'concept_making':          return 'concept';
      case 'site_measurement':        return 'site_photo';
      case 'furniture_layout':        return 'plan';
      default:                        return 'plan';
    }
  };

  // Inline upload — uses existing multipart endpoint. On success, refresh.
  const handleInlineUpload = useCallback(async (row, file) => {
    if (!file || !projectId) return;
    setUploadingTaskId(String(row.taskId));
    try {
      const isRevision = !!row.drawing?._id;
      if (isRevision) {
        // /revise expects the existing fileUrl semantics. We use the multipart
        // upload endpoint with the SAME title + zone — backend bumps version
        // automatically because of the (projectId, zoneName, title) lookup.
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId',   projectId);
      fd.append('taskId',      row.taskId);
      fd.append('title',       row.title || file.name);
      fd.append('zoneName',    row.planning?.zoneName || '');
      fd.append('drawingType', drawingTypeFor(row.taskType));
      if (row.planning?.zoneName) {
        fd.append('description', `Auto-uploaded from master sheet · ${row.planning.zoneName}`);
      }
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

  return (
    <div className="space-y-3">
      <PlannerHeader
        project={data?.project}
        plan={data?.plan}
        counters={data?.counters}
        onRefresh={() => fetchSheet(true)}
        onAddRow={() => { setAddPhase(''); setShowAdd(true); }}
        onAutoSchedule={() => setAutoOpen(true)}
        onActivate={() => setActivateOpen(true)}
        onExport={handleExport}
        onImport={() => setImportOpen(true)}
        exporting={exporting}
        refreshing={refreshing}
      />
      <FilterBar filters={filters} setFilters={setFilters} zones={zones} designers={designers} />
      {selectedTaskIds.size > 0 && (
        <BulkToolbar
          selectedCount={selectedTaskIds.size}
          onAssign={() => setAssignOpen(true)}
          onSetDates={() => setSetDatesOpen(true)}
          onShiftDates={() => setShiftOpen(true)}
          onClear={clearSelection}
        />
      )}
      <MasterSheetGrid
        rows={data?.rows || []}
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
        expandedVersionsTaskId={expandedVersionsTaskId}
        versionsCache={versionsCache}
        onToggleVersionsExpand={toggleVersionsExpand}
        onViewVersion={handleViewVersion}
      />
      <AddRowModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={handleCreate}
        busy={creating}
        defaultPhase={addPhase}
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
    </div>
  );
};

export default ProjectPlannerTab;
