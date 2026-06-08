import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight, ArrowLeft, Lock, Workflow, AlertTriangle,
  Plus, Edit3, Copy, Trash2, Save, X, Star, Power, Eye, Lightbulb,
} from 'lucide-react';
import { Loader, Button, Modal, FormField, ConfirmationModal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import { useAuth } from '../../../shared/context/AuthContext';

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

const APPROVER_BADGE_CLS = {
  client:                'bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]',
  manager:               'bg-[var(--text-muted)]/12 text-[var(--text-muted)]',
  principal_designer:    'bg-[var(--primary)]/12 text-[var(--primary)]',
  principal_and_client:  'bg-[var(--warning)]/12 text-[var(--warning)]',
};

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PROJECT_TYPE_OPTIONS = [
  { value: 'Any',         label: 'Any' },
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial',  label: 'Commercial' },
];

const PRIORITY_BADGE_CLS = {
  low:    'bg-[var(--text-muted)]/12 text-[var(--text-muted)]',
  medium: 'bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]',
  high:   'bg-[var(--warning)]/12 text-[var(--warning)]',
  urgent: 'bg-[var(--error)]/12 text-[var(--error)]',
};

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
              {template.projectType || 'Any'} · {template.phaseCount} phases · {template.taskCount} tasks · {template.gateCount} gates
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
  const gateByKey = useMemo(
    () => Object.fromEntries((template.gates || []).map((g) => [g.key, g])),
    [template.gates]
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
            {template.projectType || 'Any'} · {template.phases?.length} phases · {linkedTasks.length} tasks · {template.gates?.length} gates
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
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '40px' }} />
              <col />
              <col style={{ width: '170px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr className="bg-[var(--bg)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-2 py-2.5 text-center">#</th>
                <th className="px-2 py-2.5">Drawing / Task Name</th>
                <th className="px-2 py-2.5">Category</th>
                <th className="px-2 py-2.5 text-center">Start Day</th>
                <th className="px-2 py-2.5 text-center">Days</th>
                <th className="px-2 py-2.5 text-center">Hours</th>
                <th className="px-2 py-2.5">Priority</th>
                <th className="px-2 py-2.5">Owner</th>
                <th className="px-2 py-2.5">Checklist</th>
                <th className="px-2 py-2.5 text-center">Waits</th>
              </tr>
            </thead>
            <tbody>
              {(template.phases || []).map((phase, phaseIdx) => {
                const phaseGates = (phase.gateKeys || []).map((k) => gateByKey[k]).filter(Boolean);
                return (
                  <React.Fragment key={phaseIdx}>
                    <tr className="bg-[var(--primary)]/8 border-b border-[var(--border)]">
                      <td colSpan={10} className="px-3 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                            {phase.order}
                          </span>
                          <span className="text-sm font-bold text-[var(--text-primary)] capitalize">{phase.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                            {phase.taskKeys?.length || 0} task{phase.taskKeys?.length !== 1 ? 's' : ''} · {phase.gateKeys?.length || 0} sign-off{phase.gateKeys?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {(phase.taskKeys || []).map((key, taskIdxInPhase) => {
                      const t = taskByKey[key];
                      if (!t) return null;
                      const dependsLabel =
                        (t.dependsOnKeys?.length > 0 ? `${t.dependsOnKeys.length} task${t.dependsOnKeys.length !== 1 ? 's' : ''}` : '') +
                        (t.dependsOnKeys?.length > 0 && t.requiresGateKeys?.length > 0 ? ' · ' : '') +
                        (t.requiresGateKeys?.length > 0 ? `${t.requiresGateKeys.length} gate${t.requiresGateKeys.length !== 1 ? 's' : ''}` : '');
                      const dependsTitle = [
                        t.dependsOnKeys?.length > 0 && `depends on: ${t.dependsOnKeys.join(', ')}`,
                        t.requiresGateKeys?.length > 0 && `waits for: ${t.requiresGateKeys.join(', ')}`,
                      ].filter(Boolean).join('  |  ');
                      const priorityCls = PRIORITY_BADGE_CLS[t.priority || 'medium'];
                      return (
                        <tr key={key} className="border-b border-[var(--border)]">
                          <td className="px-2 py-2 text-center text-[11px] font-mono text-[var(--text-muted)] tabular-nums">{taskIdxInPhase + 1}</td>
                          <td className="px-2 py-2 text-sm font-semibold text-[var(--text-primary)] truncate">{t.title}</td>
                          <td className="px-2 py-2 text-[11px] font-bold text-[var(--text-primary)]">{taskTypeLabel(t.taskType)}</td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums text-[var(--text-primary)]">{t.dayOffsetFromProjectStart || 0}</td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums text-[var(--text-primary)]">{t.plannedDays ?? 1}</td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums text-[var(--text-primary)]">{t.plannedHours ?? 0}</td>
                          <td className="px-2 py-2">
                            <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded capitalize ${priorityCls}`}>
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

                    {phaseGates.length > 0 && (
                      <tr className="bg-[var(--warning)]/5 border-b border-[var(--border)]">
                        <td colSpan={10} className="px-3 py-2">
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--warning)] flex items-center gap-1">
                              <Lock size={9} /> Sign-offs required to leave {phase.name || 'this phase'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {phaseGates.map((g) => {
                                const badgeCls = APPROVER_BADGE_CLS[g.approverType] || APPROVER_BADGE_CLS.client;
                                return (
                                  <span key={g.key} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${badgeCls}`} title={g.gateType}>
                                    <Lock size={9} /> {g.label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
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
    }))
  );
  const [tasks, setTasks] = useState((template.tasks || []).map((t) => ({ ...t })));
  const [gates, setGates] = useState((template.gates || []).map((g) => ({ ...g })));

  const [saving, setSaving] = useState(false);
  const [confirmDefault, setConfirmDefault] = useState(false);

  // Lookups
  const taskByKey = useMemo(() => Object.fromEntries(tasks.map((t) => [t.key, t])), [tasks]);
  const gateByKey = useMemo(() => Object.fromEntries(gates.map((g) => [g.key, g])), [gates]);

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

  const knownPhaseSlugs = options?.knownPhaseSlugs || [];
  const isSystemPhase   = (n) => knownPhaseSlugs.includes(String(n || '').toLowerCase().trim());

  // ── Mutators ────────────────────────────────────────────────────────────
  const setTaskField = (key, field, value) => {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  };
  const setGateField = (key, field, value) => {
    setGates((prev) => prev.map((g) => (g.key === key ? { ...g, [field]: value } : g)));
  };
  const setPhaseName = (idx, newName) => {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, name: newName } : p)));
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

  const deleteTask = (key) => {
    setTasks((prev) => prev.filter((t) => t.key !== key));
    setPhases((prev) => prev.map((p) => ({
      ...p,
      taskKeys: p.taskKeys.filter((k) => k !== key),
    })));
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
          <ArrowLeft size={12} /> Back to templates
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
            <X size={13} /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving} disabled={!dirty}>
            <Save size={13} /> Save Changes
          </Button>
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

      {/* Summary strip — wall-clock span + aggregate planning estimates */}
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
          <p className="text-lg font-extrabold text-[var(--text-primary)] tabular-nums">{totals.hours} <span className="text-xs font-bold text-[var(--text-muted)]">hrs</span></p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sum of Task Days</p>
          <p className="text-lg font-extrabold text-[var(--text-primary)] tabular-nums">{totals.days} <span className="text-xs font-bold text-[var(--text-muted)]">days</span></p>
        </div>
        <div className="col-span-2 md:col-span-4">
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent-blue)]"
              style={{ width: timelineSpan > 0 ? '100%' : '0%' }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">Last task fires on day {timelineSpan}</p>
        </div>
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
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '40px' }} />        {/* # */}
              <col />                                   {/* Title — flex */}
              <col style={{ width: '170px' }} />        {/* Category */}
              <col style={{ width: '78px' }} />         {/* Start Day */}
              <col style={{ width: '78px' }} />         {/* Days */}
              <col style={{ width: '78px' }} />         {/* Hours */}
              <col style={{ width: '110px' }} />        {/* Priority */}
              <col style={{ width: '170px' }} />        {/* Owner */}
              <col style={{ width: '180px' }} />        {/* Checklist */}
              <col style={{ width: '110px' }} />        {/* Waits For */}
              <col style={{ width: '40px' }} />         {/* Actions */}
            </colgroup>
            <thead>
              <tr className="bg-[var(--bg)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-2 py-2.5 text-center">#</th>
                <th className="px-2 py-2.5">Drawing / Task Name</th>
                <th className="px-2 py-2.5">Category</th>
                <th className="px-2 py-2.5 text-center" title="Day offset from project start (0 = day 1)">Start Day</th>
                <th className="px-2 py-2.5 text-center" title="Estimated duration in days — drives planned end date on the project master sheet">Days</th>
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
                const systemPhase = isSystemPhase(phase.name);
                const phaseGates = phase.gateKeys.map((k) => gateByKey[k]).filter(Boolean);
                return (
                  <React.Fragment key={phaseIdx}>
                    {/* Phase header row — visually like a sticky section divider */}
                    <tr className="bg-[var(--primary)]/8 border-b border-[var(--border)]">
                      <td colSpan={11} className="px-3 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                            {phase.order}
                          </span>
                          <input
                            type="text"
                            value={phase.name}
                            onChange={(e) => setPhaseName(phaseIdx, e.target.value)}
                            className="px-2 py-1 text-sm font-bold rounded-md border border-transparent bg-transparent
                                       text-[var(--text-primary)] capitalize hover:border-[var(--border)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--bg)]
                                       min-w-[140px]"
                            placeholder="Phase name"
                          />
                          {systemPhase && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest
                                         text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/30 px-1.5 py-0.5 rounded"
                              title="Engine-recognised phase. Renaming disables auto-advance; tasks still fire."
                            >
                              <AlertTriangle size={9} /> System
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                            {phase.taskKeys.length} task{phase.taskKeys.length !== 1 ? 's' : ''} · {phase.gateKeys.length} sign-off{phase.gateKeys.length !== 1 ? 's' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => deletePhase(phaseIdx)}
                            disabled={phases.length <= 1}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10
                                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={phases.length <= 1 ? 'A template must have at least one phase' : 'Delete this phase (and its draft tasks)'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Task rows for this phase */}
                    {phase.taskKeys.map((key, taskIdxInPhase) => {
                      const t = taskByKey[key];
                      if (!t) return null;
                      const availableChecklists = checklistsByType[t.taskType] || [];
                      const dependsLabel =
                        (t.dependsOnKeys?.length > 0 ? `${t.dependsOnKeys.length} task${t.dependsOnKeys.length !== 1 ? 's' : ''}` : '') +
                        (t.dependsOnKeys?.length > 0 && t.requiresGateKeys?.length > 0 ? ' · ' : '') +
                        (t.requiresGateKeys?.length > 0 ? `${t.requiresGateKeys.length} gate${t.requiresGateKeys.length !== 1 ? 's' : ''}` : '');
                      const dependsTitle = [
                        t.dependsOnKeys?.length > 0 && `depends on: ${t.dependsOnKeys.join(', ')}`,
                        t.requiresGateKeys?.length > 0 && `waits for: ${t.requiresGateKeys.join(', ')}`,
                      ].filter(Boolean).join('  |  ');
                      return (
                        <tr key={key} className="border-b border-[var(--border)] hover:bg-[var(--bg)]/60">
                          <td className="px-2 py-1.5 text-center text-[11px] font-mono text-[var(--text-muted)] tabular-nums">{taskIdxInPhase + 1}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={t.title}
                              onChange={(e) => setTaskField(t.key, 'title', e.target.value)}
                              placeholder="e.g. Master Bedroom — Ceiling Layout"
                              className="w-full px-2 py-1 text-sm font-semibold rounded-md border border-transparent bg-transparent
                                         text-[var(--text-primary)] truncate hover:border-[var(--border)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={t.taskType}
                              onChange={(e) => {
                                const newType = e.target.value;
                                setTasks((prev) => prev.map((x) =>
                                  x.key === t.key
                                    ? { ...x, taskType: newType, checklistTemplateName: '' }
                                    : x
                                ));
                              }}
                              className="w-full px-2 py-1 text-[11px] font-bold rounded-md border border-transparent
                                         bg-transparent hover:border-[var(--border)] text-[var(--text-primary)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                            >
                              {(options?.taskTypes || []).map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="730"
                              value={t.dayOffsetFromProjectStart || 0}
                              onChange={(e) => setTaskField(t.key, 'dayOffsetFromProjectStart', Number(e.target.value))}
                              className="w-full px-1.5 py-1 text-sm text-center rounded-md border border-transparent bg-transparent
                                         text-[var(--text-primary)] tabular-nums hover:border-[var(--border)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                              title="Day offset from project start (0 = day 1)"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="730"
                              step="0.5"
                              value={t.plannedDays ?? 1}
                              onChange={(e) => setTaskField(t.key, 'plannedDays', Number(e.target.value))}
                              className="w-full px-1.5 py-1 text-sm text-center rounded-md border border-transparent bg-transparent
                                         text-[var(--text-primary)] tabular-nums hover:border-[var(--border)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                              title="Estimated duration in days"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="10000"
                              step="0.5"
                              value={t.plannedHours ?? 0}
                              onChange={(e) => setTaskField(t.key, 'plannedHours', Number(e.target.value))}
                              className="w-full px-1.5 py-1 text-sm text-center rounded-md border border-transparent bg-transparent
                                         text-[var(--text-primary)] tabular-nums hover:border-[var(--border)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                              title="Estimated effort in hours"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={t.priority || 'medium'}
                              onChange={(e) => setTaskField(t.key, 'priority', e.target.value)}
                              className={`w-full px-2 py-1 text-xs font-bold rounded-md border border-transparent
                                         hover:border-[var(--border)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]
                                         ${PRIORITY_BADGE_CLS[t.priority || 'medium']}`}
                            >
                              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={t.responsibilitySlug || ''}
                              onChange={(e) => setTaskField(t.key, 'responsibilitySlug', e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded-md border border-transparent bg-transparent
                                         text-[var(--text-primary)] hover:border-[var(--border)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                            >
                              <option value="">— Any —</option>
                              {(options?.responsibilities || []).map((r) => (
                                <option key={r.slug} value={r.slug}>{r.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={t.checklistTemplateName || ''}
                              onChange={(e) => setTaskField(t.key, 'checklistTemplateName', e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded-md border border-transparent bg-transparent
                                         text-[var(--text-primary)] hover:border-[var(--border)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]
                                         disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={availableChecklists.length === 0}
                            >
                              <option value="">
                                {availableChecklists.length === 0 ? 'No checklists' : '— Default —'}
                              </option>
                              {availableChecklists.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {c.name}{c.isDefault ? ' (default)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] text-[var(--text-muted)]" title={dependsTitle || 'No dependencies'}>
                            {dependsLabel || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => deleteTask(t.key)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                              title="Delete task"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* "Add task" row */}
                    <tr className="border-b border-[var(--border)]">
                      <td colSpan={11} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => addTaskToPhase(phaseIdx)}
                          disabled={!options?.taskTypes?.length}
                          className="w-full px-3 py-1.5 rounded-md border border-dashed border-[var(--border)]
                                     text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]
                                     hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5
                                     transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Plus size={12} /> Add task to {phase.name || 'phase'}
                        </button>
                      </td>
                    </tr>

                    {/* Sign-off rows for this phase */}
                    {phaseGates.length > 0 && (
                      <tr className="bg-[var(--warning)]/5 border-b border-[var(--border)]">
                        <td colSpan={11} className="px-3 py-2">
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--warning)] flex items-center gap-1">
                              <Lock size={9} /> Sign-offs required to leave {phase.name || 'this phase'}
                            </p>
                            {phaseGates.map((g) => {
                              const badgeCls = APPROVER_BADGE_CLS[g.approverType] || APPROVER_BADGE_CLS.client;
                              return (
                                <div key={g.key} className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${badgeCls} shrink-0`}>
                                    {g.approverType?.replace(/_/g, ' ')}
                                  </span>
                                  <input
                                    type="text"
                                    value={g.label}
                                    onChange={(e) => setGateField(g.key, 'label', e.target.value)}
                                    className="flex-1 min-w-[200px] px-2 py-1 text-sm rounded-md border border-transparent
                                               bg-transparent text-[var(--text-primary)] hover:border-[var(--border)]
                                               focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* "Add phase" footer row */}
              <tr>
                <td colSpan={11} className="px-3 py-3 bg-[var(--bg)]/40">
                  <button
                    type="button"
                    onClick={addPhase}
                    className="w-full px-3 py-2 rounded-lg border border-dashed border-[var(--primary)]/40
                               text-xs font-bold uppercase tracking-wider text-[var(--primary)]
                               hover:bg-[var(--primary)]/8 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add Phase
                  </button>
                </td>
              </tr>
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
