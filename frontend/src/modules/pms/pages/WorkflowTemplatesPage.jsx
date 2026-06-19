import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Workflow, AlertTriangle,
  Plus, Edit3, Copy, Trash2, Save, X, Star, Power, Eye, Lightbulb,
  ClipboardList, ListChecks, Clock, Layers,
} from 'lucide-react';
import { Loader, Button, Modal, FormField, ConfirmationModal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import { useAuth } from '../../../shared/context/AuthContext';
import { StatCard, PhaseHeaderRow, AddDashedRow, EditablePriorityCell, PRIORITY_BADGE } from '../components/planner/sheetCells';

// One-shot loader for backend-mapped dropdown options used by the editor.
const useTemplateOptions = (enabled) => {
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    pmsService.getWorkflowTemplateOptions()
      .then((res) => { if (!cancelled) setOptions(res); })
      .catch(() => { if (!cancelled) setOptions(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return { options, loading };
};

/**
 * WorkflowTemplatesPage — Phase 4: Clone & Edit editor.
 *
 * Modes:
 *   - list    list of all templates + create/duplicate/edit/delete/make-default
 *   - view    read-only inspection (phases, tasks, gates)
 *   - edit    in-place editor for safe fields (name, day offsets, priorities, gate labels)
 *
 * Snapshot semantics: edits NEVER affect projects that have already been
 * initiated. Only new project creations pick up changes.
 */

const PROJECT_TYPE_OPTIONS = [
  { value: 'Any',         label: 'Any' },
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial',  label: 'Commercial' },
];

// ─── List view: card with actions ────────────────────────────────────────────
const TemplateCard = ({ template, onView, onEdit, onDuplicate, onMakeDefault, onToggleActive, onDelete, busyId }) => {
  const isBusy = busyId === template._id;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5
                    hover:border-[var(--primary)]/40 transition-colors space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        <Workflow size={20} className="text-[var(--primary)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{template.name}</h3>
            {template.isDefault && (
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/12 px-1.5 py-0.5 rounded">
                DEFAULT
              </span>
            )}
            {!template.isActive && (
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                INACTIVE
              </span>
            )}
            <span className="text-[10px] text-[var(--text-muted)]">
              {template.projectType || 'Any'} · {template.phaseCount} phases · {template.taskCount} tasks
            </span>
          </div>
          {template.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1">{template.description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
        <Button size="sm" variant="ghost" onClick={() => onView(template)} disabled={isBusy}>
          <Eye size={13} /> View
        </Button>
        <Button size="sm" variant="primary" onClick={() => onEdit(template)} disabled={isBusy}>
          <Edit3 size={13} /> Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDuplicate(template)} disabled={isBusy}>
          <Copy size={13} /> Duplicate
        </Button>
        {!template.isDefault && (
          <Button size="sm" variant="outline" onClick={() => onMakeDefault(template)} disabled={isBusy}>
            <Star size={13} /> Make Default
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onToggleActive(template)} disabled={isBusy}>
          <Power size={13} /> {template.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        {!template.isDefault && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(template)} disabled={isBusy}
                  className="text-[var(--error)] hover:text-[var(--error)]">
            <Trash2 size={13} /> Delete
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Read-only viewer — mirrors the editor's tabular layout, no inputs. ──────
const TemplateDetail = ({ template, onBack, onEdit }) => {
  const { options } = useTemplateOptions(true);

  const taskByKey = useMemo(
    () => Object.fromEntries((template.tasks || []).map((t) => [t.key, t])),
    [template.tasks]
  );

  // Friendly labels — fall back to the raw slug when options haven't loaded yet.
  const taskTypeLabel = (slug) =>
    options?.taskTypes?.find((o) => o.value === slug)?.label || slug;
  const ownerLabel = (slug) =>
    options?.responsibilities?.find((r) => r.slug === slug)?.name || slug || '—';

  const linkedTasks = useMemo(() => {
    const linkedKeys = new Set((template.phases || []).flatMap((p) => p.taskKeys || []));
    return (template.tasks || []).filter((t) => linkedKeys.has(t.key));
  }, [template.phases, template.tasks]);

  const timelineSpan = linkedTasks.reduce(
    (max, t) => Math.max(max, (Number(t.dayOffsetFromProjectStart) || 0) + (Number(t.plannedDays) || 0)),
    0,
  );
  const totalHours = linkedTasks.reduce((s, t) => s + (Number(t.plannedHours) || 0), 0);
  const totalDays  = linkedTasks.reduce((s, t) => s + (Number(t.plannedDays)  || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
          <ArrowLeft size={12} /> Back to templates
        </button>
        <Button size="sm" onClick={() => onEdit(template)}>
          <Edit3 size={13} /> Edit Template
        </Button>
      </div>

      {/* Metadata card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Workflow size={18} className="text-[var(--primary)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">{template.name}</h2>
          {template.isDefault && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--success)] bg-[var(--success)]/12 px-1.5 py-0.5 rounded">DEFAULT</span>
          )}
          {!template.isActive && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] px-1.5 py-0.5 rounded">INACTIVE</span>
          )}
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
            {template.projectType || 'Any'} · {template.phases?.length} phases · {linkedTasks.length} tasks
          </span>
        </div>
        {template.description && <p className="text-sm text-[var(--text-secondary)]">{template.description}</p>}
      </div>

      {/* Summary strip — same shape as the editor's */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Total Timeline</p>
          <p className="text-lg font-extrabold text-[var(--text-primary)] tabular-nums">{timelineSpan} <span className="text-xs font-bold text-[var(--text-muted)]">days</span></p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Total Tasks</p>
          <p className="text-lg font-extrabold text-[var(--text-primary)] tabular-nums">{linkedTasks.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Planned Effort</p>
          <p className="text-lg font-extrabold text-[var(--text-primary)] tabular-nums">{totalHours} <span className="text-xs font-bold text-[var(--text-muted)]">hrs</span></p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sum of Task Days</p>
          <p className="text-lg font-extrabold text-[var(--text-primary)] tabular-nums">{totalDays} <span className="text-xs font-bold text-[var(--text-muted)]">days</span></p>
        </div>
      </div>

      {/* Tabular phases / tasks — read-only mirror of the editor */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-left border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '240px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr className="bg-[var(--bg)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-2 py-2.5 text-center">#</th>
                <th className="px-2 py-2.5">Drawing / Task Name</th>
                <th className="px-2 py-2.5">Category</th>
                <th className="px-2 py-2.5 text-center">Start Day</th>
                <th className="px-2 py-2.5 text-center">Days</th>
                <th className="px-2 py-2.5 text-center" title="Derived — Start Day + Days">Ends</th>
                <th className="px-2 py-2.5 text-center">Hours</th>
                <th className="px-2 py-2.5">Priority</th>
                <th className="px-2 py-2.5">Owner</th>
                <th className="px-2 py-2.5">Checklist</th>
                <th className="px-2 py-2.5 text-center">Waits</th>
              </tr>
            </thead>
            <tbody>
              {(template.phases || []).map((phase, phaseIdx) => {
                return (
                  <React.Fragment key={phaseIdx}>
                    <tr className="bg-[var(--primary)]/8 border-b border-[var(--border)]">
                      <td colSpan={11} className="px-3 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                            {phase.order}
                          </span>
                          <span className="text-sm font-bold text-[var(--text-primary)] capitalize">{phase.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                            {phase.taskKeys?.length || 0} task{phase.taskKeys?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {(phase.taskKeys || []).map((key, taskIdxInPhase) => {
                      const t = taskByKey[key];
                      if (!t) return null;
                      const dependsLabel = t.dependsOnKeys?.length > 0
                        ? `${t.dependsOnKeys.length} task${t.dependsOnKeys.length !== 1 ? 's' : ''}`
                        : '';
                      const dependsTitle = t.dependsOnKeys?.length > 0
                        ? `depends on: ${t.dependsOnKeys.join(', ')}`
                        : '';
                      const priorityCls = PRIORITY_BADGE[t.priority || 'medium'] || PRIORITY_BADGE.medium;
                      return (
                        <tr key={key} className="border-b border-[var(--border)]">
                          <td className="px-2 py-2 text-center text-[11px] font-mono text-[var(--text-muted)] tabular-nums">{taskIdxInPhase + 1}</td>
                          <td className="px-2 py-2 text-sm font-semibold text-[var(--text-primary)] truncate">{t.title}</td>
                          <td className="px-2 py-2 text-[11px] font-bold text-[var(--text-primary)]">{taskTypeLabel(t.taskType)}</td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums text-[var(--text-primary)]">{t.dayOffsetFromProjectStart || 0}</td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums text-[var(--text-primary)]">{t.plannedDays ?? 1}</td>
                          <td className="px-2 py-2 text-center text-xs tabular-nums text-[var(--text-muted)]" title="Derived — Start Day + Days">
                            D+{(Number(t.dayOffsetFromProjectStart) || 0) + (Number(t.plannedDays) || 0)}
                          </td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums text-[var(--text-primary)]">{t.plannedHours ?? 0}</td>
                          <td className="px-2 py-2">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${priorityCls}`}>
                              {t.priority || 'medium'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs text-[var(--text-primary)] truncate">{ownerLabel(t.responsibilitySlug)}</td>
                          <td className="px-2 py-2 text-xs text-[var(--text-muted)] truncate">{t.checklistTemplateName || '—'}</td>
                          <td className="px-2 py-2 text-center text-[10px] text-[var(--text-muted)]" title={dependsTitle || 'No dependencies'}>
                            {dependsLabel || '—'}
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
      </div>
    </div>
  );
};

// ─── Editor screen — the meat of the feature ─────────────────────────────────
const TemplateEditor = ({ template, onBack, onSaved }) => {
  const toast = useToast();
  const { options, loading: optsLoading } = useTemplateOptions(true);

  const [name,        setName]        = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [projectType, setProjectType] = useState(template.projectType || 'Any');
  const [isDefault,   setIsDefault]   = useState(!!template.isDefault);
  const [isActive,    setIsActive]    = useState(template.isActive !== false);

  // Phases held as a separate editable list — each carries its own taskKeys.
  const [phases, setPhases] = useState(
    (template.phases || []).map((p) => ({
      name: p.name,
      order: p.order,
      taskKeys: [...(p.taskKeys || [])],
      gateKeys: [...(p.gateKeys || [])],
      startDayOffset: Number(p.startDayOffset) || 0,
      dayBudget: p.dayBudget != null ? Number(p.dayBudget) : null,
    }))
  );
  const [tasks, setTasks] = useState((template.tasks || []).map((t) => ({ ...t })));
  // Gates are engine data — no longer surfaced in the editor UI (gate
  // enforcement is disabled), but kept in state so the save payload and
  // dirty-check stay intact.
  const [gates] = useState((template.gates || []).map((g) => ({ ...g })));

  const [saving, setSaving] = useState(false);
  const [confirmDefault, setConfirmDefault] = useState(false);

  // Per-phase collapse — mirrors the project master sheet accordion. Keyed by
  // phase index (names are editable mid-session, indexes are stable enough).
  const [collapsedPhases, setCollapsedPhases] = useState(() => new Set());
  const togglePhaseCollapse = (idx) => setCollapsedPhases((prev) => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  // Lookups
  const taskByKey = useMemo(() => Object.fromEntries(tasks.map((t) => [t.key, t])), [tasks]);

  // Per-taskType filtered checklist templates (so a Civil Drawing task only
  // sees civil_drawing checklists, etc.)
  const checklistsByType = useMemo(() => {
    if (!options?.checklistTemplates) return {};
    const map = {};
    for (const c of options.checklistTemplates) {
      if (!map[c.taskType]) map[c.taskType] = [];
      map[c.taskType].push(c);
    }
    return map;
  }, [options]);

  // ── Mutators ────────────────────────────────────────────────────────────
  const setTaskField = (key, field, value) => {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };
  const setPhaseName = (idx, newName) => {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, name: newName } : p)));
  };
  // Phase day budget (milestone) — startDayOffset / dayBudget.
  const setPhaseBudget = (idx, field, value) => {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  // Add a phase at the end. Always starts with a neutral placeholder name —
  // the user renames it. We deliberately do NOT auto-pick an engine-known slug
  // (kickoff/layout/design/...) because that surprises the user with a SYSTEM
  // badge they didn't ask for.
  const addPhase = () => {
    setPhases((prev) => {
      const usedLower = new Set(prev.map((p) => (p.name || '').toLowerCase().trim()));
      let n = prev.length + 1;
      while (usedLower.has(`new_phase_${n}`)) n += 1;
      return [
        ...prev,
        { name: `new_phase_${n}`, order: prev.length + 1, taskKeys: [], gateKeys: [] },
      ];
    });
  };

  const deletePhase = (idx) => {
    const phase = phases[idx];
    if (!phase) return;
    // Cascade: drop the phase's task drafts (existing tasks would also vanish —
    // confirm verbally with the user via toast since browser confirm is jarring
    // mid-edit).
    setTasks((prev) => prev.filter((t) => !phase.taskKeys.includes(t.key)));
    setPhases((prev) => prev
      .filter((_, i) => i !== idx)
      .map((p, i) => ({ ...p, order: i + 1 })));
  };

  // Add a new task to a given phase. Key starts empty — server assigns one
  // (we use a `__draftId` to keep React happy in the list).
  const addTaskToPhase = (phaseIdx) => {
    const draftId = `__draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const firstType = options?.taskTypes?.[0]?.value || 'concept_making';
    const newTask = {
      key: draftId,                                              // replaced by server on save
      __isDraft: true,
      taskType: firstType,
      title: 'New task',
      dayOffsetFromProjectStart: 0,
      plannedDays: 1,
      plannedHours: 0,
      priority: 'medium',
      responsibilitySlug: '',
      checklistTemplateName: '',
      notes: '',
      dependsOnKeys: [],
      requiresGateKeys: [],
    };
    setTasks((prev) => [...prev, newTask]);
    setPhases((prev) => prev.map((p, i) => (
      i === phaseIdx ? { ...p, taskKeys: [...p.taskKeys, draftId] } : p
    )));
  };

  // Add a SUBTASK under a parent task (same phase). Inherits the parent's
  // taskType/owner as sensible defaults; parentKey wires the nesting.
  const addSubtaskToParent = (phaseIdx, parentKey) => {
    const parent = tasks.find((t) => t.key === parentKey);
    const draftId = `__draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const siblingCount = tasks.filter((t) => t.parentKey === parentKey).length;
    const newTask = {
      key: draftId,
      __isDraft: true,
      taskType: parent?.taskType || options?.taskTypes?.[0]?.value || 'concept_making',
      title: 'New subtask',
      dayOffsetFromProjectStart: parent?.dayOffsetFromProjectStart || 0,
      plannedDays: 1,
      plannedHours: 0,
      priority: parent?.priority || 'medium',
      responsibilitySlug: parent?.responsibilitySlug || '',
      checklistTemplateName: '',
      notes: '',
      dependsOnKeys: [],
      requiresGateKeys: [],
      parentKey,
      subtaskOrder: siblingCount + 1,
    };
    setTasks((prev) => [...prev, newTask]);
    setPhases((prev) => prev.map((p, i) => (
      i === phaseIdx ? { ...p, taskKeys: [...p.taskKeys, draftId] } : p
    )));
  };

  const deleteTask = (key) => {
    // Drop the task, and un-nest any subtask that pointed at it (becomes top-level).
    setTasks((prev) => prev
      .filter((t) => t.key !== key)
      .map((t) => (t.parentKey === key ? { ...t, parentKey: null } : t)));
    setPhases((prev) => prev.map((p) => ({
      ...p,
      taskKeys: p.taskKeys.filter((k) => k !== key),
    })));
  };

  // One editable task row — reused for parent (isSub=false) and nested subtask
  // (isSub=true) rows so the cell markup stays in one place.
  const renderTaskRow = (t, { isSub, num, phaseIdx }) => {
    const availableChecklists = checklistsByType[t.taskType] || [];
    const dependsLabel = t.dependsOnKeys?.length > 0
      ? `${t.dependsOnKeys.length} task${t.dependsOnKeys.length !== 1 ? 's' : ''}` : '';
    const dependsTitle = t.dependsOnKeys?.length > 0 ? `depends on: ${t.dependsOnKeys.join(', ')}` : '';
    const inputCls = 'w-full px-1.5 py-1 text-sm text-center rounded-md border border-transparent bg-transparent text-[var(--text-primary)] tabular-nums hover:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]';
    return (
      <tr key={t.key} className={`border-b border-[var(--border)] hover:bg-[var(--bg)]/60 ${isSub ? 'bg-[var(--bg)]/40' : ''}`}>
        <td className="px-2 py-1.5 text-center text-[11px] font-mono text-[var(--text-muted)] tabular-nums">{isSub ? '↳' : num}</td>
        <td className="px-2 py-1.5">
          <div className={isSub ? 'pl-3 border-l-2 border-[var(--primary)]/30' : ''}>
            <input
              type="text"
              value={t.title}
              onChange={(e) => setTaskField(t.key, 'title', e.target.value)}
              placeholder={isSub ? 'Subtask name' : 'e.g. Master Bedroom — Ceiling Layout'}
              className="w-full px-2 py-1 text-sm font-semibold rounded-md border border-transparent bg-transparent text-[var(--text-primary)] truncate hover:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
            />
            {!isSub && (
              <button
                type="button"
                onClick={() => addSubtaskToParent(phaseIdx, t.key)}
                className="mt-0.5 ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] hover:underline"
              >
                <Plus size={10} /> Add subtask
              </button>
            )}
          </div>
        </td>
        <td className="px-2 py-1.5">
          <select
            value={t.taskType}
            onChange={(e) => {
              const newType = e.target.value;
              setTasks((prev) => prev.map((x) => (x.key === t.key ? { ...x, taskType: newType, checklistTemplateName: '' } : x)));
            }}
            className="w-full px-2 py-1 text-[11px] font-bold rounded-md border border-transparent bg-transparent hover:border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
          >
            {(options?.taskTypes || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="px-1 py-1.5 text-center">
          <input type="number" min="0" max="730" value={t.dayOffsetFromProjectStart || 0}
            onChange={(e) => setTaskField(t.key, 'dayOffsetFromProjectStart', Number(e.target.value))}
            className={inputCls} title="Day offset from project start (0 = day 1)" />
        </td>
        <td className="px-1 py-1.5 text-center">
          <input type="number" min="0" max="730" step="0.5" value={t.plannedDays ?? 1}
            onChange={(e) => setTaskField(t.key, 'plannedDays', Number(e.target.value))}
            className={inputCls} title="Estimated duration in days" />
        </td>
        <td className="px-1 py-1.5 text-center text-xs text-[var(--text-muted)] tabular-nums" title="Derived deadline — Start Day + Days">
          D+{(Number(t.dayOffsetFromProjectStart) || 0) + (Number(t.plannedDays) || 0)}
        </td>
        <td className="px-1 py-1.5 text-center">
          <input type="number" min="0" max="10000" step="0.5" value={t.plannedHours ?? 0}
            onChange={(e) => setTaskField(t.key, 'plannedHours', Number(e.target.value))}
            className={inputCls} title="Estimated effort in hours" />
        </td>
        <td className="px-2 py-1.5">
          <EditablePriorityCell value={t.priority || 'medium'} onSave={(v) => setTaskField(t.key, 'priority', v)} />
        </td>
        <td className="px-2 py-1.5">
          <select value={t.responsibilitySlug || ''} onChange={(e) => setTaskField(t.key, 'responsibilitySlug', e.target.value)}
            className="w-full px-2 py-1 text-xs rounded-md border border-transparent bg-transparent text-[var(--text-primary)] hover:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]">
            <option value="">— Any —</option>
            {(options?.responsibilities || []).map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </td>
        <td className="px-2 py-1.5">
          <select value={t.checklistTemplateName || ''} onChange={(e) => setTaskField(t.key, 'checklistTemplateName', e.target.value)}
            disabled={availableChecklists.length === 0}
            className="w-full px-2 py-1 text-xs rounded-md border border-transparent bg-transparent text-[var(--text-primary)] hover:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)] disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="">{availableChecklists.length === 0 ? 'No checklists' : '— Default —'}</option>
            {availableChecklists.map((c) => <option key={c.name} value={c.name}>{c.name}{c.isDefault ? ' (default)' : ''}</option>)}
          </select>
        </td>
        <td className="px-2 py-1.5 text-center text-[10px] text-[var(--text-muted)]" title={dependsTitle || 'No dependencies'}>
          {dependsLabel || '—'}
        </td>
        <td className="px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-0.5">
            {isSub && (
              <button type="button" onClick={() => setTaskField(t.key, 'parentKey', null)} title="Make top-level (un-nest)"
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 text-[12px] leading-none">↥</button>
            )}
            <button type="button" onClick={() => deleteTask(t.key)} title="Delete task"
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Only tasks linked to a phase show up in the table — so stats should
  // mirror that. Orphan tasks (in `tasks` but not in any phase.taskKeys) are
  // legacy bug debris and get dropped on save.
  const linkedTasks = useMemo(() => {
    const linkedKeys = new Set(phases.flatMap((p) => p.taskKeys || []));
    return tasks.filter((t) => linkedKeys.has(t.key));
  }, [tasks, phases]);

  // Timeline span — furthest task end (day offset + planned duration)
  const timelineSpan = useMemo(
    () => linkedTasks.reduce((max, t) => Math.max(
      max,
      (Number(t.dayOffsetFromProjectStart) || 0) + (Number(t.plannedDays) || 0),
    ), 0),
    [linkedTasks]
  );
  // Aggregate planning estimates surfaced in the summary strip.
  const totals = useMemo(() => linkedTasks.reduce(
    (acc, t) => ({
      hours: acc.hours + (Number(t.plannedHours) || 0),
      days:  acc.days  + (Number(t.plannedDays)  || 0),
    }),
    { hours: 0, days: 0 }
  ), [linkedTasks]);

  const dirty =
    name !== template.name ||
    description !== (template.description || '') ||
    projectType !== (template.projectType || 'Any') ||
    isDefault !== !!template.isDefault ||
    isActive !== (template.isActive !== false) ||
    JSON.stringify(phases) !== JSON.stringify((template.phases || []).map((p) => ({
      name: p.name, order: p.order, taskKeys: p.taskKeys || [], gateKeys: p.gateKeys || [],
    }))) ||
    JSON.stringify(tasks) !== JSON.stringify(template.tasks || []) ||
    JSON.stringify(gates) !== JSON.stringify(template.gates || []);

  const doSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    // Phase name validation
    const phaseNames = new Set();
    for (const p of phases) {
      const trimmed = (p.name || '').trim();
      if (!trimmed) { toast.error('Phase name cannot be empty'); return; }
      const lower = trimmed.toLowerCase();
      if (phaseNames.has(lower)) { toast.error(`Duplicate phase name "${trimmed}"`); return; }
      phaseNames.add(lower);
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        projectType,
        isDefault,
        isActive,
        phases: phases.map((p) => ({
          name: p.name.trim(),
          order: p.order,
          taskKeys: p.taskKeys,
          gateKeys: p.gateKeys,
          startDayOffset: Number(p.startDayOffset) || 0,
          dayBudget: p.dayBudget != null && p.dayBudget !== '' ? Number(p.dayBudget) : null,
        })),
        // Only ship phase-linked tasks. Orphans (legacy bug debris) get
        // garbage-collected on save so they stop polluting the totals.
        tasks: linkedTasks.map((t) => ({
          // Send the draft key too — the server uses it to map newly-added
          // tasks back to their phase.taskKeys entries (and then mints a stable
          // server-side key for storage).
          key: t.key,
          taskType: t.taskType,
          title: t.title,
          dayOffsetFromProjectStart: Number(t.dayOffsetFromProjectStart) || 0,
          plannedDays:  Math.max(0, Number(t.plannedDays  ?? 1)),
          plannedHours: Math.max(0, Number(t.plannedHours ?? 0)),
          priority: t.priority || 'medium',
          responsibilitySlug: t.responsibilitySlug || '',
          checklistTemplateName: t.checklistTemplateName || '',
          notes: t.notes || '',
          parentKey: t.parentKey || null,
          subtaskOrder: Number(t.subtaskOrder) || 0,
        })),
        gates: gates.map((g) => ({ key: g.key, label: g.label })),
      };
      const res = await pmsService.updateWorkflowTemplate(template._id, payload);
      toast.success('Template saved');
      onSaved?.(res.template);
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
      setConfirmDefault(false);
    }
  };

  const handleSave = () => {
    if (isDefault && !template.isDefault) {
      setConfirmDefault(true);
      return;
    }
    doSave();
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Top bar */}
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
        <ArrowLeft size={12} /> Back to templates
      </button>

      {/* Header action bar — mirrors the project master sheet's PlannerHeader */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={18} className="text-[var(--warning)]" />
              <h2 className="text-base font-extrabold text-[var(--text-primary)]">Master Template Editor</h2>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-secondary)]">{name || template.name}</span>
              {' · '}{projectType}
              {' · edits apply to '}<span className="font-semibold text-[var(--text-secondary)]">new projects only</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
              <X size={13} /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={saving} disabled={!dirty}>
              <Save size={13} /> Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Metadata card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Template Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </FormField>
          <FormField label="Project Type">
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {PROJECT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </FormField>

        <div className="flex items-center gap-6 flex-wrap pt-2 border-t border-[var(--border)]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            <span className="text-xs font-semibold text-[var(--text-primary)]">Set as default for {projectType} projects</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-[var(--primary)]"
            />
            <span className="text-xs font-semibold text-[var(--text-primary)]">Active (available for new projects)</span>
          </label>
        </div>
      </div>

      {/* Summary chips — same StatCard strip the project master sheet uses */}
      <div>
        <div className="flex flex-wrap gap-2">
          <StatCard icon={ListChecks} label="Total Tasks"    value={linkedTasks.length} />
          <StatCard icon={Clock}      label="Timeline"       value={`${timelineSpan}d`} tone="info" />
          <StatCard icon={Clock}      label="Planned Effort" value={`${totals.hours}h`} />
          <StatCard icon={Clock}      label="Task Days"      value={`${totals.days}d`} />
          <StatCard icon={Layers}     label="Phases"         value={phases.length} />
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-right">Last task fires on day {timelineSpan}</p>
      </div>

      {/* Suggestion banner — quick guidance for the MD before they start editing */}
      <div className="bg-[var(--primary)]/8 border border-[var(--primary)]/30 rounded-2xl p-4 flex items-start gap-3">
        <Lightbulb size={18} className="text-[var(--primary)] shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-1">
          <p className="font-bold text-[var(--text-primary)]">Master sheet template — how to plan</p>
          <ul className="list-disc list-inside space-y-0.5 marker:text-[var(--primary)]">
            <li>Each row below = one drawing / task that auto-appears in every new project's master sheet.</li>
            <li><span className="font-semibold">Start Day</span> is the offset from project start (D+0 = "Day 1 of project", D+6 = sixth working day).</li>
            <li><span className="font-semibold">Days</span> is the planned duration — drives the project master sheet's planned end date.</li>
            <li><span className="font-semibold">Hours</span> pre-fills the task's planned effort so total project hours roll up on day 1.</li>
            <li><span className="font-semibold">Owner</span> picks the responsibility — the assigned designer is auto-resolved from the project team when the task fires.</li>
            <li><span className="font-semibold">Priority</span> drives sort order in My Tasks and dashboard urgency badges.</li>
            <li>Edits affect <span className="font-semibold">new projects only</span> — projects already running are untouched (snapshot).</li>
          </ul>
        </div>
      </div>

      {/* Phases — master-sheet style table grouped by phase */}
      {optsLoading && (
        <div className="text-xs text-[var(--text-muted)] text-center py-2">Loading dropdown options…</div>
      )}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '40px' }} />        {/* # */}
              <col style={{ width: '240px' }} />        {/* Title */}
              <col style={{ width: '160px' }} />        {/* Category */}
              <col style={{ width: '78px' }} />         {/* Start Day */}
              <col style={{ width: '78px' }} />         {/* Days */}
              <col style={{ width: '70px' }} />         {/* Ends (derived) */}
              <col style={{ width: '78px' }} />         {/* Hours */}
              <col style={{ width: '110px' }} />        {/* Priority */}
              <col style={{ width: '170px' }} />        {/* Owner */}
              <col style={{ width: '180px' }} />        {/* Checklist */}
              <col style={{ width: '90px' }} />         {/* Waits For */}
              <col style={{ width: '40px' }} />         {/* Actions */}
            </colgroup>
            <thead>
              <tr className="bg-[var(--bg)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-2 py-2.5 text-center">#</th>
                <th className="px-2 py-2.5">Drawing / Task Name</th>
                <th className="px-2 py-2.5">Category</th>
                <th className="px-2 py-2.5 text-center" title="Day offset from project start (0 = day 1)">Start Day</th>
                <th className="px-2 py-2.5 text-center" title="Estimated duration in days — drives planned end date on the project master sheet">Days</th>
                <th className="px-2 py-2.5 text-center" title="Derived — Start Day + Days">Ends</th>
                <th className="px-2 py-2.5 text-center" title="Estimated effort in hours — pre-fills task.planning.plannedHours on every new project">Hours</th>
                <th className="px-2 py-2.5">Priority</th>
                <th className="px-2 py-2.5" title="Responsibility / team role that owns this task">Owner</th>
                <th className="px-2 py-2.5" title="Checklist template snapshotted onto the task on creation">Checklist</th>
                <th className="px-2 py-2.5 text-center" title="Dependencies (read-only — set when the template was cloned)">Waits</th>
                <th className="px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {phases.map((phase, phaseIdx) => {
                const isCollapsed = collapsedPhases.has(phaseIdx);
                return (
                  <React.Fragment key={phaseIdx}>
                    {/* Phase header row — shared accordion header from the master sheet */}
                    <PhaseHeaderRow
                      colSpan={12}
                      order={phase.order}
                      collapsed={isCollapsed}
                      onToggle={() => togglePhaseCollapse(phaseIdx)}
                      nameSlot={(
                        <input
                          type="text"
                          value={phase.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setPhaseName(phaseIdx, e.target.value)}
                          className="px-2 py-1 text-sm font-bold rounded-md border border-transparent bg-transparent
                                     text-[var(--text-primary)] capitalize hover:border-[var(--border)]
                                     focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--bg)]
                                     min-w-[140px]"
                          placeholder="Phase name"
                        />
                      )}
                      metaSlot={(
                        <span className="ml-1 inline-flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {phase.taskKeys.length} task{phase.taskKeys.length !== 1 ? 's' : ''}
                          </span>
                          {/* Phase day budget (milestone) — seeds into projects */}
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]" title="Day this phase begins (offset from project start)">
                            Start day
                            <input
                              type="number" min="0" max="3650"
                              value={phase.startDayOffset ?? 0}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setPhaseBudget(phaseIdx, 'startDayOffset', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-12 px-1 py-0.5 text-[11px] text-center rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            />
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]" title="Nominal phase length in days (milestone budget). Blank = none.">
                            Budget
                            <input
                              type="number" min="0" max="3650"
                              value={phase.dayBudget ?? ''}
                              placeholder="—"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setPhaseBudget(phaseIdx, 'dayBudget', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-12 px-1 py-0.5 text-[11px] text-center rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            />
                            <span className="text-[var(--text-muted)]">d</span>
                          </span>
                        </span>
                      )}
                      actionsSlot={(
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deletePhase(phaseIdx); }}
                          disabled={phases.length <= 1}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10
                                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={phases.length <= 1 ? 'A template must have at least one phase' : 'Delete this phase (and its draft tasks)'}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    />

                    {/* Task rows for this phase */}
                    {!isCollapsed && (() => {
                      const phaseTasks = phase.taskKeys.map((k) => taskByKey[k]).filter(Boolean);
                      const topLevelKeys = new Set(phaseTasks.filter((x) => !x.parentKey).map((x) => x.key));
                      const childrenOf = (pk) => phaseTasks
                        .filter((x) => x.parentKey === pk)
                        .sort((a, b) => (a.subtaskOrder || 0) - (b.subtaskOrder || 0));
                      const out = [];
                      let num = 0;
                      for (const t of phaseTasks) {
                        // A task whose parent lives in this phase is rendered nested
                        // under that parent below — skip it at the top level.
                        if (t.parentKey && topLevelKeys.has(t.parentKey)) continue;
                        num += 1;
                        out.push(renderTaskRow(t, { isSub: false, num, phaseIdx }));
                        for (const c of childrenOf(t.key)) out.push(renderTaskRow(c, { isSub: true, phaseIdx }));
                      }
                      return out;
                    })()}

                    {/* "Add task" row — gold dashed affordance shared with the master sheet */}
                    {!isCollapsed && (
                      <AddDashedRow
                        colSpan={12}
                        label={`Add task to ${phase.name || 'phase'}`}
                        onClick={() => addTaskToPhase(phaseIdx)}
                        disabled={!options?.taskTypes?.length}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* "Add phase" footer row */}
              <AddDashedRow colSpan={12} label="Add Phase" onClick={addPhase} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky save bar (mobile + tablet) */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3
                        flex items-center justify-between gap-3 shadow-lg z-20 lg:left-64">
          <span className="text-xs font-semibold text-[var(--warning)]">Unsaved changes</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={saving}>
              <Save size={13} /> Save
            </Button>
          </div>
        </div>
      )}

      {/* Confirm default promotion */}
      <ConfirmationModal
        isOpen={confirmDefault}
        onClose={() => setConfirmDefault(false)}
        onConfirm={doSave}
        title="Set as default template?"
        message={`"${name}" will become the default workflow for ${projectType} projects. Any existing default for this type will be demoted. Projects already in flight are NOT affected.`}
        confirmLabel="Set as Default"
        variant="warning"
        isLoading={saving}
      />
    </div>
  );
};

// ─── Create new template modal (blank or duplicate) ──────────────────────────
const CreateTemplateModal = ({ isOpen, onClose, onCreated, defaultSource }) => {
  const toast = useToast();
  const [mode, setMode]               = useState('duplicate');
  const [sourceId, setSourceId]       = useState(defaultSource?._id || '');
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState(defaultSource?.projectType || 'Any');
  const [sources, setSources]         = useState([]);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    pmsService.listWorkflowTemplates()
      .then((res) => setSources(res.templates || []))
      .catch(() => setSources([]));
    setName('');
    setDescription('');
    setSourceId(defaultSource?._id || '');
    setProjectType(defaultSource?.projectType || 'Any');
    setMode(defaultSource ? 'duplicate' : 'blank');
  }, [isOpen, defaultSource]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (mode === 'duplicate' && !sourceId) {
      toast.error('Pick a template to duplicate');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        projectType,
      };
      if (mode === 'duplicate') payload.sourceId = sourceId;
      const res = await pmsService.createWorkflowTemplate(payload);
      toast.success('Template created');
      onCreated?.(res.template);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Workflow Template" className="max-w-lg">
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('duplicate')}
            className={`p-3 rounded-xl border text-left transition-all
              ${mode === 'duplicate'
                ? 'border-[var(--primary)] bg-[var(--primary)]/8'
                : 'border-[var(--border)] hover:border-[var(--primary)]/40'}`}
          >
            <Copy size={16} className="text-[var(--primary)] mb-1" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Duplicate</p>
            <p className="text-[10px] text-[var(--text-muted)]">Copy an existing template (recommended)</p>
          </button>
          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`p-3 rounded-xl border text-left transition-all
              ${mode === 'blank'
                ? 'border-[var(--primary)] bg-[var(--primary)]/8'
                : 'border-[var(--border)] hover:border-[var(--primary)]/40'}`}
          >
            <Plus size={16} className="text-[var(--primary)] mb-1" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Blank</p>
            <p className="text-[10px] text-[var(--text-muted)]">Start with an empty Kickoff phase</p>
          </button>
        </div>

        {mode === 'duplicate' && (
          <FormField label="Copy from" required>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">Choose a template…</option>
              {sources.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.projectType || 'Any'} · {s.taskCount} tasks)
                </option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label="New name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Villa Premium"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </FormField>

        <FormField label="Project Type">
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            {PROJECT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FormField>

        <FormField label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional — short description of when to use this template"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </FormField>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving}>
            <Plus size={13} /> Create Template
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────
const WorkflowTemplatesPage = () => {
  const { hasPermission } = useAuth();
  const toast = useToast();

  const canManage = hasPermission('settings.workflows.manage');

  const [templates, setTemplates]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [mode, setMode]             = useState('list');           // 'list' | 'view' | 'edit'
  const [active, setActive]         = useState(null);              // full template doc when in view/edit
  const [busyId, setBusyId]         = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSrc, setCreateSrc]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await pmsService.listWorkflowTemplates();
      setTemplates(res.templates || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    reload();
  }, [canManage]);

  const openView = async (t) => {
    try {
      const full = await pmsService.getWorkflowTemplate(t._id);
      setActive(full.template);
      setMode('view');
    } catch (err) { toast.error(err?.message || 'Failed'); }
  };

  const openEdit = async (t) => {
    try {
      const full = t.tasks ? { template: t } : await pmsService.getWorkflowTemplate(t._id);
      setActive(full.template);
      setMode('edit');
    } catch (err) { toast.error(err?.message || 'Failed'); }
  };

  const onDuplicate = (t) => {
    setCreateSrc(t);
    setCreateOpen(true);
  };

  const onMakeDefault = async (t) => {
    setBusyId(t._id);
    try {
      await pmsService.updateWorkflowTemplate(t._id, { isDefault: true });
      toast.success(`"${t.name}" is now the default`);
      await reload();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally { setBusyId(null); }
  };

  const onToggleActive = async (t) => {
    setBusyId(t._id);
    try {
      await pmsService.updateWorkflowTemplate(t._id, { isActive: !t.isActive });
      toast.success(`"${t.name}" ${t.isActive ? 'deactivated' : 'activated'}`);
      await reload();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally { setBusyId(null); }
  };

  const onDelete = (t) => setDeleteTarget(t);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget._id);
    try {
      await pmsService.deleteWorkflowTemplate(deleteTarget._id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      toast.error(err?.message || 'Delete failed');
    } finally { setBusyId(null); }
  };

  // ─ Permission gate
  if (!canManage) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-[var(--warning)]" />
        <p className="text-sm text-[var(--text-muted)]">
          You need the <code>settings.workflows.manage</code> permission to access this page.
        </p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader /></div>;

  // ─ Edit mode — full width so the master-sheet table breathes
  if (mode === 'edit' && active) {
    return (
      <div className="p-4 lg:p-6">
        <TemplateEditor
          template={active}
          onBack={() => { setMode('list'); setActive(null); reload(); }}
          onSaved={() => { setMode('list'); setActive(null); reload(); }}
        />
      </div>
    );
  }

  // ─ View mode — full width, matches the editor's canvas
  if (mode === 'view' && active) {
    return (
      <div className="p-4 lg:p-6">
        <TemplateDetail
          template={active}
          onBack={() => { setMode('list'); setActive(null); }}
          onEdit={(t) => openEdit(t)}
        />
      </div>
    );
  }

  // ─ List mode
  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)]">Master Templates</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Templates control which drawings, timelines, and sign-offs auto-fill the master sheet when a new project starts.
            <span className="block text-xs text-[var(--text-muted)] mt-1">
              Edits apply only to <strong>new</strong> projects — existing projects keep their original master sheet.
            </span>
          </p>
        </div>
        <Button onClick={() => { setCreateSrc(null); setCreateOpen(true); }}>
          <Plus size={14} /> New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)] mb-3">No workflow templates yet.</p>
          <Button onClick={() => { setCreateSrc(null); setCreateOpen(true); }}>
            <Plus size={14} /> Create First Template
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard
              key={t._id}
              template={t}
              busyId={busyId}
              onView={openView}
              onEdit={openEdit}
              onDuplicate={onDuplicate}
              onMakeDefault={onMakeDefault}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <CreateTemplateModal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setCreateSrc(null); }}
        onCreated={async (t) => { await reload(); openEdit(t); }}
        defaultSource={createSrc}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleteTarget?.name}"?`}
        message="The template will be removed. Projects already initiated with this template will continue to work — their tasks and sign-offs are not affected."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};

export default WorkflowTemplatesPage;
