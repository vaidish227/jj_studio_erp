import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ClipboardList, ListChecks, CheckCircle2, AlertTriangle, Clock,
  Plus, RefreshCw, Search, Filter, Trash2, Loader2,
} from 'lucide-react';
import { pmsService } from '../../../../shared/services/pmsService';
import DatePicker from '../../../../shared/components/DatePicker/DatePicker';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
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

const PlannerHeader = ({ project, plan, counters, onRefresh, onAddRow, refreshing }) => (
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
      </div>
      <div className="flex items-center gap-2">
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
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] underline-offset-2 hover:underline"
      >
        {fmt(value)}
      </button>
    );
  }
  return (
    <DatePicker
      value={local}
      onChange={(iso) => {
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
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== (value || '')) onSave(local); }}
      className={`${width} px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] rounded text-[var(--text-primary)] focus:outline-none`}
    />
  );
};

const AddRowModal = ({ open, onClose, onCreate, designers, busy }) => {
  const [form, setForm] = useState({
    title: '', taskType: 'technical_drawing',
    zoneName: '', floor: '',
    assignedTo: '', plannedStartDate: '', plannedEndDate: '', plannedHours: 0,
  });
  if (!open) return null;
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onCreate({
      title:    form.title.trim(),
      taskType: form.taskType,
      assignedTo: form.assignedTo || undefined,
      planning: {
        floor:    form.floor,
        zoneName: form.zoneName,
        plannedStartDate: form.plannedStartDate || undefined,
        plannedEndDate:   form.plannedEndDate   || undefined,
        plannedHours:     Number(form.plannedHours) || 0,
      },
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-md"
      >
        <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-4">Add Drawing Row</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Drawing Name *</label>
            <input
              required autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
              placeholder="e.g. Master Bedroom — Ceiling Layout"
            />
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
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Designer</label>
              <select
                value={form.assignedTo}
                onChange={(e) => set('assignedTo', e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="">— Unassigned —</option>
                {designers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
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
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Start</label>
              <DatePicker value={form.plannedStartDate} onChange={(iso) => set('plannedStartDate', iso)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">End</label>
              <DatePicker value={form.plannedEndDate} onChange={(iso) => set('plannedEndDate', iso)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Hours</label>
              <input
                type="number" min="0"
                value={form.plannedHours}
                onChange={(e) => set('plannedHours', e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
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

const MasterSheetGrid = ({ rows, onPatch, onDelete }) => {
  if (!rows.length) {
    return (
      <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-12 text-center">
        <ClipboardList size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
        <p className="text-sm font-semibold text-[var(--text-secondary)]">No planner rows yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Click <span className="font-bold text-[var(--text-primary)]">+ Add Drawing Row</span> to start planning.</p>
      </div>
    );
  }
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[var(--bg)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <th className="px-3 py-2 sticky left-0 bg-[var(--bg)] z-10">#</th>
            <th className="px-3 py-2 sticky left-8 bg-[var(--bg)] z-10 min-w-[220px]">Drawing Name</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Zone</th>
            <th className="px-3 py-2">Floor</th>
            <th className="px-3 py-2">Designer</th>
            <th className="px-3 py-2">Planned Start</th>
            <th className="px-3 py-2">Planned End</th>
            <th className="px-3 py-2">Days</th>
            <th className="px-3 py-2">Planned Hrs</th>
            <th className="px-3 py-2">Actual Hrs</th>
            <th className="px-3 py-2">Progress</th>
            <th className="px-3 py-2">Delay</th>
            <th className="px-3 py-2">Drawing</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const rowTone =
              r.isDelayed ? 'border-l-4 border-l-[var(--error)]' :
              r.stage === 'Completed' ? 'border-l-4 border-l-[var(--success)]' :
              r.stage === 'On Hold' ? 'border-l-4 border-l-[var(--text-muted)]' :
              '';
            return (
              <tr key={r.taskId} className={`border-b border-[var(--border)] hover:bg-[var(--bg)]/60 ${rowTone}`}>
                <td className="px-3 py-2 text-[11px] font-mono text-[var(--text-muted)] sticky left-0 bg-[var(--surface)]">{idx + 1}</td>
                <td className="px-3 py-2 sticky left-8 bg-[var(--surface)]">
                  <EditableTextCell
                    value={r.title}
                    onSave={(v) => onPatch(r.taskId, { title: v })}
                    width="w-52"
                  />
                  {r.planning.drawingCode && (
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{r.planning.drawingCode}</p>
                  )}
                </td>
                <td className="px-3 py-2"><StageBadge stage={r.stage} /></td>
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
                <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                  {r.assignedTo?.name || <span className="text-[var(--text-muted)] italic">Unassigned</span>}
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
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)]"
                        style={{ width: `${r.planning.progressPercent || 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{r.planning.progressPercent || 0}%</span>
                  </div>
                </td>
                <td className="px-3 py-2"><DelayBadge days={r.delayDays} /></td>
                <td className="px-3 py-2 text-[10px]">
                  {r.drawing
                    ? <span className="font-mono text-[var(--text-secondary)]">v{r.drawing.version}</span>
                    : <span className="text-[var(--text-muted)] italic">—</span>}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onDelete(r.taskId, r.title)}
                    className="text-[var(--text-muted)] hover:text-[var(--error)] p-1 rounded hover:bg-[var(--error)]/10"
                    title="Delete row"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ProjectPlannerTab = ({ project }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({ search: '', zone: '', designer: '', delayedOnly: false });
  const [designers, setDesigners] = useState([]);

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
      // Re-fetch to get derived fields (delayDays, plannedDays, totals)
      fetchSheet(true);
    } catch (err) {
      alert(err?.message || 'Failed to save change');
      fetchSheet(true);
    }
  }, [fetchSheet]);

  const handleDelete = useCallback(async (taskId, title) => {
    if (!window.confirm(`Delete planner row "${title}"? Attached drawings will be detached but kept for audit.`)) return;
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
      setShowAdd(false);
      fetchSheet(true);
    } catch (err) {
      alert(err?.message || 'Failed to create row');
    } finally {
      setCreating(false);
    }
  }, [projectId, fetchSheet]);

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
        onAddRow={() => setShowAdd(true)}
        refreshing={refreshing}
      />
      <FilterBar filters={filters} setFilters={setFilters} zones={zones} designers={designers} />
      <MasterSheetGrid
        rows={data?.rows || []}
        onPatch={handlePatch}
        onDelete={handleDelete}
      />
      <AddRowModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={handleCreate}
        designers={designers}
        busy={creating}
      />
    </div>
  );
};

export default ProjectPlannerTab;
