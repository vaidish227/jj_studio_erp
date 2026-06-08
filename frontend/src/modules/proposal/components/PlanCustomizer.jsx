import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Workflow, Plus, Trash2, AlertTriangle, Lock,
} from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_BADGE_CLS = {
  low:    'bg-[var(--text-muted)]/12 text-[var(--text-muted)]',
  medium: 'bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]',
  high:   'bg-[var(--warning)]/12 text-[var(--warning)]',
  urgent: 'bg-[var(--error)]/12 text-[var(--error)]',
};

const pickDefaultTemplate = (templates, projectType) => {
  if (!templates?.length) return null;
  const actives = templates.filter((t) => t.isActive !== false);
  return (
    actives.find((t) => t.isDefault && t.projectType === projectType) ||
    actives.find((t) => t.isDefault && t.projectType === 'Any') ||
    actives.find((t) => t.isDefault) ||
    actives[0]
  );
};

/**
 * PlanCustomizer — per-project plan editor used during proposal-to-project
 * initiation. Reads the chosen workflow template, lets the manager rename
 * phases and edit / add / remove tasks within the safe-field boundary, then
 * hands the resulting plan back to the parent via onChange(plan).
 *
 * Locked surface (engine invariants — not exposed):
 *   gates, dependsOnKeys, requiresGateKeys, task.taskType on existing tasks,
 *   phase add / remove / reorder, task.key on existing tasks.
 */
