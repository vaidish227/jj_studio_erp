import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight, ArrowLeft, Lock, Workflow, AlertTriangle,
  Plus, Edit3, Copy, Trash2, Save, X, Star, Power, Eye,
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

// ─── Read-only viewer (kept from previous version) ───────────────────────────
const TemplateDetail = ({ template, onBack, onEdit }) => {
  const taskByKey = Object.fromEntries((template.tasks || []).map((t) => [t.key, t]));
  const gateByKey = Object.fromEntries((template.gates || []).map((g) => [g.key, g]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
          <ArrowLeft size={12} /> Back to templates
        </button>
        <Button size="sm" onClick={() => onEdit(template)}>
          <Edit3 size={13} /> Edit Template
        </Button>
      </div>

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
            {template.projectType || 'Any'} · {template.phases?.length} phases · {template.tasks?.length} tasks · {template.gates?.length} gates
          </span>
        </div>
        {template.description && <p className="text-sm text-[var(--text-secondary)]">{template.description}</p>}
      </div>

      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Phases</h3>
        <div className="space-y-3">
          {(template.phases || []).map((phase) => (
            <div key={phase.name} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center">{phase.order}</span>
                <h4 className="text-sm font-bold text-[var(--text-primary)] capitalize">{phase.name}</h4>
              </div>

              {phase.taskKeys?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Tasks</p>
                  <div className="space-y-1.5">
                    {phase.taskKeys.map((key) => {
                      const t = taskByKey[key];
                      if (!t) return null;
                      return (
                        <div key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                            {t.taskType}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.title}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">
                              day +{t.dayOffsetFromProjectStart || 0}
                              {t.priority && ` · ${t.priority}`}
                              {t.dependsOnKeys?.length > 0 && ` · depends on ${t.dependsOnKeys.join(', ')}`}
                              {t.requiresGateKeys?.length > 0 && ` · waits for ${t.requiresGateKeys.join(', ')}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {phase.gateKeys?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Sign-offs</p>
                  <div className="flex flex-wrap gap-2">
                    {phase.gateKeys.map((key) => {
                      const g = gateByKey[key];
                      if (!g) return null;
                      const badgeCls = APPROVER_BADGE_CLS[g.approverType] || APPROVER_BADGE_CLS.client;
                      return (
                        <span key={key} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${badgeCls}`} title={g.gateType}>
                          <Lock size={9} /> {g.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
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

  // Timeline span — last task's day offset
  const timelineSpan = useMemo(
    () => tasks.reduce((max, t) => Math.max(max, t.dayOffsetFromProjectStart || 0), 0),
    [tasks]
  );

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
        tasks: tasks.map((t) => ({
          // Drop draft keys — server will mint stable ones.
          ...(t.__isDraft ? {} : { key: t.key }),
          taskType: t.taskType,
          title: t.title,
          dayOffsetFromProjectStart: Number(t.dayOffsetFromProjectStart) || 0,
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

      {/* Timeline summary strip */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Total Timeline</p>
          <p className="text-lg font-extrabold text-[var(--text-primary)]">{timelineSpan} days</p>
        </div>
        <div className="flex-1 min-w-[200px] max-w-md ml-auto">
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent-blue)]"
              style={{ width: timelineSpan > 0 ? '100%' : '0%' }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">Last task fires on day {timelineSpan}</p>
        </div>
      </div>

      {/* Phases with editable tasks */}
      {optsLoading && (
        <div className="text-xs text-[var(--text-muted)] text-center py-2">Loading dropdown options…</div>
      )}
      <div className="space-y-4">
        {phases.map((phase, phaseIdx) => {
          const systemPhase = isSystemPhase(phase.name);
          return (
            <div key={phaseIdx} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-3">
              {/* Phase header — editable name */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center shrink-0">
                  {phase.order}
                </span>
                <input
                  type="text"
                  value={phase.name}
                  onChange={(e) => setPhaseName(phaseIdx, e.target.value)}
                  className="flex-1 min-w-[160px] px-2.5 py-1 text-sm font-bold rounded-lg border border-[var(--border)] bg-[var(--bg)]
                             text-[var(--text-primary)] capitalize focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
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
                  {phase.taskKeys.length} tasks · {phase.gateKeys.length} sign-offs
                </span>
              </div>

              {/* Tasks in this phase */}
              <div className="space-y-2">
                {phase.taskKeys.map((key) => {
                  const t = taskByKey[key];
                  if (!t) return null;
                  const availableChecklists = checklistsByType[t.taskType] || [];
                  return (
                    <div key={key} className="rounded-xl bg-[var(--bg)] border border-[var(--border)] p-3 space-y-2">
                      <div className="flex items-start gap-2 flex-wrap">
                        {/* Task type dropdown — backend enum */}
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
                          className="px-2 py-1 text-[11px] font-bold rounded-lg border border-[var(--border)] bg-[var(--surface)]
                                     text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]
                                     max-w-[180px]"
                        >
                          {(options?.taskTypes || []).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={t.title}
                          onChange={(e) => setTaskField(t.key, 'title', e.target.value)}
                          placeholder="Task title"
                          className="flex-1 min-w-[180px] px-2.5 py-1 text-sm font-semibold rounded-lg border border-[var(--border)] bg-[var(--surface)]
                                     text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />

                        <button
                          type="button"
                          onClick={() => deleteTask(t.key)}
                          className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]
                                     text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                          title="Delete task"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                          Day
                          <input
                            type="number"
                            min="0"
                            max="730"
                            value={t.dayOffsetFromProjectStart || 0}
                            onChange={(e) => setTaskField(t.key, 'dayOffsetFromProjectStart', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)]
                                       text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          />
                        </label>

                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                          Priority
                          <select
                            value={t.priority || 'medium'}
                            onChange={(e) => setTaskField(t.key, 'priority', e.target.value)}
                            className={`px-2 py-1 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--surface)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)]
                                       ${PRIORITY_BADGE_CLS[t.priority || 'medium']}`}
                          >
                            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </label>

                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                          Owner
                          <select
                            value={t.responsibilitySlug || ''}
                            onChange={(e) => setTaskField(t.key, 'responsibilitySlug', e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)]
                                       text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          >
                            <option value="">— Any —</option>
                            {(options?.responsibilities || []).map((r) => (
                              <option key={r.slug} value={r.slug}>{r.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                          Checklist
                          <select
                            value={t.checklistTemplateName || ''}
                            onChange={(e) => setTaskField(t.key, 'checklistTemplateName', e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)]
                                       text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]
                                       max-w-[180px]"
                            disabled={availableChecklists.length === 0}
                          >
                            <option value="">
                              {availableChecklists.length === 0 ? 'No checklists for this type' : '— Default —'}
                            </option>
                            {availableChecklists.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}{c.isDefault ? ' (default)' : ''}
                              </option>
                            ))}
                          </select>
                        </label>

                        {(t.dependsOnKeys?.length > 0 || t.requiresGateKeys?.length > 0) && (
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                            {t.dependsOnKeys?.length > 0 && `depends on ${t.dependsOnKeys.join(', ')}`}
                            {t.dependsOnKeys?.length > 0 && t.requiresGateKeys?.length > 0 && ' · '}
                            {t.requiresGateKeys?.length > 0 && `waits for ${t.requiresGateKeys.join(', ')}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add task button */}
                <button
                  type="button"
                  onClick={() => addTaskToPhase(phaseIdx)}
                  disabled={!options?.taskTypes?.length}
                  className="w-full px-3 py-2 rounded-lg border border-dashed border-[var(--border)]
                             text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]
                             hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5
                             transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Plus size={12} /> Add Task to {phase.name || 'phase'}
                </button>
              </div>

              {/* Editable gate labels */}
              {phase.gateKeys.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sign-offs</p>
                  {phase.gateKeys.map((key) => {
                    const g = gateByKey[key];
                    if (!g) return null;
                    const badgeCls = APPROVER_BADGE_CLS[g.approverType] || APPROVER_BADGE_CLS.client;
                    return (
                      <div key={key} className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${badgeCls} shrink-0`}>
                          {g.approverType?.replace(/_/g, ' ')}
                        </span>
                        <input
                          type="text"
                          value={g.label}
                          onChange={(e) => setGateField(g.key, 'label', e.target.value)}
                          className="flex-1 min-w-[200px] px-2.5 py-1 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                                     text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

  // ─ Edit mode
  if (mode === 'edit' && active) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <TemplateEditor
          template={active}
          onBack={() => { setMode('list'); setActive(null); reload(); }}
          onSaved={() => { setMode('list'); setActive(null); reload(); }}
        />
      </div>
    );
  }

  // ─ View mode
  if (mode === 'view' && active) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
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
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)]">Workflow Templates</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Templates control which tasks, timelines, and sign-offs are created when a new project starts.
            <span className="block text-xs text-[var(--text-muted)] mt-1">
              Edits apply only to <strong>new</strong> projects — existing projects keep their original workflow.
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