const PlanCustomizer = ({ projectType, value, onChange, disabled }) => {
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [options, setOptions] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const loadTemplateIntoPlan = useCallback(async (templateId) => {
    if (!templateId) return;
    try {
      const res = await pmsService.getWorkflowTemplate(templateId);
      const tpl = res?.template;
      if (!tpl) return;
      setSelectedTemplate(tpl);

      const taskByKey = Object.fromEntries((tpl.tasks || []).map((t) => [t.key, t]));
      const linkedKeys = new Set((tpl.phases || []).flatMap((p) => p.taskKeys || []));
      const tasks = (tpl.tasks || [])
        .filter((t) => linkedKeys.has(t.key))
        .map((t) => ({
          key: t.key,
          taskType: t.taskType,
          title: t.title,
          dayOffsetFromProjectStart: t.dayOffsetFromProjectStart || 0,
          plannedDays: t.plannedDays ?? 1,
          plannedHours: t.plannedHours ?? 0,
          priority: t.priority || 'medium',
          responsibilitySlug: t.responsibilitySlug || '',
          checklistTemplateName: t.checklistTemplateName || '',
          notes: t.notes || '',
        }));
      const phases = (tpl.phases || []).map((p) => ({
        name: p.name,
        taskKeys: (p.taskKeys || []).filter((k) => taskByKey[k]),
      }));
      onChange({ baseTemplateId: tpl._id, phases, tasks });
    } catch (err) {
      console.error('[PlanCustomizer.loadTemplate]', err);
    }
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    setTplLoading(true);
    Promise.all([
      pmsService.listWorkflowTemplates(),
      pmsService.getWorkflowTemplateOptions(),
    ])
      .then(([listRes, optsRes]) => {
        if (cancelled) return;
        const list = (listRes?.templates || []).filter((t) => t.isActive !== false);
        setTemplates(list);
        setOptions(optsRes || null);
      })
      .catch(() => {
        if (cancelled) return;
        setTemplates([]);
        setOptions(null);
      })
      .finally(() => { if (!cancelled) setTplLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Auto-pick default template once list arrives (only if parent hasn't picked one)
  useEffect(() => {
    if (!templates.length) return;
    if (value?.baseTemplateId) return;
    const pick = pickDefaultTemplate(templates, projectType);
    if (pick) loadTemplateIntoPlan(pick._id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, projectType]);

  const taskTypeLabel = useCallback((slug) =>
    options?.taskTypes?.find((o) => o.value === slug)?.label || slug,
  [options]);

  const checklistsByType = useMemo(() => {
    const map = {};
    for (const c of (options?.checklistTemplates || [])) {
      if (!map[c.taskType]) map[c.taskType] = [];
      map[c.taskType].push(c);
    }
    return map;
  }, [options]);

  // ── Mutators ──────────────────────────────────────────────────────────────
  const setTaskField = (key, field, fieldValue) => {
    onChange({
      ...value,
      tasks: (value.tasks || []).map((t) => (t.key === key ? { ...t, [field]: fieldValue } : t)),
    });
  };

  const setPhaseName = (idx, newName) => {
    onChange({
      ...value,
      phases: (value.phases || []).map((p, i) => (i === idx ? { ...p, name: newName } : p)),
    });
  };

  const addTaskToPhase = (phaseIdx) => {
    const draftKey = `__draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const firstType = options?.taskTypes?.[0]?.value || 'concept_making';
    const newTask = {
      key: draftKey,
      taskType: firstType,
      title: 'New task',
      dayOffsetFromProjectStart: 0,
      plannedDays: 1,
      plannedHours: 0,
      priority: 'medium',
      responsibilitySlug: '',
      checklistTemplateName: '',
      notes: '',
      __phaseIdx: phaseIdx,
    };
    onChange({
      ...value,
      tasks: [...(value.tasks || []), newTask],
      phases: (value.phases || []).map((p, i) =>
        i === phaseIdx ? { ...p, taskKeys: [...(p.taskKeys || []), draftKey] } : p
      ),
    });
  };

  const removeTask = (key) => {
    onChange({
      ...value,
      tasks: (value.tasks || []).filter((t) => t.key !== key),
      phases: (value.phases || []).map((p) => ({
        ...p,
        taskKeys: (p.taskKeys || []).filter((k) => k !== key),
      })),
    });
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const taskByKey = useMemo(
    () => Object.fromEntries((value?.tasks || []).map((t) => [t.key, t])),
    [value?.tasks]
  );

  const summary = useMemo(() => {
    const tasks = value?.tasks || [];
    const days = tasks.reduce((s, t) => s + (Number(t.plannedDays) || 0), 0);
    const hours = tasks.reduce((s, t) => s + (Number(t.plannedHours) || 0), 0);
    const span = tasks.reduce((m, t) => Math.max(
      m,
      (Number(t.dayOffsetFromProjectStart) || 0) + (Number(t.plannedDays) || 0),
    ), 0);
    return { tasks: tasks.length, days, hours, span };
  }, [value?.tasks]);

  const knownPhaseSlugs = options?.knownPhaseSlugs || [];
  const isSystemPhase = (n) => knownPhaseSlugs.includes(String(n || '').toLowerCase().trim());

  if (tplLoading) {
    return (
      <div className="text-xs text-[var(--text-muted)] py-6 text-center">
        Loading workflow templates…
      </div>
    );
  }
  if (!templates.length) {
    return (
      <div className="text-xs text-[var(--text-muted)] py-6 text-center">
        No active workflow templates found. Default plan will be used.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template picker */}
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          <Workflow size={12} className="text-[var(--primary)]" />
          Base Workflow Template
        </label>
        <select
          value={value?.baseTemplateId || ''}
          onChange={(e) => loadTemplateIntoPlan(e.target.value)}
          disabled={disabled}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)]
                     focus:outline-none focus:ring-1 focus:ring-[var(--primary)] min-w-[280px]"
        >
          {templates.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}{t.isDefault ? ' (default)' : ''} — {t.projectType || 'Any'}
            </option>
          ))}
        </select>
        {selectedTemplate?.description && (
          <span className="text-[11px] text-[var(--text-muted)]">{selectedTemplate.description}</span>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Tasks',       value: summary.tasks },
          { label: 'Total Days',  value: summary.days },
          { label: 'Total Hours', value: summary.hours },
          { label: 'Span (days)', value: summary.span },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">{s.label}</p>
            <p className="text-base font-extrabold text-[var(--text-primary)] tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Editable phases + tasks table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[55vh]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[var(--bg)] sticky top-0 z-10">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-2 py-2 w-8 text-center">#</th>
                <th className="px-2 py-2 min-w-[200px]">Task</th>
                <th className="px-2 py-2 w-36">Type</th>
                <th className="px-2 py-2 w-16 text-center">Start</th>
                <th className="px-2 py-2 w-16 text-center">Days</th>
                <th className="px-2 py-2 w-16 text-center">Hrs</th>
                <th className="px-2 py-2 w-24">Priority</th>
                <th className="px-2 py-2 w-36">Owner</th>
                <th className="px-2 py-2 w-36">Checklist</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {(value?.phases || []).map((phase, phaseIdx) => (
                <React.Fragment key={`phase-${phaseIdx}`}>
                  <tr className="bg-[var(--primary)]/8 border-b border-[var(--border)]">
                    <td colSpan={10} className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black w-5 h-5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                          {phaseIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={phase.name}
                          onChange={(e) => setPhaseName(phaseIdx, e.target.value)}
                          disabled={disabled}
                          className="px-2 py-1 text-sm font-bold rounded-md border border-transparent bg-transparent
                                     text-[var(--text-primary)] capitalize hover:border-[var(--border)]
                                     focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--bg)]
                                     min-w-[160px]"
                          placeholder="Phase name"
                        />
                        {isSystemPhase(phase.name) && (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest
                                       text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/30 px-1.5 py-0.5 rounded"
                            title="Engine-recognised phase. Renaming disables auto-advance; tasks still fire."
                          >
                            <AlertTriangle size={9} /> System
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                          {(phase.taskKeys || []).length} task{(phase.taskKeys || []).length !== 1 ? 's' : ''}
                        </span>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => addTaskToPhase(phaseIdx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest
                                       text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 transition-colors"
                            title="Add task to this phase"
                          >
                            <Plus size={11} /> Task
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {(phase.taskKeys || []).map((taskKey, idxInPhase) => {
                    const t = taskByKey[taskKey];
                    if (!t) return null;
                    const isDraft = String(taskKey).startsWith('__draft_');
                    const availableChecklists = checklistsByType[t.taskType] || [];
                    return (
                      <tr key={taskKey} className="border-b border-[var(--border)] hover:bg-[var(--bg)]/40">
                        <td className="px-2 py-1.5 text-center text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                          {idxInPhase + 1}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={t.title}
                            onChange={(e) => setTaskField(taskKey, 'title', e.target.value)}
                            disabled={disabled}
                            placeholder="Task title"
                            className="w-full px-2 py-1 text-sm font-semibold rounded-md border border-transparent bg-transparent
                                       text-[var(--text-primary)] hover:border-[var(--border)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          {isDraft ? (
                            <select
                              value={t.taskType}
                              onChange={(e) => setTaskField(taskKey, 'taskType', e.target.value)}
                              disabled={disabled}
                              className="w-full px-2 py-1 text-[11px] font-bold rounded-md border border-transparent
                                         bg-transparent hover:border-[var(--border)] text-[var(--text-primary)]
                                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                            >
                              {(options?.taskTypes || []).map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text-primary)] px-2 py-1">
                              <Lock size={9} className="text-[var(--text-muted)]" />
                              {taskTypeLabel(t.taskType)}
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="730"
                            value={t.dayOffsetFromProjectStart || 0}
                            onChange={(e) => setTaskField(taskKey, 'dayOffsetFromProjectStart', Number(e.target.value))}
                            disabled={disabled}
                            className="w-full px-1.5 py-1 text-sm text-center rounded-md border border-transparent bg-transparent
                                       text-[var(--text-primary)] tabular-nums hover:border-[var(--border)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                          />
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="730"
                            step="0.5"
                            value={t.plannedDays ?? 1}
                            onChange={(e) => setTaskField(taskKey, 'plannedDays', Number(e.target.value))}
                            disabled={disabled}
                            className="w-full px-1.5 py-1 text-sm text-center rounded-md border border-transparent bg-transparent
                                       text-[var(--text-primary)] tabular-nums hover:border-[var(--border)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                          />
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10000"
                            step="0.5"
                            value={t.plannedHours ?? 0}
                            onChange={(e) => setTaskField(taskKey, 'plannedHours', Number(e.target.value))}
                            disabled={disabled}
                            className="w-full px-1.5 py-1 text-sm text-center rounded-md border border-transparent bg-transparent
                                       text-[var(--text-primary)] tabular-nums hover:border-[var(--border)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={t.priority || 'medium'}
                            onChange={(e) => setTaskField(taskKey, 'priority', e.target.value)}
                            disabled={disabled}
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
                            onChange={(e) => setTaskField(taskKey, 'responsibilitySlug', e.target.value)}
                            disabled={disabled}
                            className="w-full px-2 py-1 text-xs rounded-md border border-transparent bg-transparent
                                       text-[var(--text-primary)] hover:border-[var(--border)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]"
                          >
                            <option value="">— Unassigned —</option>
                            {(options?.responsibilities || []).map((r) => (
                              <option key={r.slug} value={r.slug}>{r.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={t.checklistTemplateName || ''}
                            onChange={(e) => setTaskField(taskKey, 'checklistTemplateName', e.target.value)}
                            disabled={disabled || availableChecklists.length === 0}
                            className="w-full px-2 py-1 text-xs rounded-md border border-transparent bg-transparent
                                       text-[var(--text-primary)] hover:border-[var(--border)]
                                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:bg-[var(--surface)]
                                       disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <td className="px-2 py-1.5 text-center">
                          {!disabled && (
                            <button
                              type="button"
                              onClick={() => removeTask(taskKey)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                              title="Remove task"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lock banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--warning)]/8 border border-[var(--warning)]/30 text-[11px] text-[var(--text-primary)]">
        <AlertTriangle size={14} className="text-[var(--warning)] shrink-0 mt-0.5" />
        <div>
          <p className="font-bold mb-0.5">Plan locks on initiation</p>
          <p className="text-[var(--text-secondary)]">
            After initiation, task assignments / due dates / status can still be edited individually,
            but the overall plan structure (phases, gates, dependencies) is fixed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlanCustomizer;
